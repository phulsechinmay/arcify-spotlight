# Pitfalls: Chrome Extension Spotlight Improvements

**Research Date:** 2026-02-03
**Research Type:** Project Research - Pitfalls Dimension
**Milestone Context:** Bug fixes and UX improvements for command palette deduplication, tab matching, and dynamic theming

---

## Overview

This document catalogs common mistakes, performance traps, and Chrome API gotchas specific to implementing command palette improvements in Chrome Extensions. Each pitfall includes warning signs, prevention strategies, and which development phase should address it.

**Key Areas Covered:**
- URL deduplication edge cases
- Tab matching strategies
- Dynamic color theming
- Keyboard event handling
- Chrome Bookmarks API quirks
- Manifest V3 service worker constraints

---

## 1. Deduplication Pitfalls

### 1.1 URL Normalization Inconsistencies

**What Breaks:** Same URL appears multiple times in suggestions because of URL variations.

**Root Cause:** URLs can represent the same page but differ in:
- Protocol (`http://` vs `https://`)
- Trailing slashes (`example.com/` vs `example.com`)
- WWW prefix (`www.example.com` vs `example.com`)
- Query parameters (`?utm_source=...`)
- Fragment identifiers (`#section`)
- URL encoding (`%20` vs space)
- Case sensitivity in paths

**Current Code Gap (base-data-provider.js lines 479-495):**
```javascript
normalizeUrlForDeduplication(url) {
    let normalizedUrl = url.toLowerCase();
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
    normalizedUrl = normalizedUrl.replace(/^www\./, '');
    return normalizedUrl;
}
```
This misses query parameters and fragments.

**Warning Signs:**
- User sees "github.com/repo" and "github.com/repo/" as separate items
- Same page appears from both history and open tabs
- Search results contain multiple entries for the same YouTube video with different timestamps

**Prevention Strategy:**
- Strip query parameters UNLESS the site is known to use them for page identity (YouTube `?v=`, Google Search `?q=`)
- Create a URL identity fingerprint that handles common variations
- Consider implementing a domain-specific normalization registry

**Phase:** Bug Fixes - This directly causes the duplicate items issue mentioned in requirements.

---

### 1.2 Type-Based Deduplication Priority Errors

**What Breaks:** Wrong item version kept during deduplication (e.g., keeping history entry when open tab exists).

**Root Cause:** When same URL appears from multiple sources (tab, bookmark, history), the deduplication logic must prioritize correctly:
1. Open tab (can switch directly)
2. Pinned tab (has space context)
3. Bookmark (user-curated)
4. History (ephemeral)

**Current Code Risk (base-data-provider.js lines 460-473):**
The deduplication uses `getResultPriority()` based on type scores, but if processing order differs from priority order, the wrong item may be seen first.

**Warning Signs:**
- User clicks a history result but expected to switch to the already-open tab
- Pinned tab metadata (space, color) lost because bookmark version was kept
- Tab switching fails because history entry has no `tabId`

**Prevention Strategy:**
- Sort results by priority BEFORE deduplication, not after
- Or use a Map that always replaces lower-priority with higher-priority
- Add integration tests that verify: tab > pinned > bookmark > history

**Phase:** Bug Fixes - Core to "correctly show open tabs" requirement.

---

### 1.3 Async Timing Race in Deduplication

**What Breaks:** Different sources return at different times, causing duplicates to slip through or wrong version to win.

**Root Cause:** Current code (base-data-provider.js lines 56-127) fetches tabs, pinned tabs, bookmarks, history, etc. with individual try-catch blocks. If one source returns faster and is processed before another, the deduplication key may not exist yet.

**Warning Signs:**
- Intermittent duplicate items (sometimes appears, sometimes not)
- Fast networks show fewer duplicates than slow networks
- Refresh/re-search clears duplicates that appeared initially

**Prevention Strategy:**
- Use `Promise.all()` to wait for all sources before ANY deduplication
- Alternatively, implement a two-pass approach: collect all, then deduplicate
- Current implementation already does this but error handling could cause partial results

**Phase:** Bug Fixes - Stability concern.

---

### 1.4 Case Sensitivity in Title-Based Deduplication

**What Breaks:** Same conceptual item with different title casing appears twice.

**Root Cause:** For search queries and items without URLs, deduplication falls back to title matching. "Search for 'React'" vs "Search for 'react'" would be treated as different.

**Current Code (base-data-provider.js lines 441-447):**
```javascript
} else if (result.type === 'search-query') {
    key = `search:${result.title}`;  // Case-sensitive!
}
```

**Warning Signs:**
- Multiple search suggestions with same query but different capitalization
- Autocomplete showing duplicates after user types different cases

**Prevention Strategy:**
- Normalize title case for deduplication keys
- `key = `search:${result.title.toLowerCase()}``

**Phase:** Bug Fixes - Minor polish item.

---

## 2. Tab Matching Pitfalls

### 2.1 Substring vs Fuzzy Matching Confusion

**What Breaks:** User types partial match that logically should find a tab but doesn't, or wrong tab is matched.

**Root Cause:** Current implementation (background-data-provider.js lines 27-28) uses simple `includes()` for matching:
```javascript
return tab.title.toLowerCase().includes(query.toLowerCase()) ||
       tab.url.toLowerCase().includes(query.toLowerCase());
```

This fails for:
- Typos ("githu" doesn't match "github")
- Word reordering ("API chrome" doesn't match "Chrome API")
- Common abbreviations ("js" might not match "JavaScript")

**Warning Signs:**
- User searches "gith" expecting GitHub tabs, sees nothing
- Long tab titles with keywords at the end rank lower than shorter irrelevant tabs
- User complains "I know that tab is open but search doesn't find it"

**Prevention Strategy:**
- Implement weighted fuzzy matching (Levenshtein distance or similar)
- Priority: exact start > word start > contains > fuzzy
- Consider implementing acronym matching (JS -> JavaScript)

**Phase:** UX Improvements - Enhance existing tab matching.

---

### 2.2 URL Matching False Positives

**What Breaks:** Unrelated tabs match because URL contains common strings.

**Root Cause:** URL includes() matching catches too much:
- Searching "google" matches every tab because analytics scripts contain "google"
- Searching "api" matches many sites with "/api/" in paths
- Searching "login" matches CDN URLs with "login" in query params

**Warning Signs:**
- Search for brand name returns many unrelated sites
- Technical terms match infrastructure URLs in tabs
- Results seem random or poorly ranked

**Prevention Strategy:**
- Weight title matches higher than URL matches (current scoring does this)
- Only match URL domain/path, not query parameters
- Consider URL-specific search syntax (e.g., "url:github.com")

**Phase:** UX Improvements - Better relevance tuning.

---

### 2.3 Tab ID Stale Reference

**What Breaks:** User selects a tab from suggestions, but it no longer exists.

**Root Cause:** Chrome tab IDs are ephemeral and can be reused. Between suggestion generation and user selection:
- Tab may have been closed
- Tab ID may have been reused for a new tab
- Window may have been closed

**Current Code Risk (search-engine.js lines 102-115):**
```javascript
await chrome.tabs.update(result.metadata.tabId, { active: true });
```
This will throw if tab ID is invalid.

**Warning Signs:**
- Clicking "Switch to Tab" shows error or does nothing
- User sees tab in results but clicking opens wrong tab
- Console shows "No tab with id: X" errors

**Prevention Strategy:**
- Verify tab exists before switching: `chrome.tabs.get(tabId)` first
- Graceful fallback: open URL in new tab if original tab gone
- Add timestamp to results, re-validate if result is "stale" (>30s old)

**Phase:** Bug Fixes - Reliability concern.

---

### 2.4 Cross-Window Tab Matching

**What Breaks:** Tab exists but in a different window, causing focus issues.

**Root Cause:** `chrome.tabs.update()` makes a tab active, but doesn't focus its window. Current code (search-engine.js lines 103-105) handles this but silently fails if `windowId` is missing.

**Warning Signs:**
- User clicks tab result, nothing seems to happen (tab activated in background window)
- Tab switching works sometimes, not others
- User has to manually switch windows after selecting result

**Prevention Strategy:**
- Always store and use `windowId` in tab metadata
- Always call `chrome.windows.update()` after tab activation
- Consider showing window indicator in suggestions UI

**Phase:** Bug Fixes - Already partially implemented, needs verification.

---

## 3. Dynamic Color Theming Pitfalls

### 3.1 Async Color Fetch Race Condition

**What Breaks:** Spotlight shows wrong color briefly, then updates (flicker), or color never updates.

**Root Cause:** Current implementation (overlay.js lines 580-601) fetches color asynchronously AFTER showing UI:
```javascript
dialog.showModal();  // Show with default purple
// ... later ...
const realActiveSpaceColor = await SpotlightMessageClient.getActiveSpaceColor();
```

**Warning Signs:**
- Purple flash before correct color appears
- Color transition visible to user (feels sluggish)
- Sometimes spotlight stays purple when it shouldn't

**Prevention Strategy:**
- Pre-cache active space color in background script
- Listen for tab group changes to update cached color
- Consider blocking UI briefly (<100ms) rather than showing wrong color

**Phase:** UX Improvements - Polish item.

---

### 3.2 Tab Group API Missing/Unavailable

**What Breaks:** Color theming fails entirely or shows wrong fallback.

**Root Cause:** `chrome.tabGroups` API may not be available or tab may not be in a group (`groupId === -1` or `TAB_GROUP_ID_NONE`).

**Current Code (background.js lines 310-313):**
```javascript
if (!activeTab || !activeTab.groupId || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    sendResponse({ success: true, color: 'purple' });
    return;
}
```

**Warning Signs:**
- Spotlight always shows purple regardless of actual space color
- Color changes unexpectedly when user moves tab between groups
- Console errors about undefined tabGroups

**Prevention Strategy:**
- Defensive check for `chrome.tabGroups` existence
- Handle `groupId === -1` and `groupId === undefined` separately
- Consider showing no accent color (neutral) for ungrouped tabs

**Phase:** Bug Fixes - Reliability concern.

---

### 3.3 Color Override Storage Sync Timing

**What Breaks:** User's custom color overrides not applied, or applied inconsistently.

**Root Cause:** Color overrides stored in `chrome.storage.sync` may not be loaded when spotlight opens. The `styling.js` file fetches synchronously inside an async function but `chrome.storage.sync.get()` may be slow.

**Warning Signs:**
- Custom colors work after extension restart but not on first open
- Colors flash between default and custom
- Different behavior in incognito vs normal mode

**Prevention Strategy:**
- Cache color overrides in background script on startup
- Listen for `chrome.storage.onChanged` to update cache
- Pass cached colors to spotlight via activation message

**Phase:** UX Improvements - Polish item.

---

### 3.4 CSS Custom Property Transition Glitches

**What Breaks:** Color transitions don't animate smoothly or cause layout shifts.

**Root Cause:** CSS custom properties (variables) don't animate by default. The current approach (overlay.js lines 93-98) tries to transition them:
```css
transition: --spotlight-accent-color 0.3s ease,
           --spotlight-accent-color-15 0.3s ease,
           ...
```
This doesn't work in all browsers as custom properties aren't animatable.

**Warning Signs:**
- Colors snap instead of transitioning
- Different behavior in Chrome vs Edge
- Layout jumps during color change

**Prevention Strategy:**
- Use `@property` CSS rule to register animatable custom properties
- Or transition on actual color properties, not CSS variables
- Test across Chromium versions (88+ per requirements)

**Phase:** UX Improvements - Polish item.

---

## 4. Keyboard Event Handling Pitfalls

### 4.1 Selection State Desync

**What Breaks:** Visual selection and actual selection diverge, causing wrong item to be activated on Enter.

**Root Cause:** `SelectionManager` tracks `selectedIndex` internally, but DOM could be updated independently. If results change while user is navigating, indices may not match.

**Current Code Risk (selection-manager.js lines 11-15):**
```javascript
updateResults(newResults) {
    this.results = newResults;
    this.selectedIndex = 0;  // Reset to first!
    this.updateVisualSelection();
}
```

**Warning Signs:**
- User presses Down, Down, Enter, gets first result instead of third
- Async results update resets selection unexpectedly
- Pressing Enter immediately after typing selects wrong item

**Prevention Strategy:**
- Preserve selection when results update if same item still exists
- Use unique result IDs instead of indices for selection tracking
- Debounce updates to avoid mid-navigation resets

**Phase:** Bug Fixes - Race condition concern from CONCERNS.md.

---

### 4.2 Double Input Event Firing

**What Breaks:** Search fires twice, causing flicker or duplicate results.

**Root Cause:** Input event handlers can fire multiple times due to:
- Browser input event + composition events (IME input)
- Debounce timeouts stacking instead of replacing
- Both `input` and `keyup` events triggering search

**Current Code (overlay.js line 482):**
```javascript
input.addEventListener('input', SharedSpotlightLogic.createInputHandler(...));
```
Plus separate keydown handler could potentially conflict.

**Warning Signs:**
- Results flicker/refresh multiple times per keystroke
- Asian language input (Chinese, Japanese, Korean) causes issues
- Performance degrades with rapid typing

**Prevention Strategy:**
- Use single event source for search triggering
- Implement proper IME composition handling (`compositionstart/end` events)
- Clear pending debounce before starting new one (current code does this)

**Phase:** Bug Fixes - Performance concern.

---

### 4.3 Focus Management Across Contexts

**What Breaks:** Keyboard input stops working, or events go to wrong element.

**Root Cause:** Content script spotlight exists in page context. Page JavaScript may:
- Steal focus with `document.activeElement`
- Capture keyboard events before spotlight
- Manipulate DOM in ways that break spotlight focus

**Warning Signs:**
- Arrow keys stop working on some websites
- Enter key triggers page action instead of spotlight action
- Input field loses focus unexpectedly

**Prevention Strategy:**
- Use Shadow DOM for complete isolation (significant refactor)
- Aggressive focus management: re-focus input on any suspicious events
- Use `stopPropagation` and `preventDefault` consistently

**Phase:** Bug Fixes - Partial mitigation, full fix in future refactor.

---

### 4.4 Escape Key Conflicts

**What Breaks:** Pressing Escape doesn't close spotlight, or closes other things too.

**Root Cause:** Many pages have their own Escape handlers (modals, search bars, etc.). Browser also uses Escape for fullscreen exit.

**Current Code (shared-component-logic.js lines 118-126):**
```javascript
case 'Escape':
    if (onEscape) {
        e.preventDefault();
        e.stopPropagation();
        onEscape(e);
    }
    break;
```

**Warning Signs:**
- Pressing Escape closes spotlight AND page's modal
- Escape doesn't work on certain sites (YouTube, Google Docs)
- Double-Escape needed to close spotlight

**Prevention Strategy:**
- Use `stopImmediatePropagation()` for Escape key
- Consider capture phase event listener (`{ capture: true }`)
- Verify spotlight is actually open before handling Escape

**Phase:** UX Improvements - Robustness item.

---

## 5. Chrome Bookmarks API Pitfalls

### 5.1 Arcify Folder Detection Fragility

**What Breaks:** Pinned tabs feature fails because Arcify folder not found.

**Root Cause:** The 3-method fallback approach (bookmark-utils.js lines 25-100) assumes:
- Folder is named exactly "Arcify" (case-sensitive)
- Folder exists and hasn't been deleted
- Standard Chrome bookmark structure (IDs like "0", "1", "2")

**Warning Signs:**
- Pinned tabs show as empty even when they exist
- Extension works for new users but not existing users
- Works on one machine but not another (synced bookmarks)

**Prevention Strategy:**
- Store Arcify folder ID in `chrome.storage.local` after first find
- Auto-recreate folder if missing (with migration of existing data)
- Add user-facing error state: "Arcify folder not found, click to repair"

**Phase:** Integration - Feature requires stable folder detection.

---

### 5.2 Recursive Traversal Performance

**What Breaks:** Spotlight becomes slow with large bookmark hierarchies.

**Root Cause:** `getBookmarksFromFolderRecursive()` (bookmark-utils.js lines 111-148) calls `chrome.bookmarks.getChildren()` for each subfolder, creating N+1 query pattern.

**Current Code:**
```javascript
const subBookmarks = await this.getBookmarksFromFolderRecursive(item.id, options);
```
This is called inside a loop, waiting for each recursion.

**Warning Signs:**
- Spotlight takes 500ms+ to show results
- CPU spikes when opening spotlight
- Performance degrades over time as user adds more bookmarks

**Prevention Strategy:**
- Use `chrome.bookmarks.getSubTree()` instead (single API call)
- Cache bookmark structure with TTL (already noted in CONCERNS.md)
- Lazy-load deep bookmark hierarchies

**Phase:** UX Improvements - Performance optimization.

---

### 5.3 Bookmark Sync Race Conditions

**What Breaks:** Bookmark changes not reflected in spotlight, or spotlight shows stale data.

**Root Cause:** Chrome syncs bookmarks across devices asynchronously. Changes made on one device may not be visible to spotlight for seconds or minutes.

**Warning Signs:**
- User adds bookmark on phone, doesn't appear in spotlight on desktop
- Pinned tab deleted on one device still shows on another
- Bookmark operations fail with "bookmark not found" errors

**Prevention Strategy:**
- Listen to `chrome.bookmarks.onChanged/onCreated/onRemoved`
- Invalidate cache on any bookmark event
- Show "syncing" indicator if operation depends on recent changes

**Phase:** Integration - Cross-device reliability.

---

### 5.4 isUnderArcifyFolder Inaccuracy

**What Breaks:** Regular bookmarks excluded from search, or Arcify bookmarks leak into regular search.

**Root Cause:** Current implementation (bookmark-utils.js lines 477-482) uses a heuristic:
```javascript
return bookmark.parentId && (bookmark.parentId === arcifyFolderId ||
       bookmark.parentId.startsWith(arcifyFolderId));
```
This `startsWith` check is incorrect - bookmark IDs are numeric strings, not hierarchical paths.

**Warning Signs:**
- Some Arcify pinned tabs appear in regular bookmark search
- Regular bookmarks with coincidental parent IDs are excluded
- Inconsistent behavior depending on folder creation order

**Prevention Strategy:**
- Walk up the parent chain to definitively check ancestry
- Cache the set of all Arcify subfolder IDs
- Use `chrome.bookmarks.get(parentId)` recursively

**Phase:** Bug Fixes - Affects deduplication correctness.

---

## 6. Manifest V3 Service Worker Pitfalls

### 6.1 Service Worker Termination

**What Breaks:** Background operations fail because service worker was terminated.

**Root Cause:** Manifest V3 service workers terminate after ~5 minutes of inactivity. Long-running operations or delayed callbacks will fail.

**Current Code Risk (background.js line 24):**
```javascript
const spotlightOpenTabs = new Set();  // In-memory state!
```
This state is lost when service worker terminates.

**Warning Signs:**
- Spotlight close messages fail after period of inactivity
- Tab tracking becomes inaccurate
- Operations that worked earlier fail after waiting

**Prevention Strategy:**
- Move critical state to `chrome.storage.local`
- Use `chrome.storage.session` for session-only state (MV3 feature)
- Re-initialize state in service worker startup

**Phase:** Bug Fixes - Reliability concern.

---

### 6.2 Message Response Timeout

**What Breaks:** Spotlight hangs waiting for response that never comes.

**Root Cause:** If service worker terminates while processing a message, `sendResponse` is never called. Content script waits indefinitely.

**Current Code (overlay.js uses `SpotlightMessageClient`):**
No explicit timeout on message sending.

**Warning Signs:**
- Spotlight shows "Loading..." forever
- UI becomes unresponsive
- Works after page refresh but not after extension update

**Prevention Strategy:**
- Add timeout wrapper to all `chrome.runtime.sendMessage` calls
- Implement retry logic with exponential backoff
- Show error state after timeout: "Connection lost, press Escape to retry"

**Phase:** Bug Fixes - Critical reliability item.

---

### 6.3 Module Import Errors

**What Breaks:** Background script fails to start due to import errors.

**Root Cause:** ES6 module imports in service workers can fail if:
- Circular dependencies exist
- Import path typos
- Module throws during initialization

Service worker failure = entire extension fails.

**Warning Signs:**
- Extension icon grayed out
- All extension features non-functional
- Console shows import/module errors

**Prevention Strategy:**
- Test thoroughly after any import changes
- Use build-time validation of import paths
- Wrap module initialization in try-catch with fallback

**Phase:** Bug Fixes - Build/deploy validation.

---

## 7. Performance Pitfalls

### 7.1 N+1 Query Pattern

**What Breaks:** Spotlight becomes unusably slow with many data sources.

**Root Cause:** Multiple locations in codebase make sequential API calls:
- `getPinnedTabsData` (background-data-provider.js): One API call per space folder
- `getBookmarksFromFolderRecursive`: One API call per subfolder
- Auto-archive (arcify/background.js): One `chrome.tabs.get()` per tab

**Warning Signs:**
- Spotlight takes 200ms+ to show initial results
- Performance degrades linearly with more tabs/bookmarks
- CPU/memory spikes during spotlight activation

**Prevention Strategy:**
- Batch API calls where possible
- Use bulk APIs (`getSubTree` instead of `getChildren` + recursion)
- Implement result streaming (show partial results immediately)

**Phase:** UX Improvements - Performance optimization.

---

### 7.2 Memory Leaks from Event Listeners

**What Breaks:** Extension memory grows over time, eventually causing slowdowns or crashes.

**Root Cause:** Content scripts create event listeners that may not be cleaned up:
- `chrome.runtime.onMessage.addListener` (overlay.js line 42)
- DOM event listeners on dialog/input

**Current Code (overlay.js lines 524-536):**
```javascript
function closeSpotlight() {
    dialog.close();
    setTimeout(() => {
        dialog.parentNode.removeChild(dialog);
        styleSheet.parentNode.removeChild(styleSheet);
    }, 200);
}
```
DOM removed but message listeners may persist.

**Warning Signs:**
- Memory usage increases with each spotlight open/close
- Duplicate message handlers responding to single message
- Old spotlights "ghost" responding after close

**Prevention Strategy:**
- Track and remove all listeners on cleanup
- Use `AbortController` for listener cleanup
- Verify cleanup with Chrome DevTools memory profiler

**Phase:** Bug Fixes - Stability concern.

---

### 7.3 Cache Invalidation Timing

**What Breaks:** Results show stale data, or cache never helps performance.

**Root Cause:** Current caching (search-engine.js lines 25-28):
```javascript
this.DEBOUNCE_DELAY = 150;
this.CACHE_TTL = 30000;  // 30 seconds
```

30 seconds may be too long (stale tabs) or too short (no benefit for repeated searches).

**Warning Signs:**
- User closes tab, still appears in spotlight results
- Same search twice shows different results
- Cache hit rate very low (no performance benefit)

**Prevention Strategy:**
- Invalidate cache on relevant Chrome events (tab close, bookmark change)
- Use shorter TTL for volatile data (tabs), longer for stable (bookmarks)
- Consider query-specific caching strategies

**Phase:** UX Improvements - Performance tuning.

---

### 7.4 DOM Thrashing During Updates

**What Breaks:** UI feels janky, especially during rapid typing.

**Root Cause:** Each keystroke potentially triggers full results DOM rebuild:
```javascript
// shared-component-logic.js line 85
resultsContainer.innerHTML = html;
```

This forces browser to:
1. Parse HTML string
2. Build DOM nodes
3. Calculate styles
4. Layout
5. Paint

**Warning Signs:**
- Visible flicker during typing
- Input lag on lower-end devices
- High CPU usage during search

**Prevention Strategy:**
- Implement incremental DOM updates (diff current vs new results)
- Use `requestAnimationFrame` for batching
- Consider virtual scrolling for long result lists

**Phase:** UX Improvements - Performance optimization.

---

## 8. Integration Pitfalls

### 8.1 Extension-to-Extension Communication

**What Breaks:** Spotlight can't activate pinned tabs in Arcify extension.

**Root Cause:** Current code (background.js line 386-388):
```javascript
chrome.runtime.sendMessage(message);  // Broadcast to all extensions
```
This relies on Arcify extension listening for the right message format.

**Warning Signs:**
- Pinned tab activation does nothing
- Works when both extensions installed, fails otherwise
- Extension update breaks communication

**Prevention Strategy:**
- Use explicit extension ID in `sendMessage`
- Define stable message contract/versioning
- Graceful degradation if other extension not installed

**Phase:** Integration - Arcify coordination.

---

### 8.2 URL Preview Sync with Selection

**What Breaks:** URL bar doesn't update when user navigates with keyboard.

**Root Cause:** SelectionManager updates visual selection but doesn't notify parent about URL changes. URL bar update must be triggered separately.

**Warning Signs:**
- User navigates with arrow keys, URL bar shows old value
- Selection and URL bar show different items
- Enter activates different item than URL bar shows

**Prevention Strategy:**
- Add callback to SelectionManager for selection changes
- Update URL preview in same handler as visual selection
- Consider making URL bar reflect selected result's URL

**Phase:** UX Improvements - Specific requirement item.

---

## Summary by Phase

### Bug Fixes (Stability First)
1. **URL Normalization** - Fix deduplication for URL variations
2. **Type Priority Deduplication** - Ensure tab > pinned > bookmark > history
3. **Tab ID Validation** - Verify tabs exist before switching
4. **Tab Group API Checks** - Handle missing/unavailable API
5. **Selection State Sync** - Prevent desync during updates
6. **Service Worker State** - Persist critical state properly
7. **Message Timeouts** - Add timeout handling to prevent hangs
8. **Memory Leak Cleanup** - Properly remove event listeners
9. **isUnderArcifyFolder Fix** - Correct parent chain checking

### UX Improvements (Polish Second)
1. **Fuzzy Tab Matching** - Better search relevance
2. **URL Matching Refinement** - Reduce false positives
3. **Color Fetch Optimization** - Reduce/eliminate color flicker
4. **CSS Transitions** - Smooth color animations
5. **Escape Key Robustness** - Work reliably on all pages
6. **Bookmark Traversal Performance** - Use bulk APIs
7. **Cache Invalidation** - Event-driven cache clearing
8. **DOM Update Optimization** - Incremental rendering
9. **URL Preview Sync** - Update on selection change

### Integration (Features Last)
1. **Arcify Folder Recovery** - Auto-repair if missing
2. **Cross-Extension Communication** - Stable Arcify coordination
3. **Bookmark Sync Handling** - Cross-device reliability

---

*Pitfalls research completed: 2026-02-03*
*Based on codebase analysis of arcify-spotlight extension*
