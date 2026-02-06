# Technology Stack: Arcify Bookmark Integration

**Milestone:** Arcify integration for Spotlight
**Researched:** 2026-02-05
**Confidence:** HIGH (verified against official Chrome documentation)

## Executive Summary

The Arcify bookmark integration requires Chrome bookmark APIs for folder detection and change monitoring, combined with a caching layer to avoid repeated API calls. The existing codebase already uses `BookmarkUtils` with robust folder-finding patterns. This research focuses on the specific patterns for caching bookmark data and handling real-time updates.

## Recommended Stack

### Core Chrome APIs (Already Available)

| API | Permission | Purpose | Status |
|-----|------------|---------|--------|
| `chrome.bookmarks` | `bookmarks` | Query folder structure, detect pinned/favorite tabs | Already in manifest |
| `chrome.storage.local` | `storage` | Persistent cache for bookmark data | Already in manifest |
| `chrome.storage.session` | `storage` | Fast in-memory cache for current session | Already available |

### Chrome Bookmarks API - Key Methods

| Method | Signature | Use Case |
|--------|-----------|----------|
| `getChildren(id)` | `Promise<BookmarkTreeNode[]>` | Get immediate children of Arcify folder |
| `getSubTree(id)` | `Promise<BookmarkTreeNode[]>` | Get full space hierarchy in one call |
| `search({title})` | `Promise<BookmarkTreeNode[]>` | Find Arcify folder by name |
| `get(ids[])` | `Promise<BookmarkTreeNode[]>` | Batch fetch specific bookmark nodes |

**Recommendation:** Use `getSubTree()` for initial cache load, `getChildren()` for incremental updates.

### Bookmark Event Listeners

| Event | Callback Parameters | Use Case |
|-------|---------------------|----------|
| `onCreated` | `(id, bookmark)` | New tab pinned to space |
| `onRemoved` | `(id, {parentId, index, node})` | Tab unpinned from space |
| `onMoved` | `(id, {parentId, oldParentId, index, oldIndex})` | Tab moved between spaces |
| `onChanged` | `(id, {title, url})` | Bookmark title/URL updated |

**Recommendation:** Register all four event listeners in the service worker. Invalidate cache on any event, then lazily refetch.

### Caching Strategy

| Storage Area | Quota | Persistence | Use Case |
|--------------|-------|-------------|----------|
| `chrome.storage.session` | 10 MB | Browser session only | Primary cache (fast, in-memory) |
| `chrome.storage.local` | 10 MB (unlimited with permission) | Permanent | Fallback if session unavailable |
| In-memory variables | N/A | Service worker lifetime only | NOT RECOMMENDED for MV3 |

**Recommendation:** Use `chrome.storage.session` as primary cache. It survives service worker restarts within a session but clears on browser restart (acceptable since bookmarks API is the source of truth).

## Architecture Patterns

### Recommended: Lazy Cache Invalidation

```javascript
// Pattern: Cache invalidation on bookmark events
// Service worker registers listeners at top level

// Cache key structure
const CACHE_KEY = 'arcify_bookmark_cache';

// Initialize cache on service worker startup
let cachePromise = chrome.storage.session.get(CACHE_KEY);

// Event listeners invalidate cache
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  if (isUnderArcifyFolder(bookmark.parentId)) {
    invalidateCache();
  }
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  if (isUnderArcifyFolder(removeInfo.parentId)) {
    invalidateCache();
  }
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  if (isUnderArcifyFolder(moveInfo.parentId) ||
      isUnderArcifyFolder(moveInfo.oldParentId)) {
    invalidateCache();
  }
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  // Check if bookmark is under Arcify folder
  checkAndInvalidate(id);
});

async function invalidateCache() {
  await chrome.storage.session.remove(CACHE_KEY);
  cachePromise = null;
}

async function getArcifyBookmarks() {
  // Check cache first
  if (cachePromise) {
    const cached = await cachePromise;
    if (cached[CACHE_KEY]) {
      return cached[CACHE_KEY];
    }
  }

  // Cache miss - fetch and store
  const data = await fetchArcifyBookmarkTree();
  await chrome.storage.session.set({ [CACHE_KEY]: data });
  cachePromise = Promise.resolve({ [CACHE_KEY]: data });
  return data;
}
```

### NOT Recommended: In-Memory Global Variables

```javascript
// ANTI-PATTERN for MV3 service workers
let bookmarkCache = null; // WRONG - lost on service worker termination

// Service workers terminate after 30 seconds of inactivity
// Data disappears, must refetch from scratch
```

### Folder Detection Pattern (Already Implemented)

The existing `BookmarkUtils.findArcifyFolder()` uses a robust 3-method fallback:
1. `chrome.bookmarks.search({ title: 'Arcify' })`
2. Traverse root children manually
3. Check "Other Bookmarks" specifically

**Recommendation:** Reuse this pattern. Cache the Arcify folder ID in session storage since it rarely changes.

## What NOT to Add

| Technology | Why NOT |
|------------|---------|
| IndexedDB | Overkill for bookmark metadata; chrome.storage.session is simpler and sufficient |
| External libraries (e.g., localForage) | Adds bundle size; native Chrome APIs already provide what we need |
| Polling/interval-based refresh | Wasteful; use event-driven cache invalidation instead |
| In-memory caching in service worker | MV3 service workers are ephemeral; state lost on termination |
| `chrome.storage.sync` for cache | Wrong tool; sync is for user settings, not transient cache data |

## Specific Implementation Recommendations

### 1. Folder ID Caching

Cache the Arcify folder ID separately since finding it is expensive (requires traversal):

```javascript
const ARCIFY_FOLDER_ID_KEY = 'arcify_folder_id';

async function getArcifyFolderId() {
  const cached = await chrome.storage.session.get(ARCIFY_FOLDER_ID_KEY);
  if (cached[ARCIFY_FOLDER_ID_KEY]) {
    // Verify it still exists
    try {
      await chrome.bookmarks.get(cached[ARCIFY_FOLDER_ID_KEY]);
      return cached[ARCIFY_FOLDER_ID_KEY];
    } catch {
      // Folder deleted, clear cache
    }
  }

  // Find and cache
  const folder = await BookmarkUtils.findArcifyFolder();
  if (folder) {
    await chrome.storage.session.set({ [ARCIFY_FOLDER_ID_KEY]: folder.id });
  }
  return folder?.id || null;
}
```

### 2. Distinguishing Pinned vs Favorite Tabs

Based on existing codebase analysis, the folder structure appears to be:
```
Arcify/
  Space1/
    PinnedTabs/     <- Pinned tabs (always visible)
      tab1.url
    FavoriteTabs/   <- Favorite tabs (saved but not always shown)
      tab2.url
  Space2/
    ...
```

**Recommendation:** Use subfolder title matching ("PinnedTabs", "FavoriteTabs") or rely on a naming convention the Arcify main extension uses.

### 3. Space Color Detection

Space colors come from `chrome.tabGroups` API, not bookmarks. The existing `getPinnedTabsData()` already merges space color from storage:

```javascript
const space = spaces.find(s => s.name === spaceFolder.title);
// space.color comes from chrome.tabGroups or storage
```

**Recommendation:** Continue using this pattern. Bookmarks provide structure, tab groups provide colors.

### 4. Event Handler Registration

Register bookmark event listeners at service worker top level (not inside functions):

```javascript
// background.js - TOP LEVEL (outside any function)
chrome.bookmarks.onCreated.addListener(handleBookmarkCreated);
chrome.bookmarks.onRemoved.addListener(handleBookmarkRemoved);
chrome.bookmarks.onMoved.addListener(handleBookmarkMoved);
chrome.bookmarks.onChanged.addListener(handleBookmarkChanged);
```

**Why:** Event listeners must be registered synchronously at startup. Listeners registered inside async functions may miss events.

## Performance Considerations

| Concern | Solution |
|---------|----------|
| Initial load time | Use `getSubTree()` to fetch entire Arcify hierarchy in single call |
| Frequent bookmark changes | Debounce cache invalidation (100ms delay) to batch rapid changes |
| Service worker cold start | Preload cache on `onInstalled` and `onStartup` events |
| Large bookmark trees | Cache only Arcify subfolder, not entire bookmark tree |

### Debounce Pattern for Rapid Changes

```javascript
let invalidationTimeout = null;

function scheduleInvalidation() {
  if (invalidationTimeout) {
    clearTimeout(invalidationTimeout);
  }
  invalidationTimeout = setTimeout(async () => {
    await invalidateCache();
    invalidationTimeout = null;
  }, 100);
}
```

## Integration with Existing Code

### Files to Modify

| File | Change |
|------|--------|
| `background.js` | Add bookmark event listeners at top level |
| `bookmark-utils.js` | Add caching layer around existing methods |
| `shared/data-providers/background-data-provider.js` | Use cached data in `getPinnedTabsData()` |

### Files to Create

| File | Purpose |
|------|---------|
| `arcify-cache.js` | Centralized cache management for Arcify bookmark data |

### Existing Code to Reuse

- `BookmarkUtils.findArcifyFolder()` - Robust folder detection (3-method fallback)
- `BookmarkUtils.getBookmarksFromFolderRecursive()` - Recursive traversal
- `BackgroundDataProvider.getPinnedTabsData()` - Already merges bookmarks with space data

## Verification Checklist

- [x] Chrome bookmark API patterns verified via [official documentation](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- [x] Service worker caching patterns verified via [lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [x] Storage API quotas verified via [storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [x] Event listener registration pattern confirmed for MV3
- [x] Existing codebase patterns analyzed for consistency

## Sources

- [Chrome Bookmarks API Reference](https://developer.chrome.com/docs/extensions/reference/api/bookmarks) - Official documentation (updated 2026-01-30)
- [Chrome Storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) - Official documentation
- [Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - MV3 service worker patterns
- [Local vs Sync vs Session Storage](https://dev.to/notearthian/local-vs-sync-vs-session-which-chrome-extension-storage-should-you-use-5ec8) - Storage comparison guide
