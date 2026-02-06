# Architecture Patterns: Arcify Bookmark Integration

**Domain:** Chrome Extension bookmark folder detection and caching
**Researched:** 2026-02-05
**Confidence:** HIGH (based on existing codebase patterns and Chrome API documentation)

## Executive Summary

The Arcify integration should follow the existing data provider pattern, adding a new `ArcifyProvider` that caches the Arcify folder structure in memory with event-driven invalidation. Detection logic lives in the background service worker (where Chrome APIs are available), with the cache exposed through the existing message passing infrastructure.

## Recommended Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Background Service Worker                            │
│  ┌───────────────────┐    ┌─────────────────────────────────────────────┐   │
│  │ BackgroundDataPro │    │              ArcifyProvider                 │   │
│  │     vider         │───>│  ┌────────────────────────────────────────┐ │   │
│  │                   │    │  │          In-Memory Cache                │ │   │
│  │ - getOpenTabsData │    │  │  - arcifyFolderId: string | null       │ │   │
│  │ - getBookmarksData│    │  │  - urlToSpaceMap: Map<url, SpaceInfo>  │ │   │
│  │ - getPinnedTabsD. │    │  │  - lastRefreshed: timestamp            │ │   │
│  │ - NEW: getSpaceFor│    │  └────────────────────────────────────────┘ │   │
│  │        Url()      │    │                                             │   │
│  └───────────────────┘    │  - findArcifyFolder()                       │   │
│                           │  - buildUrlToSpaceMap()                     │   │
│                           │  - getSpaceForUrl(url)                      │   │
│                           │  - invalidateCache()                        │   │
│                           └─────────────────────────────────────────────┘   │
│                                         │                                    │
│  ┌──────────────────────────────────────┼────────────────────────────────┐  │
│  │              Bookmark Event Listeners                                  │  │
│  │  chrome.bookmarks.onCreated  ──┐     │                                │  │
│  │  chrome.bookmarks.onRemoved  ──┼─────>  invalidateCache()             │  │
│  │  chrome.bookmarks.onMoved    ──┤                                      │  │
│  │  chrome.bookmarks.onChanged  ──┘                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          Message Passing
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Content Script / New Tab Page                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SpotlightMessageClient                            │    │
│  │                                                                      │    │
│  │  - getSuggestions(query, mode)  // existing                         │    │
│  │  - handleResult(result, mode)   // existing                         │    │
│  │                                                                      │    │
│  │  Results now include metadata.spaceName / metadata.spaceColor       │    │
│  │  for PINNED_TAB, BOOKMARK, HISTORY types when URL is in Arcify      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    v                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SharedSpotlightLogic                              │    │
│  │                                                                      │    │
│  │  - generateResultsHTML() // enhanced for space chip                 │    │
│  │  - formatResult() // includes space chip when present               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ArcifyProvider` | Cache Arcify folder structure, URL-to-space lookup | BookmarkUtils, Chrome bookmarks API |
| `BackgroundDataProvider` | Aggregate data from all sources, enrich results with space info | ArcifyProvider, existing providers |
| `SpotlightMessageClient` | Pass enriched results to UI | Background via chrome.runtime |
| `SharedSpotlightLogic` | Render space chips in suggestion UI | UI utilities |

## Where Detection Logic Should Live: Background Service Worker

**Recommendation:** All Arcify detection logic MUST live in the background service worker.

**Rationale:**
1. **Chrome API Access:** `chrome.bookmarks.*` APIs are only available in service worker context
2. **Single Source of Truth:** One cache instance prevents inconsistent state
3. **Event Listeners:** Bookmark events (`onCreated`, `onRemoved`, `onMoved`, `onChanged`) only fire in background
4. **Existing Pattern:** `BackgroundDataProvider` already handles all Chrome API calls, content scripts use message passing

**Anti-Pattern to Avoid:** Do NOT put detection logic in content scripts - they cannot access bookmark APIs and would require duplicating cache invalidation logic.

## Caching Strategy: In-Memory with Event-Driven Invalidation

### Why In-Memory (Not chrome.storage)

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| In-memory Map | Fast O(1) lookup, no async overhead | Lost on service worker restart | **RECOMMENDED** |
| chrome.storage.local | Persists across restarts | Async overhead on every query, storage quota | Not needed |
| No cache (query each time) | Always fresh | Too slow (100-300ms per query) | Too slow |

**Decision:** In-memory cache with lazy re-population on first query after service worker restart.

### Cache Structure

```typescript
interface SpaceInfo {
  spaceName: string;      // "Work", "Personal", etc.
  spaceColor: string;     // "blue", "purple", etc.
  spaceFolderId: string;  // Bookmark folder ID for the space
}

interface ArcifyCache {
  arcifyFolderId: string | null;           // Root Arcify folder ID
  urlToSpaceMap: Map<string, SpaceInfo>;   // URL -> Space mapping
  lastRefreshed: number;                   // Timestamp for debugging
  isBuilding: boolean;                     // Prevent concurrent rebuilds
}
```

### Cache Lifecycle

```
Service Worker Start
        │
        v
    ┌───────────────────┐
    │  Cache = null     │  (lazy initialization)
    └───────────────────┘
        │
        │  First query arrives
        v
    ┌───────────────────┐
    │  buildCache()     │
    │  - Find Arcify    │
    │  - Traverse tree  │
    │  - Build URL map  │
    └───────────────────┘
        │
        v
    ┌───────────────────┐
    │  Cache populated  │  <─────┐
    │  Queries use O(1) │        │
    │  Map lookup       │        │
    └───────────────────┘        │
        │                        │
        │  Bookmark event        │
        v                        │
    ┌───────────────────┐        │
    │  Invalidate cache │        │
    │  cache = null     │────────┘
    └───────────────────┘
```

### URL Normalization for Cache Keys

Reuse existing `normalizeUrlForDeduplication()` from `BaseDataProvider`:

```javascript
// Already exists in base-data-provider.js
normalizeUrlForDeduplication(url) {
    let normalizedUrl = url.toLowerCase();
    // Remove fragments (#section)
    const fragmentIndex = normalizedUrl.indexOf('#');
    if (fragmentIndex !== -1) {
        normalizedUrl = normalizedUrl.substring(0, fragmentIndex);
    }
    // Remove trailing slashes
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');
    // Remove protocol
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
    // Remove www.
    normalizedUrl = normalizedUrl.replace(/^www\./, '');
    return normalizedUrl;
}
```

## Event-Driven Refresh Pattern

### Chrome Bookmark Events

| Event | When Fired | Cache Action |
|-------|------------|--------------|
| `onCreated` | Bookmark/folder created | Invalidate if under Arcify tree |
| `onRemoved` | Bookmark/folder removed | Invalidate if under Arcify tree |
| `onMoved` | Bookmark moved to different parent | Invalidate if involves Arcify tree |
| `onChanged` | Title or URL changed | Invalidate if under Arcify tree |

### Smart Invalidation Strategy

**Option A: Always invalidate** (Simple, Recommended for v1.5)
- Any bookmark event triggers cache invalidation
- Cache rebuilt lazily on next query
- Simple to implement, slightly wasteful if changes are outside Arcify

**Option B: Selective invalidation** (Optimized, Future enhancement)
- Check if changed bookmark is under Arcify folder tree
- Only invalidate if relevant
- Requires parent chain traversal

**Recommendation:** Start with Option A. Bookmark events are infrequent enough that rebuilding the cache on any change is acceptable. Optimize later if profiling shows issues.

### Implementation Pattern

```javascript
// In background.js or new arcify-provider.js

class ArcifyProvider {
    constructor() {
        this.cache = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // All events invalidate cache
        chrome.bookmarks.onCreated.addListener(() => this.invalidateCache());
        chrome.bookmarks.onRemoved.addListener(() => this.invalidateCache());
        chrome.bookmarks.onMoved.addListener(() => this.invalidateCache());
        chrome.bookmarks.onChanged.addListener(() => this.invalidateCache());
    }

    invalidateCache() {
        this.cache = null;
        Logger.log('[ArcifyProvider] Cache invalidated');
    }

    async ensureCache() {
        if (this.cache) return;
        await this.buildCache();
    }

    async buildCache() {
        // Prevent concurrent builds
        if (this.isBuilding) return;
        this.isBuilding = true;

        try {
            const arcifyFolder = await BookmarkUtils.findArcifyFolder();
            if (!arcifyFolder) {
                this.cache = { urlToSpaceMap: new Map(), arcifyFolderId: null };
                return;
            }

            // Get spaces from storage to match folder names to colors
            const storage = await chrome.storage.local.get('spaces');
            const spaces = storage.spaces || [];

            // Build URL map by traversing Arcify folder tree
            const urlToSpaceMap = new Map();
            const spaceFolders = await chrome.bookmarks.getChildren(arcifyFolder.id);

            for (const spaceFolder of spaceFolders) {
                const space = spaces.find(s => s.name === spaceFolder.title);
                if (!space) continue;

                const bookmarks = await BookmarkUtils.getBookmarksFromFolderRecursive(spaceFolder.id);
                for (const bookmark of bookmarks) {
                    const normalizedUrl = this.normalizeUrl(bookmark.url);
                    urlToSpaceMap.set(normalizedUrl, {
                        spaceName: space.name,
                        spaceColor: space.color,
                        spaceFolderId: spaceFolder.id
                    });
                }
            }

            this.cache = {
                urlToSpaceMap,
                arcifyFolderId: arcifyFolder.id,
                lastRefreshed: Date.now()
            };
        } finally {
            this.isBuilding = false;
        }
    }

    async getSpaceForUrl(url) {
        await this.ensureCache();
        const normalizedUrl = this.normalizeUrl(url);
        return this.cache.urlToSpaceMap.get(normalizedUrl) || null;
    }

    normalizeUrl(url) {
        // Reuse existing normalization logic
        return BaseDataProvider.prototype.normalizeUrlForDeduplication.call(this, url);
    }
}
```

## Data Flow for Space Chip Rendering

### Query Flow

```
User types in Spotlight
        │
        v
Content Script calls chrome.runtime.sendMessage({ action: 'getSpotlightSuggestions' })
        │
        v
Background receives message
        │
        v
BackgroundDataProvider.getSpotlightSuggestions(query, mode)
        │
        ├──> getBookmarkSuggestions(query) ──> results[]
        ├──> getHistorySuggestions(query)  ──> results[]
        └──> getPinnedTabSuggestions(query)──> results[] (already have space info)
        │
        v
For each result with URL:
    spaceInfo = ArcifyProvider.getSpaceForUrl(result.url)
    if (spaceInfo) {
        result.metadata.spaceName = spaceInfo.spaceName
        result.metadata.spaceColor = spaceInfo.spaceColor
        result.metadata.isArcify = true
    }
        │
        v
Return enriched results to content script
        │
        v
SharedSpotlightLogic.generateResultsHTML(results, mode)
        │
        v
For each result:
    if (result.metadata.isArcify) {
        render space chip with spaceName and spaceColor
    }
```

### Result Enrichment Pattern

The enrichment happens in `BackgroundDataProvider.getSpotlightSuggestions()` after collecting results from all sources:

```javascript
// In BackgroundDataProvider.getSpotlightSuggestions() or base-data-provider.js

async enrichWithArcifyInfo(results) {
    for (const result of results) {
        if (!result.url) continue;

        // Skip if already has space info (pinned tabs)
        if (result.metadata?.spaceName) continue;

        const spaceInfo = await this.arcifyProvider.getSpaceForUrl(result.url);
        if (spaceInfo) {
            result.metadata = result.metadata || {};
            result.metadata.spaceName = spaceInfo.spaceName;
            result.metadata.spaceColor = spaceInfo.spaceColor;
            result.metadata.isArcify = true;
        }
    }
    return results;
}
```

### UI Rendering Pattern

In `SharedSpotlightLogic.generateResultsHTML()` or `SpotlightUtils.formatResult()`:

```javascript
// Addition to result HTML generation
static generateResultsHTML(results, mode) {
    return results.map((result, index) => {
        const formatted = SpotlightUtils.formatResult(result, mode);
        const spaceChip = result.metadata?.isArcify
            ? `<span class="arcify-space-chip" style="background: var(--chrome-${result.metadata.spaceColor}-color)">
                 ${SpotlightUtils.escapeHtml(result.metadata.spaceName)}
               </span>`
            : '';

        return `
            <button class="arcify-spotlight-result-item ${index === 0 ? 'selected' : ''}"
                    data-index="${index}">
                <img class="arcify-spotlight-result-favicon"
                     src="${SpotlightUtils.getFaviconUrl(result)}"
                     alt="favicon">
                <div class="arcify-spotlight-result-content">
                    <div class="arcify-spotlight-result-title">
                        ${SpotlightUtils.escapeHtml(formatted.title)}
                        ${spaceChip}
                    </div>
                    <div class="arcify-spotlight-result-url">${SpotlightUtils.escapeHtml(formatted.subtitle)}</div>
                </div>
                <div class="arcify-spotlight-result-action">${formatted.action}</div>
            </button>
        `;
    }).join('');
}
```

## Suggested Build Order

Build in this order to enable incremental testing:

### Phase 1: ArcifyProvider Foundation (Background Only)

1. **Create `shared/data-providers/arcify-provider.js`**
   - Basic cache structure
   - `findArcifyFolder()` (reuse from BookmarkUtils)
   - `buildCache()` with tree traversal
   - `getSpaceForUrl(url)` lookup method

2. **Add event listeners in background.js**
   - Wire up `chrome.bookmarks.on*` events
   - Call `arcifyProvider.invalidateCache()`

3. **Unit tests for ArcifyProvider**
   - Mock chrome.bookmarks API
   - Test cache build, invalidation, lookup

### Phase 2: Result Enrichment

4. **Modify BackgroundDataProvider**
   - Inject ArcifyProvider instance
   - Add `enrichWithArcifyInfo()` method
   - Call enrichment after deduplication in `getSpotlightSuggestions()`

5. **Integration tests**
   - Test that bookmark/history results get space info
   - Test that pinned tabs retain existing space info

### Phase 3: UI Rendering

6. **Update SharedSpotlightLogic**
   - Modify `generateResultsHTML()` for space chip
   - Add CSS for `.arcify-space-chip` class

7. **Update overlay.js and newtab.js styles**
   - Add space chip styling using CSS variables

8. **E2E tests**
   - Verify space chip appears for Arcify URLs
   - Verify chip color matches space color

## Anti-Patterns to Avoid

### Anti-Pattern 1: Querying Bookmarks on Every Search

**What goes wrong:** Calling `chrome.bookmarks.search()` or `getSubTree()` on every keystroke
**Why bad:** 100-300ms latency per query, degrades typing experience
**Instead:** Use cached Map with O(1) lookup, rebuild cache only on bookmark events

### Anti-Pattern 2: Caching in Content Scripts

**What goes wrong:** Maintaining separate cache in overlay.js/newtab.js
**Why bad:** Cannot listen to bookmark events, cache becomes stale, duplicated logic
**Instead:** Single cache in background service worker, access via message passing

### Anti-Pattern 3: Blocking Service Worker Startup

**What goes wrong:** Building Arcify cache synchronously on service worker start
**Why bad:** Delays extension load, service worker may timeout
**Instead:** Lazy cache population on first query

### Anti-Pattern 4: Not Normalizing URLs

**What goes wrong:** Cache misses for equivalent URLs (http vs https, with/without www)
**Why bad:** User bookmarks `https://example.com/`, history has `http://example.com/` - no match
**Instead:** Normalize all URLs before cache storage and lookup using existing `normalizeUrlForDeduplication()`

## Integration Points

### Existing Code to Modify

| File | Change | Reason |
|------|--------|--------|
| `background.js` | Add ArcifyProvider initialization and event listeners | Central coordination point |
| `background-data-provider.js` | Inject ArcifyProvider, add enrichment call | Result enrichment |
| `base-data-provider.js` | Add `enrichWithArcifyInfo()` method signature | Abstract interface |
| `shared-component-logic.js` | Update `generateResultsHTML()` for space chip | UI rendering |
| `overlay.js` | Add space chip CSS | Styling |
| `newtab.js` | Add space chip CSS | Styling |
| `search-types.js` | Document space metadata in SearchResult | Type documentation |

### New Files to Create

| File | Purpose |
|------|---------|
| `shared/data-providers/arcify-provider.js` | Cache and lookup logic |
| `tests/arcify-provider.test.js` | Unit tests for provider |

### Existing Code to Reuse

| Pattern | From | Reuse For |
|---------|------|-----------|
| `findArcifyFolder()` | `bookmark-utils.js` | Finding Arcify root folder |
| `getBookmarksFromFolderRecursive()` | `bookmark-utils.js` | Traversing folder tree |
| `normalizeUrlForDeduplication()` | `base-data-provider.js` | URL normalization |
| CSS color variables | `ui-utilities.js` | Space chip colors |
| Message passing pattern | `message-client.js` | Future: dedicated Arcify queries |

## Scalability Considerations

| Concern | At 100 bookmarks | At 1K bookmarks | At 10K bookmarks |
|---------|------------------|-----------------|------------------|
| Cache build time | < 50ms | ~200ms | ~1-2s |
| Memory usage | ~10KB | ~100KB | ~1MB |
| Lookup time | O(1) | O(1) | O(1) |
| Rebuild on event | Fine | Fine | Consider debounce |

**Note:** Most users have < 1K bookmarks in Arcify. The architecture scales well due to Map-based O(1) lookups. For extreme cases, consider debouncing rapid bookmark events (e.g., during import).

## Sources

- [Chrome Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- [MDN bookmarks.onCreated](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/onCreated)
- [MDN bookmarks.onRemoved](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/onRemoved)
- [MDN bookmarks.onChanged](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/onChanged)
- [MDN bookmarks.getSubTree](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/getSubTree)

---

*Architecture research: 2026-02-05*
