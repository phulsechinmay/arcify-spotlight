# Architecture Research: Chrome Extension Spotlight/Command Palette

**Research Date:** 2026-02-03
**Research Dimension:** Architecture
**Project Context:** Arcify Spotlight Chrome Extension improvements

---

## Executive Summary

The arcify-spotlight extension follows a well-structured Chrome Extension Manifest V3 architecture with clear separation between background service worker (data fetching), content script overlay (UI rendering), and shared modules (business logic). The current architecture is sound but has specific areas where deduplication, filtering, theming, and keyboard navigation can be improved through targeted refactoring.

**Key Recommendation:** Deduplication and filtering logic should remain in the background service worker's data provider layer, while theming and URL preview updates should be handled asynchronously in the overlay with optimistic UI patterns.

---

## Current Architecture Analysis

### Component Topology

```
+---------------------------+
|   Background Service      |
|       Worker              |
|  +---------------------+  |
|  | SearchEngine        |  |  <- Caching, debouncing, action handling
|  +---------------------+  |
|  | BackgroundData      |  |  <- Direct Chrome API access
|  | Provider            |  |
|  +---------------------+  |
|  | Message Handlers    |  |  <- Request routing
|  +---------------------+  |
+---------------------------+
          |  Message Passing
          v
+---------------------------+
|   Content Script          |
|   (overlay.js)            |
|  +---------------------+  |
|  | Instant Suggestions |  |  <- Zero-latency URL/search detection
|  +---------------------+  |
|  | Selection Manager   |  |  <- Keyboard navigation state
|  +---------------------+  |
|  | Message Client      |  |  <- Background communication
|  +---------------------+  |
+---------------------------+
          |
          v
+---------------------------+
|   Shared Modules          |
|  +---------------------+  |
|  | BaseDataProvider    |  |  <- Deduplication, scoring, aggregation
|  +---------------------+  |
|  | search-types.js     |  |  <- Result type definitions
|  +---------------------+  |
|  | scoring-constants   |  |  <- Score hierarchy
|  +---------------------+  |
|  | ui-utilities.js     |  |  <- Formatting, favicon, colors
|  +---------------------+  |
|  | shared-component    |  |  <- Result rendering, event handling
|  |   -logic.js         |  |
|  +---------------------+  |
+---------------------------+
```

### Data Flow for Suggestions

```
User Types Query
      |
      v
[Overlay: handleInstantInput()] -----> Instant Suggestion (URL or Search)
      |                                       |
      v                                       |
[Overlay: handleAsyncSearch()]                |
      |                                       |
      | (150ms debounce)                      |
      v                                       |
[Message: getSpotlightSuggestions] ----+      |
      |                                |      |
      v                                |      |
[Background: SearchEngine]             |      |
      |                                |      |
      v                                |      |
[BackgroundDataProvider]               |      |
      |                                |      |
      +-> getOpenTabsData()            |      |
      +-> getPinnedTabsData()          |      |
      +-> getBookmarksData()           |      |
      +-> getHistoryData()             |      |
      +-> getTopSitesData()            |      |
      +-> getAutocompleteData()        |      |
      |                                |      |
      v                                |      |
[BaseDataProvider.deduplicateResults()]|      |
      |                                |      |
      v                                |      |
[BaseDataProvider.scoreAndSortResults()]      |
      |                                |      |
      v                                |      |
[Send Response]                        |      |
      |                                |      |
      +--------------------------------+      |
                     |                        |
                     v                        v
             [SharedSpotlightLogic.combineResults()]
                     |
                     v
             [SelectionManager.updateResults()]
                     |
                     v
             [updateResultsDisplay()]
```

---

## Component Responsibilities

### 1. Background Service Worker (`background.js`)

**Current Responsibilities:**
- Extension lifecycle management
- Keyboard command handling
- Spotlight injection orchestration
- Message routing to data providers
- Tab tracking for open spotlights

**Chrome API Access:**
- `chrome.tabs.query()` - Tab enumeration
- `chrome.bookmarks.search()` - Bookmark queries
- `chrome.history.search()` - History queries
- `chrome.topSites.get()` - Top sites
- `chrome.storage.local.get()` - Spaces data, tab activity
- `chrome.tabGroups` - Tab group information

**Recommendation:** Keep as thin orchestration layer. Do not add business logic here.

### 2. SearchEngine (`shared/search-engine.js`)

**Current Responsibilities:**
- Caching (30-second TTL)
- Debouncing (150ms)
- Action handling (tab switching, navigation)
- Delegation to data provider

**Issues Identified:**
- Action handling mixed with search coordination
- Context detection logic (`isBackgroundContext`) fragile in minified builds

**Recommendation:** Extract action handling to separate module. Keep SearchEngine focused on search orchestration.

### 3. BaseDataProvider (`shared/data-providers/base-data-provider.js`)

**Current Responsibilities:**
- Result aggregation from all sources
- Deduplication (`deduplicateResults()`)
- Scoring (`scoreAndSortResults()`)
- URL normalization
- Fuzzy domain matching

**This is the correct location for deduplication logic because:**
1. Has access to all data sources before merging
2. Can apply consistent priority rules across sources
3. Runs in background context with full Chrome API access
4. Isolated from UI rendering concerns

**Current Deduplication Algorithm:**
```javascript
// From base-data-provider.js lines 430-477
deduplicateResults(results) {
    const seen = new Map();
    for (const result of results) {
        let key = this.normalizeUrlForDeduplication(result.url);
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, result);
            deduplicated.push(result);
        } else {
            // Keep higher priority result
            if (currentPriority > existingPriority) {
                deduplicated[index] = result;
                seen.set(key, result);
            }
        }
    }
    return deduplicated;
}
```

**Improvement Needed:** The current deduplication normalizes URLs but may miss duplicates with different query parameters or trailing slashes in edge cases.

### 4. BackgroundDataProvider (`shared/data-providers/background-data-provider.js`)

**Current Responsibilities:**
- Direct Chrome API calls
- Pinned tabs resolution (spaces + bookmarks)
- Bookmark filtering (excludes Arcify folder)

**Issue with getPinnedTabsData():**
```javascript
// Lines 104-173 - Complex logic mixing concerns
async getPinnedTabsData(query = '') {
    // Gets spaces from storage
    // Gets tabs from Chrome
    // Finds Arcify folder
    // Iterates space folders
    // Matches bookmarks to tabs
    // Applies query filter
}
```

**Recommendation:** Extract bookmark/space resolution to `BookmarkUtils` or dedicated service.

### 5. Content Script Overlay (`overlay.js`)

**Current Responsibilities:**
- UI creation and injection
- Instant suggestion generation
- Selection state management
- Color theming
- Keyboard navigation

**Current Instant Suggestion Pattern:**
```javascript
// Instant (zero-latency)
function handleInstantInput() {
    instantSuggestion = SpotlightUtils.generateInstantSuggestion(query);
    updateDisplay();
}

// Async (debounced)
async function handleAsyncSearch() {
    const results = await sendGetSuggestionsMessage(query, mode);
    asyncSuggestions = results || [];
    updateDisplay();
}
```

**Issue:** URL preview does not update during keyboard navigation because `SelectionManager` only tracks index, not URL display.

### 6. SelectionManager (`shared/selection-manager.js`)

**Current Responsibilities:**
- Track selected index
- Handle arrow key navigation
- Update visual selection state
- Auto-scroll into view

**Missing Capability:** Does not emit events or callbacks when selection changes, preventing URL preview updates.

---

## Specific Improvement Areas

### 1. Deduplication Logic Improvements

**Location:** `BaseDataProvider.deduplicateResults()` and `BaseDataProvider.normalizeUrlForDeduplication()`

**Current Issues:**
- Does not handle URL fragments (#) consistently
- May create duplicates when same content appears as tab + bookmark + history
- Priority ordering may not match user expectations

**Recommended Changes:**

```javascript
// Enhanced URL normalization for deduplication
normalizeUrlForDeduplication(url) {
    if (!url) return '';

    let normalized = url.toLowerCase();

    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');

    // Remove protocols
    normalized = normalized.replace(/^https?:\/\//, '');

    // Remove www prefix
    normalized = normalized.replace(/^www\./, '');

    // NEW: Remove URL fragments
    normalized = normalized.replace(/#.*$/, '');

    // NEW: Optionally remove query strings for same-page deduplication
    // (Consider making this configurable)
    // normalized = normalized.replace(/\?.*$/, '');

    return normalized;
}

// Enhanced priority with explicit type hierarchy
getResultPriority(result) {
    const TYPE_PRIORITY = {
        'open-tab': 100,      // Always prefer open tabs
        'pinned-tab': 95,     // Then pinned tabs
        'bookmark': 80,       // Then bookmarks
        'history': 70,        // Then history
        'top-site': 60,       // Then top sites
        'autocomplete': 30,   // Then autocomplete
        'search-query': 20,   // Finally search queries
        'url-suggestion': 20
    };
    return TYPE_PRIORITY[result.type] || 0;
}
```

**Build Order:** This is a leaf change with no dependencies.

### 2. Tab Query/Filtering Reliability

**Location:** `BackgroundDataProvider.getOpenTabsData()` and `BackgroundDataProvider.getPinnedTabsData()`

**Current Issues:**
- Tab filtering done after fetching all tabs (inefficient for large tab counts)
- Pinned tab resolution complex and error-prone
- No handling for tabs being closed during query

**Recommended Changes:**

```javascript
// More robust tab querying with error handling
async getOpenTabsData(query = '') {
    try {
        const tabs = await chrome.tabs.query({});

        return tabs.filter(tab => {
            // Guard against tabs closed during iteration
            if (!tab || !tab.title || !tab.url) return false;

            // Skip special Chrome URLs that aren't useful
            if (tab.url.startsWith('chrome://') &&
                !tab.url.startsWith('chrome://newtab')) {
                return false;
            }

            if (!query) return true;

            const queryLower = query.toLowerCase();
            return tab.title.toLowerCase().includes(queryLower) ||
                   tab.url.toLowerCase().includes(queryLower);
        });
    } catch (error) {
        // Handle extension context invalidation
        if (error.message?.includes('Extension context invalidated')) {
            return [];
        }
        throw error;
    }
}
```

**Build Order:** Independent of deduplication changes.

### 3. Tab Groups API Integration for Color Theming

**Location:** `background.js` (getActiveSpaceColor handler) and `SpotlightMessageClient.getActiveSpaceColor()`

**Current Implementation:**
```javascript
// background.js lines 302-325
} else if (message.action === 'getActiveSpaceColor') {
    (async () => {
        const spacesResult = await chrome.storage.local.get('spaces');
        const spaces = spacesResult.spaces || [];

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab?.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
            sendResponse({ success: true, color: 'purple' });
            return;
        }

        const activeSpace = spaces.find(space => space.id === activeTab.groupId);
        sendResponse({ success: true, color: activeSpace?.color || 'purple' });
    })();
    return true;
}
```

**Issue:** Relies on spaces storage which may be stale. Should query Tab Groups API directly.

**Recommended Changes:**

```javascript
// Use Chrome Tab Groups API directly for authoritative color
async function getActiveTabGroupColor() {
    try {
        const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!activeTab?.groupId ||
            activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
            return 'purple'; // Default for ungrouped tabs
        }

        // Query Tab Groups API directly
        const group = await chrome.tabGroups.get(activeTab.groupId);
        return group?.color || 'purple';

    } catch (error) {
        Logger.error('[Background] Error getting tab group color:', error);
        return 'purple';
    }
}
```

**Integration Point:** Add `chrome.tabGroups` permission to manifest if not present.

**Build Order:** Depends on having Tab Groups API access. Can be done independently of other improvements.

### 4. URL Preview Updates During Keyboard Navigation

**Location:** `SelectionManager` and overlay integration

**Current Issue:** When user navigates with arrow keys, the URL/subtitle shown for selected result doesn't update dynamically.

**Root Cause:** `SelectionManager.moveSelection()` only updates CSS class, doesn't emit event for URL update.

**Recommended Changes:**

```javascript
// Enhanced SelectionManager with selection change callback
class SelectionManager {
    constructor(container, onSelectionChange = null) {
        this.container = container;
        this.selectedIndex = 0;
        this.results = [];
        this.onSelectionChange = onSelectionChange; // NEW
    }

    moveSelection(direction) {
        const prevIndex = this.selectedIndex;
        const maxIndex = this.results.length - 1;

        if (direction === 'down') {
            this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
        } else if (direction === 'up') {
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        }

        this.updateVisualSelection();

        // NEW: Notify listener of selection change
        if (this.onSelectionChange && prevIndex !== this.selectedIndex) {
            const selectedResult = this.getSelectedResult();
            this.onSelectionChange(selectedResult, this.selectedIndex);
        }
    }
}

// Overlay integration
const selectionManager = new SelectionManager(
    resultsContainer,
    (result, index) => {
        // Update URL preview in input or status area
        updateUrlPreview(result);
    }
);

function updateUrlPreview(result) {
    // Could update input placeholder, status bar, or tooltip
    // Implementation depends on desired UX
}
```

**Build Order:** Must be done after SelectionManager is well-tested. Low dependency.

---

## Data Flow for Filtering

### Current Flow

```
Query Input
    |
    v
[Instant Suggestion] --> Display immediately
    |
    +--> URL detection (SpotlightUtils.isURL)
    +--> Search query generation
    |
    v
[Async Background Query]
    |
    v
[BackgroundDataProvider.getSpotlightSuggestions()]
    |
    +-> getOpenTabs(query) -----+
    +-> getPinnedTabSuggestions(query) --+
    +-> getBookmarkSuggestions(query) ---+  (parallel)
    +-> getHistorySuggestions(query) ----+
    +-> getTopSites() ------------------+
    +-> getAutocompleteSuggestions(query) +
                                         |
                                         v
                              [Collect Results Array]
                                         |
                                         v
                              [deduplicateResults()]
                                         |
                                         v
                              [scoreAndSortResults()]
                                         |
                                         v
                              [Return top 8 results]
```

### Recommended Flow (Enhanced)

```
Query Input
    |
    v
[Instant Suggestion] --> Display immediately
    |
    +--> URL detection (SpotlightUtils.isURL)
    +--> Search query generation
    |
    v
[Async Background Query]
    |
    v
[BackgroundDataProvider.getSpotlightSuggestions()]
    |
    +---------------------------+
    |  Parallel Data Fetching   |
    |  (with error isolation)   |
    +---------------------------+
    |
    v
[Pre-filter at source]  <-- NEW: Filter before collecting
    |
    +-> Tabs: Skip chrome:// URLs
    +-> Bookmarks: Skip Arcify folder (already done)
    +-> History: Already filtered by Chrome API
    |
    v
[Aggregate with type tagging]  <-- NEW: Tag source for debugging
    |
    v
[Enhanced deduplicateResults()]
    |
    +-> Normalize URLs (fragments, query strings)
    +-> Apply type priority
    +-> Keep highest priority duplicate
    |
    v
[scoreAndSortResults()]
    |
    +-> Apply relevance bonuses
    +-> Sort by final score
    |
    v
[Return top 8 results]
```

---

## Integration Points

### Chrome Tab Groups API

**Required Permission:** `tabGroups` (check manifest)

**API Methods:**
- `chrome.tabGroups.get(groupId)` - Get specific group
- `chrome.tabGroups.query({})` - Query all groups
- `chrome.tabGroups.onUpdated` - Listen for group changes

**Integration for Color Theming:**

```javascript
// background.js - Add listener for real-time color updates
chrome.tabGroups.onUpdated.addListener((group) => {
    // Broadcast color change to open spotlights
    broadcastToSpotlights({
        action: 'spaceColorUpdated',
        groupId: group.id,
        color: group.color
    });
});

// overlay.js - Listen for color updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'spaceColorUpdated') {
        // Check if this group is the active group
        // Update CSS variables if so
    }
});
```

### Chrome Bookmarks API

**Already Used For:**
- `getPinnedTabsData()` - Finding Arcify folder bookmarks
- `getBookmarksData()` - General bookmark search

**Integration for Bookmark Detection:**
The current `BookmarkUtils.findArcifyFolder()` is robust with 3-method fallback. Keep this pattern.

---

## Build Order (Dependency Graph)

```
Level 0 (No Dependencies):
+------------------------+
| 1. Deduplication fixes |  <- normalizeUrlForDeduplication improvements
+------------------------+
| 2. Tab query hardening |  <- Error handling, filter optimization
+------------------------+
| 3. Tab Groups API      |  <- Direct color query
+------------------------+

Level 1 (Depends on Level 0):
+------------------------+
| 4. Selection callbacks |  <- Depends on stable SelectionManager
+------------------------+
| 5. URL preview updates |  <- Depends on #4
+------------------------+

Level 2 (Integration):
+------------------------+
| 6. Real-time theming   |  <- Depends on #3, broadcasts to overlays
+------------------------+
```

**Recommended Implementation Order:**

1. **Deduplication fixes** - Isolated change to `base-data-provider.js`
2. **Tab query hardening** - Isolated change to `background-data-provider.js`
3. **Tab Groups API integration** - Isolated change to `background.js`
4. **Selection change callbacks** - Change to `selection-manager.js`
5. **URL preview updates** - Change to `overlay.js`, `newtab.js`
6. **Real-time theming** - Full integration across components

---

## Performance Considerations

### Current Optimizations

1. **Caching:** 30-second TTL in SearchEngine
2. **Debouncing:** 150ms for async queries
3. **Instant Suggestions:** Zero-latency URL/search detection
4. **Parallel Fetching:** All data sources queried simultaneously
5. **Result Limiting:** Top 8 results returned

### Recommended Optimizations

1. **Pre-filter at source:** Don't fetch then filter; filter during fetch where possible
2. **Lazy favicon loading:** Load favicons after initial render
3. **Virtual scrolling:** For result lists > 20 items (not current case)
4. **Cache invalidation:** Clear cache on tab/bookmark changes

### Memory Considerations

- Current SearchResult objects are lightweight
- Consider object pooling if profiling shows GC pressure
- WeakMap for tab ID -> result mapping to allow GC

---

## Summary of Recommendations

| Area | Where | Change Type | Priority |
|------|-------|-------------|----------|
| Deduplication | `base-data-provider.js` | Algorithm fix | High |
| Tab filtering | `background-data-provider.js` | Hardening | Medium |
| Color theming | `background.js` | API change | Medium |
| URL preview | `selection-manager.js`, `overlay.js` | Feature | Low |
| Real-time theme | Cross-component | Integration | Low |

### Key Architectural Decisions

1. **Keep deduplication in background** - Has full data access, isolated from UI
2. **Keep scoring in BaseDataProvider** - Single source of truth for result priority
3. **Keep instant suggestions in overlay** - Zero-latency requirement
4. **Add selection callbacks** - Minimal change, high flexibility gain
5. **Use Tab Groups API directly** - More reliable than storage cache

---

## Files to Modify (Summary)

| File | Purpose | Changes |
|------|---------|---------|
| `/arcify-spotlight/shared/data-providers/base-data-provider.js` | Deduplication, scoring | Improve `normalizeUrlForDeduplication()`, `getResultPriority()` |
| `/arcify-spotlight/shared/data-providers/background-data-provider.js` | Chrome API queries | Harden `getOpenTabsData()`, `getPinnedTabsData()` |
| `/arcify-spotlight/background.js` | Tab Groups API | Change `getActiveSpaceColor` handler |
| `/arcify-spotlight/shared/selection-manager.js` | Keyboard navigation | Add `onSelectionChange` callback |
| `/arcify-spotlight/overlay.js` | URL preview | Integrate selection callback |
| `/arcify-spotlight/newtab.js` | URL preview | Integrate selection callback |
| `/arcify-spotlight/manifest.json` | Permissions | Verify `tabGroups` permission |

---

*Architecture research completed: 2026-02-03*
