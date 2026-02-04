# Stack Research: Arcify Spotlight Bug Fixes and UX Improvements

## Current Stack Analysis

### Existing Technology
- **Extension Framework**: Chrome Extension Manifest V3
- **Build System**: Vite v6.0.0 with vite-plugin-singlefile v2.3.0
- **Language**: JavaScript ES6 modules (no TypeScript)
- **Chrome APIs in Use**: tabs, storage, bookmarks, history, search, topSites, tabGroups, favicon, scripting, commands

### Architecture Patterns Already Employed
- Dependency injection via data providers (BackgroundDataProvider, BaseDataProvider)
- Service worker architecture for background script
- Content script injection with dormant activation pattern
- Message passing between content scripts and background
- Result caching with TTL (30 seconds) and debouncing (150ms)

---

## 1. Deduplication Strategies

### Current Implementation Analysis
The codebase already has deduplication in `base-data-provider.js`:

```javascript
// Current approach uses Map with normalized URLs as keys
deduplicateResults(results) {
    const seen = new Map();
    const deduplicated = [];
    for (const result of results) {
        let key = this.normalizeUrlForDeduplication(result.url);
        // ... priority-based replacement logic
    }
    return deduplicated;
}
```

### Recommended Improvements

#### A. URL Fingerprinting Enhancement
**Current Gap**: The existing `normalizeUrlForDeduplication` strips protocols and trailing slashes but misses query parameter normalization and fragment handling.

**Prescriptive Approach**:
```javascript
// Enhanced URL fingerprinting
normalizeUrlForDeduplication(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url.toLowerCase());
        // Remove fragments entirely (same page)
        urlObj.hash = '';
        // Sort query parameters for consistent comparison
        urlObj.searchParams.sort();
        // Remove common tracking parameters
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid', 'gclid'];
        trackingParams.forEach(p => urlObj.searchParams.delete(p));
        // Normalize to pathname without trailing slash
        let normalized = urlObj.hostname + urlObj.pathname.replace(/\/+$/, '');
        if (urlObj.searchParams.toString()) {
            normalized += '?' + urlObj.searchParams.toString();
        }
        return normalized;
    } catch {
        return url.toLowerCase().replace(/\/+$/, '');
    }
}
```

#### B. Title-Based Deduplication for Similar Pages
**Problem**: Same content at different URLs (e.g., mobile vs desktop, localized versions).

**Approach**: Add secondary title similarity check using Levenshtein distance:
```javascript
// Fuzzy title matching for potential duplicates
const TITLE_SIMILARITY_THRESHOLD = 0.85;

areTitlesSimilar(title1, title2) {
    const t1 = title1.toLowerCase().trim();
    const t2 = title2.toLowerCase().trim();
    if (t1 === t2) return true;

    // Simple Levenshtein ratio (consider a library for production)
    const maxLen = Math.max(t1.length, t2.length);
    const distance = levenshteinDistance(t1, t2);
    return (maxLen - distance) / maxLen >= TITLE_SIMILARITY_THRESHOLD;
}
```

#### C. Domain + Path Deduplication
**Use Case**: When the same page appears in tabs, bookmarks, and history.

**Approach**: Create composite keys:
```javascript
getDeduplicationKey(result) {
    const urlKey = this.normalizeUrlForDeduplication(result.url);
    // For same-domain results, also consider title as tiebreaker
    return `${urlKey}::${result.title?.toLowerCase().slice(0, 50) || ''}`;
}
```

### Tradeoffs

| Strategy | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| URL-only Map | Fast O(1) lookup, simple | Misses semantic duplicates | Use as primary |
| Title similarity | Catches more duplicates | O(n) comparison, false positives | Use selectively |
| Composite key | Best accuracy | Larger memory footprint | Use for small result sets |

**Recommended**: Use URL-only Map as primary with title similarity as secondary check only when URL keys differ but domains match.

---

## 2. Tab Matching and Filtering

### Current Implementation
The extension uses `chrome.tabs.query({})` and filters client-side:
```javascript
async getOpenTabsData(query = '') {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => {
        if (!tab.title || !tab.url) return false;
        if (!query) return true;
        return tab.title.toLowerCase().includes(query.toLowerCase()) ||
               tab.url.toLowerCase().includes(query.toLowerCase());
    });
}
```

### Recommended Improvements

#### A. Fuzzy Matching Algorithm
**Current Gap**: Only uses exact substring matching.

**Prescriptive Approach** - Implement weighted fuzzy scoring:
```javascript
// Fuzzy match scoring for tabs
calculateTabMatchScore(tab, query) {
    const queryLower = query.toLowerCase();
    const titleLower = tab.title?.toLowerCase() || '';
    const urlLower = tab.url?.toLowerCase() || '';
    const domain = new URL(tab.url).hostname.toLowerCase();

    let score = 0;

    // Exact title match (highest priority)
    if (titleLower === queryLower) return 100;

    // Title starts with query
    if (titleLower.startsWith(queryLower)) score += 80;
    else if (titleLower.includes(queryLower)) score += 50;

    // Domain starts with query (e.g., "git" matches github.com)
    if (domain.startsWith(queryLower)) score += 70;
    else if (domain.includes(queryLower)) score += 40;

    // URL path contains query
    if (urlLower.includes(queryLower)) score += 30;

    // Word boundary matching (e.g., "pull" matches "Pull Request")
    const words = titleLower.split(/\s+/);
    if (words.some(w => w.startsWith(queryLower))) score += 25;

    // Abbreviation matching (e.g., "gh" matches "GitHub")
    const initials = words.map(w => w[0]).join('');
    if (initials.includes(queryLower)) score += 20;

    return score;
}

// Filter and sort tabs by score
getFilteredTabs(tabs, query) {
    if (!query) return tabs;

    return tabs
        .map(tab => ({ tab, score: this.calculateTabMatchScore(tab, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ tab }) => tab);
}
```

#### B. Recent Activity Weighting
**Current**: Uses `tabLastActivity` storage but doesn't integrate into search scoring.

**Enhancement**:
```javascript
// Boost recently active tabs in search results
async getWeightedTabScore(tab, baseScore) {
    const storage = await chrome.storage.local.get('tabLastActivity');
    const activityData = storage.tabLastActivity || {};
    const lastActivity = activityData[tab.id] || 0;

    // Decay factor: recent activity within last hour gets boost
    const hoursSinceActive = (Date.now() - lastActivity) / (1000 * 60 * 60);
    const recencyBoost = Math.max(0, 20 - hoursSinceActive * 2);

    return baseScore + recencyBoost;
}
```

#### C. Tab Group Awareness
**Current Gap**: Tab groups are used for color theming but not search filtering.

**Enhancement** - Add group-aware filtering:
```javascript
// Filter tabs by group membership
async getTabsInActiveGroup(query) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
        return this.getOpenTabsData(query);
    }

    const tabs = await chrome.tabs.query({ groupId: activeTab.groupId });
    return this.getFilteredTabs(tabs, query);
}
```

---

## 3. Chrome Tab Groups API for Color Theming

### Current Implementation
The extension already retrieves space colors from storage and maps to CSS:
```javascript
// In background.js - getActiveSpaceColor handler
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!activeTab?.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    sendResponse({ success: true, color: 'purple' });
    return;
}
const activeSpace = spaces.find(space => space.id === activeTab.groupId);
```

### Recommended Improvements

#### A. Direct Tab Groups API Color Retrieval
**Current Gap**: Colors come from internal `spaces` storage, not from Chrome's Tab Groups API directly.

**Prescriptive Approach** - Use `chrome.tabGroups` API:
```javascript
// Get color directly from Chrome Tab Groups API
async getTabGroupColor(groupId) {
    if (!groupId || groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
        return 'purple'; // Default
    }

    try {
        const group = await chrome.tabGroups.get(groupId);
        return group.color; // Returns: 'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'
    } catch (error) {
        Logger.error('[TabGroups] Error getting group color:', error);
        return 'purple';
    }
}
```

#### B. Real-Time Color Updates
**Current Gap**: Color is fetched once on spotlight open; doesn't update if user changes group.

**Enhancement** - Add tab group change listener:
```javascript
// Listen for tab group color changes
chrome.tabGroups.onUpdated.addListener((group) => {
    // Broadcast color change to any open spotlight instances
    chrome.runtime.sendMessage({
        action: 'tabGroupColorUpdated',
        groupId: group.id,
        color: group.color
    });
});

// In overlay.js - handle color update
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'tabGroupColorUpdated') {
        updateAccentColor(message.color);
    }
});
```

#### C. Enhanced Color Mapping
**Current CSS color map in styling.js**:
```javascript
const defaultColorMap = {
    grey: '204, 204, 204',
    blue: '139, 179, 243',
    red: '255, 158, 151',
    yellow: '255, 226, 159',
    green: '139, 218, 153',
    pink: '251, 170, 215',
    purple: '214, 166, 255',
    cyan: '165, 226, 234'
};
```

**Recommended Enhancement** - Add color variants for better accessibility:
```javascript
const colorSystem = {
    grey: {
        base: '204, 204, 204',
        dark: '150, 150, 150',
        light: '230, 230, 230'
    },
    blue: {
        base: '139, 179, 243',
        dark: '99, 139, 203',
        light: '179, 209, 255'
    },
    // ... etc
};

// Generate CSS with full color system
generateAccentColorCSS(colorName) {
    const color = colorSystem[colorName] || colorSystem.purple;
    return `
        :root {
            --spotlight-accent-color: rgb(${color.base});
            --spotlight-accent-color-dark: rgb(${color.dark});
            --spotlight-accent-color-light: rgb(${color.light});
            --spotlight-accent-color-15: rgba(${color.base}, 0.15);
            --spotlight-accent-color-20: rgba(${color.base}, 0.2);
            --spotlight-accent-color-80: rgba(${color.base}, 0.8);
        }
    `;
}
```

### Chrome tabGroups API Reference

| Method | Purpose | Use Case |
|--------|---------|----------|
| `chrome.tabGroups.get(groupId)` | Get single group | Retrieve color for active tab's group |
| `chrome.tabGroups.query(queryInfo)` | Query groups | List all groups for filtering |
| `chrome.tabGroups.onUpdated` | Event listener | React to color/name changes |
| `chrome.tabGroups.TAB_GROUP_ID_NONE` | Constant | Check if tab is ungrouped |

**Note**: Tab Groups API requires `tabGroups` permission (already present in manifest).

---

## 4. Keyboard Navigation with URL Preview Updates

### Current Implementation
The `SelectionManager` handles navigation but doesn't broadcast selection changes:
```javascript
// selection-manager.js
moveSelection(direction) {
    // Updates selectedIndex
    // Updates visual selection CSS class
    // Scrolls item into view
}
```

### Recommended Improvements

#### A. Selection Change Callback
**Enhancement** - Add callback for selection changes:
```javascript
class SelectionManager {
    constructor(container, options = {}) {
        this.container = container;
        this.selectedIndex = 0;
        this.results = [];
        this.onSelectionChange = options.onSelectionChange || null;
    }

    moveSelection(direction) {
        const maxIndex = this.results.length - 1;
        const previousIndex = this.selectedIndex;

        if (direction === 'down') {
            this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
        } else if (direction === 'up') {
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        }

        if (this.selectedIndex !== previousIndex) {
            this.updateVisualSelection();
            this.notifySelectionChange();
        }
    }

    notifySelectionChange() {
        if (this.onSelectionChange) {
            const selected = this.getSelectedResult();
            this.onSelectionChange(selected, this.selectedIndex);
        }
    }
}
```

#### B. URL Preview Component
**New Component** - Add preview area below input:
```javascript
// In overlay.js - create preview element
const previewElement = document.createElement('div');
previewElement.className = 'arcify-spotlight-preview';
previewElement.innerHTML = `
    <span class="preview-url"></span>
    <span class="preview-action"></span>
`;
inputWrapper.appendChild(previewElement);

// Update on selection change
function handleSelectionChange(result, index) {
    const previewUrl = previewElement.querySelector('.preview-url');
    const previewAction = previewElement.querySelector('.preview-action');

    if (!result) {
        previewElement.style.display = 'none';
        return;
    }

    previewElement.style.display = 'flex';
    previewUrl.textContent = formatPreviewUrl(result.url);
    previewAction.textContent = getActionHint(result.type);
}

function formatPreviewUrl(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        // Show domain + first path segment for context
        const path = urlObj.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
        return urlObj.hostname + (path ? '/' + path : '');
    } catch {
        return url.slice(0, 50);
    }
}
```

#### C. CSS for Preview Area
```css
.arcify-spotlight-preview {
    display: flex;
    justify-content: space-between;
    padding: 8px 20px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(0, 0, 0, 0.1);
}

.arcify-spotlight-preview .preview-url {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.arcify-spotlight-preview .preview-action {
    flex-shrink: 0;
    margin-left: 12px;
    color: var(--spotlight-accent-color-80);
}
```

#### D. Performance Optimization - Throttle Preview Updates
```javascript
// Throttle preview updates to avoid excessive DOM manipulation
const throttledUpdatePreview = throttle((result) => {
    updatePreviewDisplay(result);
}, 50); // 50ms throttle

function throttle(fn, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn(...args);
        }
    };
}
```

---

## 5. Performance Considerations

### Current Optimizations
- 30-second cache TTL for search results
- 150ms debounce on async searches
- Instant suggestions (no debounce) for immediate feedback
- Single SearchEngine instance per context

### Recommended Additional Optimizations

#### A. Virtual Scrolling for Large Result Sets
**When to Use**: If result list exceeds 20+ items.

**Approach**: Implement simple virtual scrolling:
```javascript
// Only render visible items + buffer
const VISIBLE_ITEMS = 8;
const BUFFER_ITEMS = 2;

renderVirtualList(results, scrollTop, itemHeight = 44) {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - BUFFER_ITEMS);
    const endIndex = Math.min(results.length, startIndex + VISIBLE_ITEMS + BUFFER_ITEMS * 2);

    const visibleResults = results.slice(startIndex, endIndex);
    const paddingTop = startIndex * itemHeight;
    const paddingBottom = (results.length - endIndex) * itemHeight;

    return { visibleResults, paddingTop, paddingBottom };
}
```

#### B. Precomputed Search Index
**For Large Datasets**: Create inverted index for faster matching:
```javascript
class SearchIndex {
    constructor() {
        this.index = new Map(); // word -> Set of result IDs
    }

    addResult(result, id) {
        const words = this.tokenize(result.title + ' ' + result.url);
        words.forEach(word => {
            if (!this.index.has(word)) {
                this.index.set(word, new Set());
            }
            this.index.get(word).add(id);
        });
    }

    tokenize(text) {
        return text.toLowerCase()
            .split(/[\s\-_./]+/)
            .filter(w => w.length >= 2);
    }

    search(query) {
        const queryWords = this.tokenize(query);
        if (queryWords.length === 0) return [];

        // Intersection of all word matches
        let matchingIds = this.index.get(queryWords[0]) || new Set();
        for (let i = 1; i < queryWords.length; i++) {
            const wordMatches = this.index.get(queryWords[i]) || new Set();
            matchingIds = new Set([...matchingIds].filter(id => wordMatches.has(id)));
        }

        return [...matchingIds];
    }
}
```

#### C. Batch Chrome API Calls
**Current**: Multiple sequential `chrome.tabs.query()` calls.

**Optimization**: Batch and cache:
```javascript
class ChromeDataCache {
    constructor(ttl = 5000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    async getTabs() {
        return this.getCachedOrFetch('tabs', () => chrome.tabs.query({}));
    }

    async getBookmarks(query) {
        return this.getCachedOrFetch(`bookmarks:${query}`, () => chrome.bookmarks.search(query));
    }

    async getCachedOrFetch(key, fetchFn) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }

        const data = await fetchFn();
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
    }

    invalidate(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}
```

---

## 6. Libraries and Dependencies

### Current Dependencies
- `vite` v6.0.0 - Build tool
- `vite-plugin-singlefile` v2.3.0 - Bundle to single file for content scripts
- `fs-extra` v11.2.0 - Build-time file operations

### Recommended Additions

| Library | Purpose | Why Not Native |
|---------|---------|----------------|
| **None for fuzzy matching** | Use custom implementation | Small code, avoids bundle bloat |
| **None for virtual scroll** | Simple implementation sufficient | 8 items doesn't need it |

**Recommendation**: Keep zero runtime dependencies. The extension is small enough that custom implementations are preferred over external libraries to:
1. Minimize bundle size (critical for content scripts)
2. Avoid security audit requirements for third-party code
3. Maintain full control over performance characteristics

---

## Summary: Implementation Priority

### High Priority (Bug Fixes)
1. **Enhanced URL deduplication** - Add tracking parameter stripping and query normalization
2. **Tab matching improvements** - Add fuzzy scoring with word boundary matching
3. **Direct Tab Groups API** - Use `chrome.tabGroups.get()` instead of internal storage

### Medium Priority (UX Improvements)
4. **Keyboard navigation preview** - Add selection change callback and URL preview area
5. **Real-time color updates** - Add `tabGroups.onUpdated` listener
6. **Recent activity weighting** - Integrate tab activity data into search scoring

### Lower Priority (Performance)
7. **Search index** - Only if performance issues emerge with large tab counts
8. **Batch API caching** - Consider if multiple searches per session cause lag

---

## API Compatibility Notes

All recommended APIs are available in Chrome Manifest V3:
- `chrome.tabGroups` - Available since Chrome 89
- `chrome.tabs.query()` with `groupId` filter - Available since Chrome 89
- `chrome.storage.local/sync` - Stable API
- `chrome.bookmarks` - Stable API
- `chrome.history` - Stable API

No polyfills or compatibility layers needed for Chrome 89+.
