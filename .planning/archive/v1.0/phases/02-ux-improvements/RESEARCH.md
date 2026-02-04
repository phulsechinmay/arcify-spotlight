# Phase 2: UX Improvements - Research

**Researched:** 2026-02-03
**Domain:** Chrome Extension UI, CSS styling, Chrome Tab Groups API
**Confidence:** HIGH

## Summary

This research investigates three UX polish requirements for the Arcify Spotlight Chrome extension: URL preview updates during keyboard navigation, increased information density in the suggestion list, and tab group color theming. All requirements involve modifications to existing patterns already established in the codebase.

The codebase has clear architectural patterns: `SelectionManager` handles keyboard navigation, inline CSS in `overlay.js` and `newtab.js` control styling, and `background.js` handles Chrome API calls via message passing. The existing `getActiveSpaceColor` handler in `background.js` already uses the Tab Groups API pattern but retrieves color from local storage rather than directly from `chrome.tabGroups.get()`.

**Primary recommendation:** Implement all three requirements through targeted modifications to existing files - add a selection change callback to `SelectionManager`, reduce padding/height values in the inline CSS blocks, and modify the `getActiveSpaceColor` background handler to use `chrome.tabGroups.get()` directly.

## Standard Stack

The existing codebase patterns are the "stack" for this phase - no new libraries needed.

### Core Files (Modification Targets)

| File | Purpose | Requirement |
|------|---------|-------------|
| `/shared/selection-manager.js` | Keyboard navigation state | UX-01: Add selection change callback |
| `/overlay.js` | Overlay component + inline CSS | UX-01, UX-02: URL update, density |
| `/newtab.js` | New tab component + inline CSS | UX-02: Density (reference layout) |
| `/background.js` | Chrome API access | UX-03: Tab Groups API color fetch |
| `/manifest.json` | Extension permissions | UX-03: Add `tabGroups` permission |

### Supporting Files (Reference Only)

| File | Purpose | Notes |
|------|---------|-------|
| `/shared/shared-component-logic.js` | Result rendering | `generateResultsHTML()` creates result items |
| `/shared/ui-utilities.js` | Formatting utilities | `formatResult()` formats display data |
| `/shared/message-client.js` | Message passing | `getActiveSpaceColor()` pattern to follow |
| `/shared/spotlight-styles.css` | Shared CSS reference | Defines CSS class names (but not used in overlay/newtab) |

### No New Dependencies

This phase requires no new npm packages or libraries.

## Architecture Patterns

### Current URL Display Pattern (UX-01)

The URL is displayed in the `.arcify-spotlight-result-url` element within each result item. Currently, there's no mechanism to update a separate URL bar on selection change.

**Current flow:**
1. User types query
2. `handleInstantInput()` or `handleAsyncSearch()` triggers
3. `updateDisplay()` calls `SharedSpotlightLogic.updateResultsDisplay()`
4. `generateResultsHTML()` creates all items with embedded URLs
5. `SelectionManager.updateVisualSelection()` toggles `.selected` class

**Current SelectionManager (selection-manager.js lines 17-27):**
```javascript
moveSelection(direction) {
    const maxIndex = this.results.length - 1;

    if (direction === 'down') {
        this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
    } else if (direction === 'up') {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    }

    this.updateVisualSelection();
}
```

**Required pattern - Add callback support:**
```javascript
constructor(container, onSelectionChange = null) {
    this.container = container;
    this.selectedIndex = 0;
    this.results = [];
    this.onSelectionChange = onSelectionChange;  // NEW
}

moveSelection(direction) {
    const oldIndex = this.selectedIndex;  // NEW
    const maxIndex = this.results.length - 1;

    if (direction === 'down') {
        this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
    } else if (direction === 'up') {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    }

    this.updateVisualSelection();

    // Notify callback if selection changed
    if (this.onSelectionChange && oldIndex !== this.selectedIndex) {  // NEW
        this.onSelectionChange(this.getSelectedResult(), this.selectedIndex);
    }
}
```

### Current CSS Structure (UX-02)

Both `overlay.js` and `newtab.js` define inline CSS in their initialization functions. The CSS is NOT shared - each file has its own copy.

**Current overlay.js density values (lines 196-220):**
```css
.arcify-spotlight-results {
    max-height: 270px;  /* Limits visible items */
    padding: 8px 0;
}

.arcify-spotlight-result-item {
    padding: 12px 24px 12px 20px;
    min-height: 44px;
}
```

**Calculation for 6 visible items:**
- Current: `270px / 44px = ~6.1 items` (close to goal)
- Issue: Content height per item is actually larger due to internal padding
- Actual visible: ~4-5 items with current padding

**Target values for 6+ visible items:**
```css
.arcify-spotlight-results {
    max-height: 288px;  /* 6 * 48px */
    padding: 4px 0;     /* Reduced from 8px */
}

.arcify-spotlight-result-item {
    padding: 8px 20px 8px 16px;  /* Reduced from 12px 24px 12px 20px */
    min-height: 40px;  /* Reduced from 44px */
}

.arcify-spotlight-result-content {
    min-height: 28px;  /* Reduced from 32px */
}

.arcify-spotlight-result-title {
    margin: 0 0 1px 0;  /* Reduced from 2px */
}
```

### Current Color Theming Pattern (UX-03)

**Existing background.js handler (lines 302-325):**
```javascript
} else if (message.action === 'getActiveSpaceColor') {
    (async () => {
        try {
            const spacesResult = await chrome.storage.local.get('spaces');
            const spaces = spacesResult.spaces || [];

            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!activeTab || !activeTab.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
                sendResponse({ success: true, color: 'purple' });
                return;
            }

            const activeSpace = spaces.find(space => space.id === activeTab.groupId);

            if (activeSpace && activeSpace.color) {
                sendResponse({ success: true, color: activeSpace.color });
            } else {
                sendResponse({ success: true, color: 'purple' });
            }
        } catch (error) {
            // ... error handling
        }
    })();
    return true;
}
```

**Problem:** This reads from `chrome.storage.local.get('spaces')` which is a custom data structure from a separate Arcify extension. For standalone Spotlight, we should use `chrome.tabGroups.get()` directly.

**Required pattern - Use Tab Groups API directly:**
```javascript
} else if (message.action === 'getActiveSpaceColor') {
    (async () => {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Check if tab is in a group
            if (!activeTab || !activeTab.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
                sendResponse({ success: true, color: 'purple' });
                return;
            }

            // Get color directly from Tab Groups API
            try {
                const group = await chrome.tabGroups.get(activeTab.groupId);
                sendResponse({ success: true, color: group.color || 'purple' });
            } catch (groupError) {
                // Group might not exist or API unavailable
                sendResponse({ success: true, color: 'purple' });
            }
        } catch (error) {
            Logger.error('[Background] Error getting active space color:', error);
            sendResponse({ success: false, error: error.message, color: 'purple' });
        }
    })();
    return true;
}
```

### Color CSS Variables Pattern

**Current color application (ui-utilities.js lines 230-267):**
```javascript
static async getAccentColorCSS(spaceColor) {
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
    // ...generates CSS variables
}
```

**Note:** The `defaultColorMap` matches Chrome's tab group colors. Need to add `orange` to match the full Tab Groups API Color enum:
```javascript
orange: '255, 176, 103'  // Add this
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL preview UI | New URL bar component | Update input placeholder or existing text | Simplest solution, minimal code |
| Scroll management | Custom scroll virtualization | CSS `max-height` + `overflow-y: auto` | Already working, just adjust values |
| Tab group colors | Color conversion logic | Chrome Tab Groups API returns string color name | API does the work |
| Selection callbacks | Event system | Simple callback function | One callback is sufficient |

## Common Pitfalls

### Pitfall 1: Tab Groups Permission Missing

**What goes wrong:** `chrome.tabGroups.get()` throws "Cannot read properties of undefined"
**Why it happens:** `tabGroups` permission not in manifest.json
**How to avoid:** Add `"tabGroups"` to permissions array in manifest.json
**Warning signs:** Error only appears when tab is in a group

**Verification:**
```javascript
// Check if API is available before using
if (chrome.tabGroups && typeof chrome.tabGroups.get === 'function') {
    const group = await chrome.tabGroups.get(activeTab.groupId);
}
```

### Pitfall 2: TAB_GROUP_ID_NONE Check

**What goes wrong:** API call fails when tab is not in any group
**Why it happens:** `groupId` is `-1` (TAB_GROUP_ID_NONE) when tab is ungrouped
**How to avoid:** Always check `groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE`
**Warning signs:** Error "No group with id: -1"

**Current code already handles this (background.js line 310):**
```javascript
if (!activeTab || !activeTab.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    sendResponse({ success: true, color: 'purple' });
    return;
}
```

### Pitfall 3: CSS Specificity in Content Scripts

**What goes wrong:** Overlay styles don't apply or get overridden by page styles
**Why it happens:** Page CSS has higher specificity than injected styles
**How to avoid:** Use `!important` declarations (already done in overlay.js)
**Warning signs:** Styling works on new tab page but not on other sites

**Current pattern (overlay.js lines 150-179):**
```css
#arcify-spotlight-dialog .arcify-spotlight-input {
    flex: 1 !important;
    background: transparent !important;
    /* ... all properties use !important */
}
```

### Pitfall 4: Selection Callback on Initial Load

**What goes wrong:** URL preview not shown for first selected item
**Why it happens:** `updateResults()` sets `selectedIndex = 0` but doesn't trigger callback
**How to avoid:** Call callback after setting initial selection
**Warning signs:** URL preview only updates after first arrow key press

**Fix in updateResults:**
```javascript
updateResults(newResults) {
    this.results = newResults;
    this.selectedIndex = 0;
    this.updateVisualSelection();

    // Trigger callback for initial selection
    if (this.onSelectionChange && this.results.length > 0) {
        this.onSelectionChange(this.getSelectedResult(), this.selectedIndex);
    }
}
```

### Pitfall 5: Saved Tab Groups Update Error

**What goes wrong:** Error when trying to update a saved tab group
**Why it happens:** Chrome prevents modification of saved tab groups
**How to avoid:** Only READ from Tab Groups API, don't update
**Warning signs:** "saved tab groups cannot be updated" error

**This phase only reads colors, so this is not a concern.**

## Code Examples

### UX-01: SelectionManager with Callback

**File: `/shared/selection-manager.js`**

```javascript
export class SelectionManager {
    constructor(container, onSelectionChange = null) {
        this.container = container;
        this.selectedIndex = 0;
        this.results = [];
        this.onSelectionChange = onSelectionChange;
    }

    updateResults(newResults) {
        this.results = newResults;
        this.selectedIndex = 0;
        this.updateVisualSelection();

        // Notify callback for initial selection
        if (this.onSelectionChange && this.results.length > 0) {
            this.onSelectionChange(this.getSelectedResult(), this.selectedIndex);
        }
    }

    moveSelection(direction) {
        const oldIndex = this.selectedIndex;
        const maxIndex = this.results.length - 1;

        if (direction === 'down') {
            this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
        } else if (direction === 'up') {
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        }

        this.updateVisualSelection();

        // Notify callback if selection changed
        if (this.onSelectionChange && oldIndex !== this.selectedIndex) {
            this.onSelectionChange(this.getSelectedResult(), this.selectedIndex);
        }
    }

    // ... rest unchanged
}
```

### UX-01: Overlay URL Preview Update

**File: `/overlay.js`** (in activateSpotlight function)

```javascript
// Add URL preview callback
const handleSelectionChange = (result, index) => {
    if (result && result.url) {
        input.placeholder = result.url;
    } else if (result && result.title) {
        input.placeholder = result.title;
    }
};

const selectionManager = new SelectionManager(resultsContainer, handleSelectionChange);
```

### UX-02: Density CSS Values

**Apply to both `/overlay.js` and `/newtab.js` inline CSS:**

```css
.arcify-spotlight-results {
    max-height: 288px;  /* Changed from 270px - fits 6 items */
    overflow-y: auto;
    padding: 4px 0;     /* Changed from 8px 0 */
    scroll-behavior: smooth;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.arcify-spotlight-result-item {
    display: flex;
    align-items: center;
    padding: 8px 20px 8px 16px;  /* Changed from 12px 24px 12px 20px */
    min-height: 40px;            /* Changed from 44px */
    cursor: pointer;
    /* ... rest unchanged */
}

.arcify-spotlight-result-content {
    flex: 1;
    min-width: 0;
    min-height: 24px;  /* Changed from 32px */
    /* ... rest unchanged */
}

.arcify-spotlight-result-title {
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    margin: 0 0 1px 0;  /* Changed from 2px */
    /* ... rest unchanged */
}
```

### UX-03: Tab Groups API Color Fetch

**File: `/background.js`** (replace getActiveSpaceColor handler)

```javascript
} else if (message.action === 'getActiveSpaceColor') {
    (async () => {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Check if tab exists and is in a group
            if (!activeTab || !activeTab.groupId ||
                activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
                sendResponse({ success: true, color: 'purple' });
                return;
            }

            // Fetch color directly from Tab Groups API
            try {
                const group = await chrome.tabGroups.get(activeTab.groupId);
                sendResponse({ success: true, color: group.color || 'purple' });
            } catch (groupError) {
                // Group may have been closed or API unavailable
                Logger.error('[Background] Error fetching tab group:', groupError);
                sendResponse({ success: true, color: 'purple' });
            }
        } catch (error) {
            Logger.error('[Background] Error getting active space color:', error);
            sendResponse({ success: false, error: error.message, color: 'purple' });
        }
    })();
    return true;
}
```

### UX-03: Manifest Permission

**File: `/manifest.json`** (add to permissions array)

```json
{
  "permissions": [
    "tabs",
    "tabGroups",  // ADD THIS
    "storage",
    "bookmarks",
    "commands",
    "favicon",
    "scripting",
    "search",
    "topSites",
    "history"
  ]
}
```

### UX-03: Add Orange to Color Map

**File: `/shared/ui-utilities.js`** (in getAccentColorCSS)

```javascript
const defaultColorMap = {
    grey: '204, 204, 204',
    blue: '139, 179, 243',
    red: '255, 158, 151',
    yellow: '255, 226, 159',
    green: '139, 218, 153',
    pink: '251, 170, 215',
    purple: '214, 166, 255',
    cyan: '165, 226, 234',
    orange: '255, 176, 103'  // ADD THIS - matches Chrome's tab group orange
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chrome.storage.local` for space colors | `chrome.tabGroups.get()` API | This phase | Direct API access, no dependency on separate storage |
| 44px min-height items | 40px min-height items | This phase | 6+ visible items |
| No selection change callback | Callback on SelectionManager | This phase | URL preview updates |

**Stable APIs:**
- `chrome.tabGroups` API - Stable since Chrome 89, no recent breaking changes
- `chrome.tabs.query()` with `groupId` - Stable since Chrome 89
- CSS custom properties (`--spotlight-accent-color`) - Well supported

## Open Questions

None - all requirements have clear implementation paths based on existing codebase patterns.

## Sources

### Primary (HIGH confidence)
- [Chrome Tab Groups API](https://developer.chrome.com/docs/extensions/reference/api/tabGroups) - Official documentation, verified 2026-01-30
- Codebase analysis: `/overlay.js`, `/newtab.js`, `/background.js`, `/shared/selection-manager.js`

### Secondary (MEDIUM confidence)
- Chrome Tab Groups Color enum: grey, blue, red, yellow, green, pink, purple, cyan, orange (from official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All files identified in existing codebase
- Architecture: HIGH - Patterns extracted from working code
- Pitfalls: HIGH - Based on existing code patterns and official API docs

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable APIs, CSS patterns)
