---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - test/mocks/chrome.js
  - test/unit/arcify-provider.test.js
  - test/unit/space-chip-ui.test.js
  - test/unit/arcify-enrichment.test.js
autonomous: true

must_haves:
  truths:
    - "ArcifyProvider cache builds correctly from bookmark subtree and returns O(1) lookups"
    - "ArcifyProvider gracefully handles missing Arcify folder (empty cache, no errors)"
    - "ArcifyProvider cache invalidation works, including import batching deferral"
    - "enrichWithArcifyInfo injects space metadata into results with matching URLs"
    - "enrichWithArcifyInfo skips results that already have spaceName (pinned tabs)"
    - "enrichWithArcifyInfo returns results unchanged when Arcify folder not found"
    - "generateSpaceChipHTML returns correct chip HTML for results with spaceName"
    - "generateSpaceChipHTML returns empty string for results without spaceName"
    - "getChipColors returns correct bg/text pairs for all 9 Chrome tab group colors"
    - "getChipColors falls back to grey for unknown color names"
    - "generateSpaceChipHTML truncates long space names at 18 chars with ellipsis"
    - "formatResult returns correct action text for Arcify-enriched open tabs and pinned tabs"
  artifacts:
    - path: "test/unit/arcify-provider.test.js"
      provides: "Unit tests for ArcifyProvider class"
    - path: "test/unit/space-chip-ui.test.js"
      provides: "Unit tests for space chip HTML generation, chip colors, and action text formatting"
    - path: "test/unit/arcify-enrichment.test.js"
      provides: "Unit tests for enrichWithArcifyInfo pipeline in BaseDataProvider"
    - path: "test/mocks/chrome.js"
      provides: "Extended chrome mock with getSubTree, tabGroups.query, storage.local.remove"
  key_links:
    - from: "test/unit/arcify-provider.test.js"
      to: "shared/data-providers/arcify-provider.js"
      via: "Direct import of ArcifyProvider class"
      pattern: "import.*ArcifyProvider"
    - from: "test/unit/arcify-enrichment.test.js"
      to: "shared/data-providers/base-data-provider.js"
      via: "Tests enrichWithArcifyInfo method"
      pattern: "enrichWithArcifyInfo"
    - from: "test/unit/space-chip-ui.test.js"
      to: "shared/ui-utilities.js"
      via: "Tests generateSpaceChipHTML and getChipColors"
      pattern: "generateSpaceChipHTML|getChipColors"
---

<objective>
Add comprehensive unit test coverage for all Phase 8 (Space Chip UI) features: ArcifyProvider cache/lookup, enrichment pipeline, space chip HTML generation, chip color mapping, action text for Arcify tab types, and graceful degradation when Arcify folder is absent.

Purpose: The v1.5 Arcify Integration milestone added significant new functionality (Phases 6-8) without test coverage. These tests validate the core Arcify detection/cache, enrichment pipeline, and UI chip generation logic.

Output: 3 new test files covering ArcifyProvider, enrichment pipeline, and space chip UI utilities, plus extended chrome mocks.
</objective>

<context>
@shared/data-providers/arcify-provider.js
@shared/data-providers/base-data-provider.js
@shared/ui-utilities.js
@shared/search-types.js
@bookmark-utils.js
@test/mocks/chrome.js
@test/setup.js
@vitest.config.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend chrome mocks and add ArcifyProvider unit tests</name>
  <files>test/mocks/chrome.js, test/unit/arcify-provider.test.js</files>
  <action>
**1. Extend chrome mock (`test/mocks/chrome.js`):**

Add missing Chrome API mocks needed by ArcifyProvider tests:

- `chrome.bookmarks.getSubTree`: `vi.fn().mockResolvedValue([])` -- used by ArcifyProvider.rebuildCache()
- `chrome.tabGroups.query`: `vi.fn().mockResolvedValue([])` -- used by BackgroundDataProvider.getOpenTabsData() (already used in integration tests via background.js import, but missing from mock)
- `chrome.storage.local.remove`: `vi.fn().mockResolvedValue(undefined)` -- used by ArcifyProvider.invalidateCache()

Add corresponding `.mockClear()` calls in `resetChromeMocks()` for each new mock.

**2. Create `test/unit/arcify-provider.test.js`:**

Test the ArcifyProvider class in isolation. Import `ArcifyProvider` (the class, not the singleton) to create fresh instances per test. The tests need `vi.resetModules()` in beforeEach since ArcifyProvider uses a singleton export.

Test structure:

```
describe('ArcifyProvider')
  describe('normalizeUrl')
    - normalizes URL using BaseDataProvider logic (lowercase, strip fragments, trailing slash, protocol, www)
    - handles empty/null input

  describe('getSpaceForUrl')
    - returns space info for cached URL
    - returns null for URL not in cache
    - triggers cache build on first call if cache is null
    - normalizes URL before lookup (https://WWW.Example.COM/ matches http://example.com)

  describe('rebuildCache')
    - builds cache from bookmark subtree with correct space metadata
    - handles nested subfolders within space folders
    - assigns grey fallback color when space not found in storage
    - handles missing Arcify folder gracefully (empty cache, arcifyFolderId null)
    - persists cache to chrome.storage.local after build

  describe('processFolder')
    - processes bookmarks in a folder and adds to cache
    - recurses into subfolders
    - skips items without URLs (non-bookmark folder children that somehow have no children)

  describe('invalidateCache')
    - sets cache to null and removes from storage
    - defers invalidation during import (isImporting=true sets pendingInvalidation)
    - does not defer when not importing

  describe('hasData')
    - returns true when cache and folderId exist
    - returns false when cache is null
    - returns false when folderId is null
```

For `rebuildCache` tests, mock the bookmark tree structure:
```javascript
// Mock BookmarkUtils.findArcifyFolder to return a folder
// Mock chrome.bookmarks.getSubTree to return:
[{
  id: 'arcify-folder',
  children: [
    {
      id: 'space-1', title: 'Work', // space folder
      children: [
        { id: 'b1', title: 'GitHub', url: 'https://github.com' },
        { id: 'b2', title: 'Jira', url: 'https://jira.atlassian.com' },
        { id: 'subfolder-1', title: 'Docs', children: [
          { id: 'b3', title: 'Wiki', url: 'https://wiki.example.com' }
        ]}
      ]
    },
    {
      id: 'space-2', title: 'Personal',
      children: [
        { id: 'b4', title: 'Gmail', url: 'https://mail.google.com' }
      ]
    }
  ]
}]

// Mock chrome.storage.local.get for spaces:
{ spaces: [
  { name: 'Work', color: 'blue' },
  { name: 'Personal', color: 'green' }
]}
```

Use `vi.mock('../../bookmark-utils.js', ...)` to mock `BookmarkUtils.findArcifyFolder`. Use the chrome mock's `bookmarks.getSubTree` for the subtree. Each test should create a `new ArcifyProvider()` instance to avoid state leakage between tests.

Important: The `normalizeUrl` method calls `BaseDataProvider.prototype.normalizeUrlForDeduplication.call({}, url)`. This should work without mocking since it's pure logic. If it causes import issues, mock the BaseDataProvider import.
  </action>
  <verify>
Run `npx vitest run test/unit/arcify-provider.test.js` -- all tests pass. Expect ~15-18 tests.
  </verify>
  <done>
- Chrome mock extended with getSubTree, tabGroups.query, storage.local.remove
- ArcifyProvider tests cover: URL normalization, cache build from subtree, O(1) lookup, nested folders, grey color fallback, missing Arcify folder, cache invalidation, import batching deferral, hasData checks
  </done>
</task>

<task type="auto">
  <name>Task 2: Add enrichment pipeline and space chip UI tests</name>
  <files>test/unit/arcify-enrichment.test.js, test/unit/space-chip-ui.test.js</files>
  <action>
**1. Create `test/unit/arcify-enrichment.test.js`:**

Test `enrichWithArcifyInfo()` on BaseDataProvider. Since BaseDataProvider is abstract (data fetchers throw), create a minimal concrete subclass for testing or call the method directly on a BaseDataProvider instance (the enrichment method doesn't use abstract methods).

The enrichment method lazy-loads arcifyProvider via dynamic import. For unit tests, pre-set `this.arcifyProvider` on the instance to avoid the dynamic import:

```javascript
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';
import { SearchResult, ResultType } from '../../shared/search-types.js';

// Create a test instance with a mock arcifyProvider
const createProvider = (mockArcify) => {
  const provider = new BaseDataProvider();
  provider.arcifyProvider = mockArcify;
  return provider;
};
```

Test structure:

```
describe('BaseDataProvider.enrichWithArcifyInfo')
  - enriches results with Arcify space metadata when URL matches
  - does not modify results when URL has no match (spaceInfo is null)
  - skips results that already have spaceName (pinned tabs with existing space info)
  - skips results without URL (search queries, etc.)
  - returns results unchanged when arcifyProvider.hasData() is false
  - handles multiple results, enriching only matching ones
  - adds isArcify flag, spaceName, spaceId, bookmarkId, bookmarkTitle, spaceColor to metadata
  - defaults spaceColor to 'grey' when spaceInfo has no color
  - creates metadata object if result has none
```

Mock arcifyProvider:
```javascript
const mockArcify = {
  ensureCacheBuilt: vi.fn().mockResolvedValue(undefined),
  hasData: vi.fn().mockReturnValue(true),
  getSpaceForUrl: vi.fn().mockImplementation(async (url) => {
    const urlMap = {
      'https://github.com': { spaceName: 'Work', spaceId: 's1', bookmarkId: 'b1', bookmarkTitle: 'GitHub', spaceColor: 'blue' },
      'https://mail.google.com': { spaceName: 'Personal', spaceId: 's2', bookmarkId: 'b4', bookmarkTitle: 'Gmail', spaceColor: 'green' }
    };
    return urlMap[url] || null;
  })
};
```

**2. Create `test/unit/space-chip-ui.test.js`:**

Test the UI utility methods for space chip rendering and action text formatting.

Import SpotlightUtils directly. Note: ui-utilities.js imports from search-types.js and logger.js. The Logger might need mocking if it has side effects; otherwise direct import should work.

Test structure:

```
describe('SpotlightUtils.getChipColors')
  - returns correct bg/text for each of the 9 Chrome colors (grey, blue, red, yellow, green, pink, purple, cyan, orange)
  - falls back to grey for unknown color name
  - falls back to grey for undefined/null input
  - all bg values use rgba with 0.15 opacity
  - all text values use full rgb

describe('SpotlightUtils.generateSpaceChipHTML')
  - returns chip HTML with space name and color styling for result with spaceName
  - returns empty string for result without spaceName in metadata
  - returns empty string for result with null metadata
  - returns empty string for result with empty metadata
  - truncates space names longer than 18 characters with ellipsis
  - does not truncate space names 18 characters or shorter
  - escapes HTML special characters in space name
  - uses spaceColor from metadata for chip styling
  - falls back to grey when no spaceColor in metadata
  - generates chip from groupName when spaceName is absent but groupName is present
  - prefers groupColor over spaceColor when both present
  - sets title attribute to full (untruncated) space name

describe('SpotlightUtils.formatResult - Arcify action text')
  - OPEN_TAB in NEW_TAB mode shows "Switch to Tab" (same as before, regardless of isArcify)
  - OPEN_TAB in CURRENT_TAB mode shows "Open Pinned Tab" when isArcify is true
  - OPEN_TAB in CURRENT_TAB mode shows "enter arrow" when isArcify is false
  - PINNED_TAB with isActive true shows "Switch to Tab"
  - PINNED_TAB with isActive false and isArcify true shows "Open Favorite Tab"
  - PINNED_TAB with isActive false and no isArcify shows "Open Pinned Tab"
```

For formatResult tests, create SearchResult instances with the appropriate metadata:
```javascript
const result = new SearchResult({
  type: ResultType.OPEN_TAB,
  title: 'GitHub',
  url: 'https://github.com',
  metadata: { tabId: 1, windowId: 1, isArcify: true, spaceName: 'Work' }
});
const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
expect(formatted.action).toBe('Open Pinned Tab');
```
  </action>
  <verify>
Run `npx vitest run test/unit/arcify-enrichment.test.js test/unit/space-chip-ui.test.js` -- all tests pass. Expect ~25-30 tests total across both files.
  </verify>
  <done>
- Enrichment pipeline tests cover: matching URL enrichment, null spaceInfo pass-through, skip already-enriched pinned tabs, skip URL-less results, no-data early return, metadata creation, spaceColor default
- Space chip UI tests cover: all 9 chip colors, grey fallback, chip HTML generation, empty string for no spaceName, 18-char truncation with ellipsis, HTML escaping, groupName fallback, groupColor preference, title attribute
- Action text tests cover: Arcify "Open Pinned Tab" for enriched open tabs, "Open Favorite Tab" for pinned tabs, "Switch to Tab" for active tabs, unchanged behavior for non-Arcify results
  </done>
</task>

</tasks>

<verification>
1. `npx vitest run` -- all existing 232+ tests pass with no regressions.
2. `npx vitest run test/unit/arcify-provider.test.js` -- all ArcifyProvider tests pass.
3. `npx vitest run test/unit/arcify-enrichment.test.js` -- all enrichment pipeline tests pass.
4. `npx vitest run test/unit/space-chip-ui.test.js` -- all space chip UI tests pass.
5. No test files import from dist/ or dist-dev/.
</verification>

<success_criteria>
- 3 new test files created with ~40-48 total new tests
- ArcifyProvider cache build, lookup, invalidation, and import batching fully covered
- Enrichment pipeline (enrichWithArcifyInfo) tested for all code paths
- Space chip HTML generation and color mapping tested for all 9 colors + edge cases
- Action text formatting tested for all Arcify-specific result type/mode combinations
- Chrome mock extended without breaking existing 232+ tests
- All tests pass: `npx vitest run` exits 0
</success_criteria>
