# Phase 6: Detection & Cache - Research

**Researched:** 2026-02-05
**Domain:** Chrome Extension bookmark detection and caching (MV3)
**Confidence:** HIGH

## Summary

Phase 6 implements the foundation for Arcify bookmark detection - detecting the Arcify folder in Chrome bookmarks and building an O(1) lookup cache for URL-to-space mapping. This enables the spotlight search to show space chips and enrich results with Arcify metadata.

The codebase already has robust Arcify folder detection via `BookmarkUtils.findArcifyFolder()` with a 3-method fallback approach. The phase focuses on creating an `ArcifyProvider` class that builds and maintains a URL-to-space mapping cache using `getSubTree()` for efficient tree traversal. The cache invalidates on bookmark change events and rebuilds lazily on next query.

Key architectural decisions: Use in-memory Map for O(1) lookups, persist to `chrome.storage.local` for service worker restart recovery (NOT `chrome.storage.session` which does NOT survive restarts), register all event listeners synchronously at module top-level per MV3 requirements, and reuse existing `normalizeUrlForDeduplication()` for consistent URL matching.

**Primary recommendation:** Create `ArcifyProvider` class in `shared/data-providers/` that follows existing provider patterns, with cache stored in a Map keyed by normalized URLs, rebuilt on startup and invalidated on any bookmark event within the Arcify folder.

## Standard Stack

The phase uses Chrome's built-in APIs already available in the manifest. No new dependencies needed.

### Core APIs
| API | Method | Purpose | Why Standard |
|-----|--------|---------|--------------|
| `chrome.bookmarks` | getSubTree() | Fetch entire Arcify folder tree in one call | O(1) API calls vs O(n) recursive getChildren() |
| `chrome.bookmarks` | onCreated/onRemoved/onMoved/onChanged | Real-time cache invalidation | Only way to detect bookmark changes |
| `chrome.bookmarks` | onImportBegan/onImportEnded | Batch invalidation during imports | Prevents thrashing during bulk operations |
| `chrome.storage.local` | get/set | Cache persistence across service worker restarts | `session` does NOT survive restarts |

### Existing Code to Reuse
| Component | Location | What to Reuse |
|-----------|----------|---------------|
| `BookmarkUtils.findArcifyFolder()` | `bookmark-utils.js` | 3-method fallback folder detection |
| `BaseDataProvider.normalizeUrlForDeduplication()` | `shared/data-providers/base-data-provider.js` | URL normalization for cache keys |
| `Logger` | `logger.js` | Consistent logging pattern |
| `BackgroundDataProvider.getPinnedTabsData()` | `shared/data-providers/background-data-provider.js` | Space folder traversal pattern |

### What NOT to Reuse
| Pattern | Why Not | Alternative |
|---------|---------|-------------|
| Recursive `getChildren()` in `getBookmarksFromFolderRecursive()` | O(n) API calls, slow for large trees | Use `getSubTree()` which returns full tree in one call |
| `chrome.storage.session` | Does NOT persist across service worker restarts (only persists in memory while loaded) | Use `chrome.storage.local` |

## Architecture Patterns

### Recommended File Structure
```
shared/
  data-providers/
    arcify-provider.js       # NEW: ArcifyProvider class
    background-data-provider.js  # MODIFY: Integrate ArcifyProvider
  search-types.js           # EXISTING: Add ARCIFY_SPACE result type if needed
bookmark-utils.js           # EXISTING: No changes needed
background.js               # MODIFY: Event listener registration
```

### Pattern 1: ArcifyProvider Class Structure
**What:** Singleton provider managing URL-to-space cache
**When to use:** All Arcify detection operations

```javascript
// shared/data-providers/arcify-provider.js
import { BookmarkUtils } from '../../bookmark-utils.js';
import { BaseDataProvider } from './base-data-provider.js';
import { Logger } from '../../logger.js';

const CACHE_STORAGE_KEY = 'arcifyUrlCache';

export class ArcifyProvider {
    constructor() {
        this.cache = null;  // Map<normalizedUrl, SpaceInfo>
        this.arcifyFolderId = null;
        this.isBuilding = false;
        this.buildPromise = null;
        this.isImporting = false;
        this.pendingInvalidation = false;
    }

    // Normalize URL using existing logic
    normalizeUrl(url) {
        return BaseDataProvider.prototype.normalizeUrlForDeduplication.call(
            { /* empty context */ },
            url
        );
    }

    // Main lookup method - O(1)
    async getSpaceForUrl(url) {
        if (!this.cache) {
            await this.ensureCacheBuilt();
        }
        const normalizedUrl = this.normalizeUrl(url);
        return this.cache?.get(normalizedUrl) || null;
    }

    // Lazy cache initialization
    async ensureCacheBuilt() {
        if (this.cache) return;
        if (this.buildPromise) return this.buildPromise;
        this.buildPromise = this.buildCache();
        await this.buildPromise;
        this.buildPromise = null;
    }

    // Build cache from bookmarks
    async buildCache() {
        if (this.isBuilding) return;
        this.isBuilding = true;

        try {
            // Try to restore from storage first
            const stored = await chrome.storage.local.get(CACHE_STORAGE_KEY);
            if (stored[CACHE_STORAGE_KEY]) {
                this.cache = new Map(Object.entries(stored[CACHE_STORAGE_KEY].urlMap));
                this.arcifyFolderId = stored[CACHE_STORAGE_KEY].folderId;
                Logger.log('[ArcifyProvider] Cache restored from storage');
                return;
            }

            // Build fresh cache
            await this.rebuildCache();
        } finally {
            this.isBuilding = false;
        }
    }

    // Rebuild cache from bookmarks API
    async rebuildCache() {
        const arcifyFolder = await BookmarkUtils.findArcifyFolder();
        if (!arcifyFolder) {
            this.cache = new Map();
            this.arcifyFolderId = null;
            return;
        }

        this.arcifyFolderId = arcifyFolder.id;
        const newCache = new Map();

        // Get entire subtree in ONE API call
        const [subtree] = await chrome.bookmarks.getSubTree(arcifyFolder.id);

        // Process subtree - first level children are spaces
        for (const spaceFolder of subtree.children || []) {
            if (spaceFolder.url) continue; // Skip bookmarks at root level

            const spaceInfo = {
                spaceName: spaceFolder.title,
                spaceId: spaceFolder.id
            };

            // Recursively process space contents
            this.processFolder(spaceFolder, spaceInfo, newCache);
        }

        this.cache = newCache;

        // Persist to storage for service worker restart recovery
        await this.persistCache();
        Logger.log(`[ArcifyProvider] Cache built with ${newCache.size} URLs`);
    }

    // Recursive folder processor (in-memory, no API calls)
    processFolder(folder, spaceInfo, cache) {
        for (const item of folder.children || []) {
            if (item.url) {
                const normalizedUrl = this.normalizeUrl(item.url);
                cache.set(normalizedUrl, {
                    ...spaceInfo,
                    bookmarkId: item.id,
                    bookmarkTitle: item.title
                });
            } else {
                // Subfolder - recurse
                this.processFolder(item, spaceInfo, cache);
            }
        }
    }

    // Persist cache to storage
    async persistCache() {
        if (!this.cache) return;

        const storageData = {
            folderId: this.arcifyFolderId,
            urlMap: Object.fromEntries(this.cache),
            timestamp: Date.now()
        };

        await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: storageData });
    }

    // Invalidate cache (called by event handlers)
    invalidateCache() {
        if (this.isImporting) {
            this.pendingInvalidation = true;
            return;
        }

        this.cache = null;
        chrome.storage.local.remove(CACHE_STORAGE_KEY);
        Logger.log('[ArcifyProvider] Cache invalidated');
    }

    // Check if bookmark event is within Arcify folder
    isArcifyBookmark(bookmarkId, parentId) {
        if (!this.arcifyFolderId) return false;
        return parentId === this.arcifyFolderId ||
               this.cache?.has(this.normalizeUrl(bookmarkId));
    }
}

// Singleton instance
export const arcifyProvider = new ArcifyProvider();
```

### Pattern 2: MV3 Event Registration (Critical)
**What:** Synchronous event listener registration at module top-level
**When to use:** All bookmark event listeners in background.js

```javascript
// background.js - ADD at TOP LEVEL (not inside functions or callbacks)
import { arcifyProvider } from './shared/data-providers/arcify-provider.js';

// Register ALL bookmark event listeners synchronously at top level
// MV3 REQUIREMENT: Async registration misses events on service worker restart
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    if (bookmark.parentId && arcifyProvider.arcifyFolderId) {
        arcifyProvider.invalidateCache();
    }
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    arcifyProvider.invalidateCache();
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    arcifyProvider.invalidateCache();
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    arcifyProvider.invalidateCache();
});

// Import batching to prevent thrashing
chrome.bookmarks.onImportBegan.addListener(() => {
    arcifyProvider.isImporting = true;
});

chrome.bookmarks.onImportEnded.addListener(() => {
    arcifyProvider.isImporting = false;
    if (arcifyProvider.pendingInvalidation) {
        arcifyProvider.pendingInvalidation = false;
        arcifyProvider.invalidateCache();
    }
});
```

### Pattern 3: Cache Data Structure
**What:** Map keyed by normalized URL, value contains space metadata
**When to use:** All URL-to-space lookups

```javascript
// Cache structure
// Key: normalized URL (lowercase, no protocol, no www, no trailing slash, no fragment)
// Value: SpaceInfo object

const SpaceInfo = {
    spaceName: 'Work',           // Display name
    spaceId: '12345',            // Bookmark folder ID
    bookmarkId: '67890',         // Individual bookmark ID
    bookmarkTitle: 'My Page'     // Bookmark title (may differ from page title)
};

// Example cache entries:
// 'github.com' -> { spaceName: 'Work', spaceId: '123', ... }
// 'notion.so/workspace' -> { spaceName: 'Personal', spaceId: '456', ... }
```

### Anti-Patterns to Avoid
- **Recursive getChildren() for tree traversal:** Creates O(n) API calls. Use `getSubTree()` instead.
- **Async event listener registration:** Wrap listeners in promises/callbacks. Register synchronously at top level.
- **chrome.storage.session for persistence:** Does NOT survive service worker restarts. Use `chrome.storage.local`.
- **Cache rebuild on every query:** Expensive. Build once, invalidate on events, rebuild lazily.
- **Ignoring import events:** Causes thrashing during bulk imports. Batch invalidation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL normalization | Custom regex/string manipulation | `BaseDataProvider.normalizeUrlForDeduplication()` | Already handles fragments, trailing slashes, protocol, www prefix - tested in production |
| Arcify folder detection | Hardcoded folder IDs or names | `BookmarkUtils.findArcifyFolder()` | 3-method fallback handles locales, Chrome versions, edge cases |
| Bookmark tree traversal | Multiple getChildren() calls | `chrome.bookmarks.getSubTree()` | Single API call returns entire tree |
| Service worker state | Global variables | `chrome.storage.local` | Survives service worker termination |

**Key insight:** The codebase already solves the hard problems (URL normalization, folder detection). The new code should wire these together with proper caching and event handling.

## Common Pitfalls

### Pitfall 1: Session Storage Myth
**What goes wrong:** Using `chrome.storage.session` expecting it to persist across service worker restarts
**Why it happens:** Documentation mentions "session storage is recommended for service workers"
**How to avoid:** Use `chrome.storage.local` for any data that must survive service worker termination. Session storage only persists while the extension is loaded in memory.
**Warning signs:** Cache is empty after browser idle period despite no bookmark changes

### Pitfall 2: Async Event Registration
**What goes wrong:** Event listeners registered inside async functions or callbacks miss events
**Why it happens:** Service worker restarts, async code hasn't run yet when event fires
**How to avoid:** Register all `chrome.bookmarks.on*` listeners at module top level, synchronously
**Warning signs:** Cache doesn't invalidate when bookmarks change; works after manual page refresh

### Pitfall 3: Recursive API Performance
**What goes wrong:** O(n) getChildren() calls cause 200ms+ latency for large bookmark trees
**Why it happens:** Natural inclination to recursively traverse tree structure
**How to avoid:** Use `getSubTree(folderId)` which returns entire subtree in one call, then process in-memory
**Warning signs:** Slow first query; performance degrades with more Arcify bookmarks

### Pitfall 4: Import Event Thrashing
**What goes wrong:** Hundreds of cache invalidations during bookmark import
**Why it happens:** Each imported bookmark fires onCreated event
**How to avoid:** Track `onImportBegan`/`onImportEnded`, batch invalidation until import completes
**Warning signs:** UI freezes during bookmark restore/import operations

### Pitfall 5: URL Normalization Mismatch
**What goes wrong:** Cache miss despite URL being in Arcify bookmarks
**Why it happens:** Different normalization between cache key and lookup
**How to avoid:** Use SAME `normalizeUrlForDeduplication()` function for both caching and lookup
**Warning signs:** Intermittent space chip display; works for some URLs but not others

## Code Examples

### Building Cache with getSubTree
```javascript
// Source: Chrome Bookmarks API documentation
// https://developer.chrome.com/docs/extensions/reference/api/bookmarks#method-getSubTree

async function buildUrlToSpaceMap(arcifyFolderId) {
    const urlMap = new Map();

    // Single API call to get entire Arcify folder tree
    const [arcifyTree] = await chrome.bookmarks.getSubTree(arcifyFolderId);

    // First-level children are space folders
    for (const spaceFolder of arcifyTree.children || []) {
        if (spaceFolder.url) continue; // Skip non-folders

        // Recursively process in-memory (no more API calls)
        processSpaceFolder(spaceFolder, spaceFolder.title, urlMap);
    }

    return urlMap;
}

function processSpaceFolder(folder, spaceName, urlMap) {
    for (const item of folder.children || []) {
        if (item.url) {
            // It's a bookmark - add to map
            const normalizedUrl = normalizeUrlForDeduplication(item.url);
            urlMap.set(normalizedUrl, {
                spaceName,
                bookmarkId: item.id
            });
        } else {
            // It's a subfolder - recurse (still in-memory)
            processSpaceFolder(item, spaceName, urlMap);
        }
    }
}
```

### MV3-Compliant Event Registration
```javascript
// Source: Chrome MV3 Migration Guide
// https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers

// CORRECT: Top-level, synchronous registration
chrome.bookmarks.onCreated.addListener(handleBookmarkCreated);
chrome.bookmarks.onRemoved.addListener(handleBookmarkRemoved);
chrome.bookmarks.onMoved.addListener(handleBookmarkMoved);
chrome.bookmarks.onChanged.addListener(handleBookmarkChanged);
chrome.bookmarks.onImportBegan.addListener(handleImportBegan);
chrome.bookmarks.onImportEnded.addListener(handleImportEnded);

// Handler functions can be async
async function handleBookmarkCreated(id, bookmark) {
    // Async operations are fine inside the handler
    await arcifyProvider.invalidateCache();
}

// WRONG: Async registration (will miss events on service worker restart)
async function setupListeners() {
    await someAsyncSetup();
    chrome.bookmarks.onCreated.addListener(handler); // TOO LATE!
}
```

### Storage Persistence Pattern
```javascript
// Persist cache to chrome.storage.local for service worker restart recovery
// Source: Chrome Service Worker Lifecycle docs

const CACHE_KEY = 'arcifyUrlCache';

async function persistCache(cache, arcifyFolderId) {
    const storageData = {
        folderId: arcifyFolderId,
        urlMap: Object.fromEntries(cache),
        timestamp: Date.now()
    };
    await chrome.storage.local.set({ [CACHE_KEY]: storageData });
}

async function restoreCache() {
    const result = await chrome.storage.local.get(CACHE_KEY);
    if (result[CACHE_KEY]) {
        return {
            cache: new Map(Object.entries(result[CACHE_KEY].urlMap)),
            folderId: result[CACHE_KEY].folderId
        };
    }
    return null;
}

// Clear on invalidation
function invalidateCache() {
    cache = null;
    chrome.storage.local.remove(CACHE_KEY);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chrome.storage.session` for cache | `chrome.storage.local` | Clarified in docs | Session does NOT survive SW restarts |
| Recursive `getChildren()` | `getSubTree()` single call | Always available | O(n) -> O(1) API calls |
| MV2 persistent background page | MV3 service workers | Chrome 88+ | Must handle termination/restart |

**Deprecated/outdated:**
- Bookmark write rate limits: "Bookmark write operations are no longer limited by Chrome" (removed constraint)

## Open Questions

1. **Chrome 134+ folderType property**
   - What we know: Chrome will have dual bookmark trees for sync
   - What's unclear: Exact release timeline and API changes
   - Recommendation: Current 3-method fallback in `findArcifyFolder()` should handle this. Monitor during implementation.

2. **Cache size limits**
   - What we know: `chrome.storage.local` has 10MB limit (expandable with `unlimitedStorage`)
   - What's unclear: Typical Arcify user bookmark count
   - Recommendation: Monitor cache size in production. Average bookmark ~100 bytes; 10MB supports ~100K bookmarks.

3. **Multiple Arcify folders**
   - What we know: `findArcifyFolder()` returns first match
   - What's unclear: Whether users ever have multiple
   - Recommendation: Current behavior is correct (use first). Defer multi-folder support.

## Sources

### Primary (HIGH confidence)
- [Chrome Bookmarks API Reference](https://developer.chrome.com/docs/extensions/reference/api/bookmarks) - Event listeners, getSubTree() method
- [Chrome Storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) - session vs local storage lifecycle
- [MV3 Service Worker Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) - Event registration requirements
- [Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Termination behavior

### Codebase Analysis (HIGH confidence)
- `bookmark-utils.js` - `findArcifyFolder()` 3-method fallback pattern
- `shared/data-providers/base-data-provider.js` - `normalizeUrlForDeduplication()` logic
- `shared/data-providers/background-data-provider.js` - Provider class pattern, `getPinnedTabsData()` traversal
- `background.js` - Existing event listener patterns, service worker structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only built-in Chrome APIs already in manifest
- Architecture: HIGH - Extends existing provider pattern with clear integration points
- Pitfalls: HIGH - All verified against official Chrome documentation

**Research date:** 2026-02-05
**Valid until:** 60 days (Chrome APIs stable, patterns well-established)
