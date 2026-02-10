# Phase 14: Utility Module Tests - Research

**Researched:** 2026-02-10
**Domain:** Vitest unit testing for Chrome extension utility modules
**Confidence:** HIGH

## Summary

This phase adds exhaustive unit test coverage for four utility modules: bookmark-utils.js (577 lines, 9% coverage), website-name-extractor.js (96 lines, 4% coverage), popular-sites.js (249 lines, 100% line / 60% branch), and utils.js (31 lines, 13% coverage). The codebase already has a mature testing infrastructure with 339 passing tests across 15 test files, an established Chrome API mock system, and consistent patterns for async testing.

The primary challenge is bookmark-utils.js, which is a large static utility object with 14 exported functions that heavily depend on Chrome bookmark and tab APIs. The existing chrome mock (`test/mocks/chrome.js`) covers `chrome.bookmarks.search`, `chrome.bookmarks.getChildren`, and `chrome.bookmarks.getSubTree`, but is **missing** `chrome.bookmarks.getTree`, `chrome.bookmarks.remove`, `chrome.bookmarks.update`, and `chrome.tabs.group` -- all required by bookmark-utils.js. These must be added to the shared mock before tests can run.

The three smaller modules (website-name-extractor, popular-sites, utils) are straightforward to test. Website-name-extractor is a class with pure synchronous methods (no Chrome APIs). Popular-sites needs branch coverage for `getAllDomains` and `getDisplayName` (untested exports). Utils.js has two functions using `chrome.runtime.getURL` and `chrome.storage.sync.get`, both already mocked.

**Primary recommendation:** Start by extending the chrome mock with missing APIs, then write bookmark-utils tests (largest effort), then the three smaller modules. Group into 2 plans: (1) chrome mock extension + bookmark-utils tests, (2) website-name-extractor + popular-sites + utils tests.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.18 | Test runner and assertion library | Already configured in vitest.config.js with globals, node environment, setup file |
| vi (vitest) | 4.0.18 | Mocking (vi.fn, vi.mock, vi.clearAllMocks) | Used in all existing test files for Chrome API mocking |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fuse.js | ^7.1.0 | Fuzzy search (used by popular-sites.js) | Already a dependency; popular-sites.js imports FuseSearchService which wraps Fuse.js |
| v8 (coverage provider) | built-in | Coverage reporting | Already configured in vitest.config.js |

### Alternatives Considered
None -- the stack is locked per CONTEXT.md decisions. Follow existing patterns strictly.

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Existing Test Directory Structure
```
test/
├── setup.js                     # Global setup: sets globalThis.chrome = chromeMock, resets mocks in beforeEach
├── mocks/
│   └── chrome.js                # Shared Chrome API mock (vi.fn() stubs with default returns)
├── unit/
│   ├── arcify-provider.test.js  # 21 tests (uses vi.mock for bookmark-utils)
│   ├── fuzzy-matching.test.js   # Tests FuseSearchService AND findMatchingDomains from popular-sites
│   ├── scoring.test.js          # 66 tests, most thorough example
│   ├── deduplication.test.js    # Uses it.each pattern
│   ├── url-utilities.test.js    # Uses it.each pattern
│   ├── selection-manager.test.js
│   ├── action-routing.test.js
│   ├── arcify-enrichment.test.js
│   ├── search-engine-debounce.test.js
│   ├── search-engine-cache.test.js
│   └── space-chip-ui.test.js
└── integration/
    ├── message-passing.test.js
    ├── activation-flow.test.js
    └── regression.test.js
```

### Pattern 1: Chrome API Mock Setup (Global via setup.js)
**What:** All tests share a global `chrome` mock set in `test/setup.js`. Each mock method is `vi.fn()` with `.mockResolvedValue()` default. `resetChromeMocks()` runs in `beforeEach` globally.
**When to use:** Always -- this is the established pattern.
**Example:**
```javascript
// test/setup.js (already exists)
import { chromeMock, resetChromeMocks } from './mocks/chrome.js';
globalThis.chrome = chromeMock;
beforeEach(() => { resetChromeMocks(); });
```

### Pattern 2: Per-Test Mock Overrides via chromeMock
**What:** Individual tests override the global mock's return values for specific Chrome APIs using `chromeMock.bookmarks.search.mockResolvedValue(...)`.
**When to use:** When a test needs specific Chrome API return data.
**Example (from arcify-provider.test.js):**
```javascript
import { chromeMock } from '../mocks/chrome.js';

it('builds cache from bookmark subtree', async () => {
    BookmarkUtils.findArcifyFolder.mockResolvedValue({ id: 'arcify-folder' });
    chromeMock.bookmarks.getSubTree.mockResolvedValue(mockSubtree);
    chromeMock.storage.local.get.mockResolvedValue({ spaces: mockSpaces });

    await provider.rebuildCache();
    expect(provider.cache.size).toBe(4);
});
```

### Pattern 3: vi.mock for Module-Level Mocking
**What:** When a module imports another module that needs to be fully mocked, use `vi.mock()` at the top of the test file (before imports).
**When to use:** When you need to replace an entire imported module (e.g., mocking logger.js to prevent side effects).
**Example (from arcify-provider.test.js):**
```javascript
vi.mock('../../bookmark-utils.js', () => ({
    BookmarkUtils: {
        findArcifyFolder: vi.fn().mockResolvedValue(null)
    }
}));
// Import AFTER mock setup
import { ArcifyProvider } from '../../shared/data-providers/arcify-provider.js';
```

### Pattern 4: it.each for Parameterized Tests
**What:** Use `it.each` for testing multiple inputs against expected outputs.
**When to use:** When testing a pure function with many input/output pairs.
**Example (from url-utilities.test.js):**
```javascript
it.each([
    ['https://example.com', 'complete URL with https'],
    ['http://example.com', 'complete URL with http'],
    ['example.com', 'domain without protocol'],
])('returns true for %s (%s)', (input) => {
    expect(SpotlightUtils.isURL(input)).toBe(true);
});
```

### Pattern 5: Describe Block Organization
**What:** Tests organized as `describe(ModuleName) > describe(functionName) > describe(scenario) > it(specific case)`.
**When to use:** Always -- this is the consistent pattern across all test files.
**Example structure:**
```javascript
describe('BookmarkUtils', () => {
    describe('findArcifyFolder', () => {
        describe('Method 1: search by title', () => {
            it('returns folder when search finds Arcify folder', async () => { ... });
            it('skips bookmarks with URLs (not folders)', async () => { ... });
        });
        describe('error handling', () => {
            it('returns null when Chrome API throws', async () => { ... });
        });
    });
});
```

### Pattern 6: Import Style
**What:** Tests import from vitest and source modules using relative paths.
**When to use:** Always.
**Example:**
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookmarkUtils } from '../../bookmark-utils.js';
```

### Anti-Patterns to Avoid
- **Creating new test infrastructure:** Do NOT add new test helpers, custom matchers, or test utilities. Use existing patterns.
- **Mocking at wrong level:** Do NOT create per-test `globalThis.chrome` -- use the shared `chromeMock` from `test/mocks/chrome.js`.
- **Forgetting async:** bookmark-utils functions are async. All tests calling them must be `async` and `await` the result.
- **Testing private internals:** `_bookmarkCache` and `_bookmarkCacheValid` are internal state. Test behavior through public methods, not by inspecting private fields (though checking cache state after public method calls is acceptable as the existing tests do this for arcify-provider).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chrome API mocking | Per-test manual mock objects | Extend `test/mocks/chrome.js` with missing APIs | Shared mock ensures consistency; resetChromeMocks clears state automatically |
| Bookmark tree fixtures | Complex nested object literals repeated in each test | Shared fixture factory functions at top of test file | Reusability, consistency, and readability |
| Logger silencing | Mocking console.log/error | `vi.mock('../../logger.js')` to stub entire Logger | Logger auto-initializes on import and calls chrome.storage.sync.get; must be mocked to prevent test interference |

**Key insight:** The existing test infrastructure handles most concerns. The main gap is just missing Chrome API stubs in the shared mock -- not a missing pattern.

## Common Pitfalls

### Pitfall 1: Logger Auto-Initialization Side Effect
**What goes wrong:** Importing `bookmark-utils.js` triggers `import { Logger } from './logger.js'`, and `logger.js` has module-level code that calls `chrome.storage.sync.get` and `chrome.storage.onChanged.addListener` during auto-initialization (lines 134-136 of logger.js).
**Why it happens:** Logger auto-initializes when `chrome.storage` exists (which it does because of the global mock).
**How to avoid:** The global mock's `chrome.storage.sync.get.mockResolvedValue({})` and `chrome.storage.onChanged.addListener` (vi.fn()) already handle this safely. No special action needed -- the existing setup.js and chrome mock absorb these calls. But be aware if tests check `chrome.storage.sync.get` call counts -- the Logger initialization will add extra calls.
**Warning signs:** Unexpected calls to `chrome.storage.sync.get` in test assertions.

### Pitfall 2: Missing Chrome APIs in Shared Mock
**What goes wrong:** Tests fail with "chrome.bookmarks.getTree is not a function" or similar TypeError.
**Why it happens:** The existing `test/mocks/chrome.js` does NOT include: `chrome.bookmarks.getTree`, `chrome.bookmarks.remove`, `chrome.bookmarks.update`, `chrome.tabs.group`.
**How to avoid:** Add these missing APIs to `test/mocks/chrome.js` AND their corresponding reset calls to `resetChromeMocks()` BEFORE writing any bookmark-utils tests.
**Warning signs:** TypeError in test output referencing Chrome API methods.

### Pitfall 3: Bookmark-Utils Uses `this` Context
**What goes wrong:** BookmarkUtils is a plain object (not a class), and several methods use `this` to call other methods (e.g., `getBookmarksFromFolderRecursive` calls `this.getBookmarksFromFolderRecursive` recursively, `updateBookmarkTitle` calls `this.findArcifyFolder`).
**Why it happens:** Testing individual methods in isolation may break `this` binding if methods are destructured from the object.
**How to avoid:** Always test through `BookmarkUtils.methodName()` -- never destructure methods like `const { findArcifyFolder } = BookmarkUtils`.
**Warning signs:** "Cannot read properties of undefined" errors when a method tries to call another method via `this`.

### Pitfall 4: Mock State Leaking Between Tests
**What goes wrong:** A test passes in isolation but fails when run with other tests, or vice versa.
**Why it happens:** bookmark-utils.js has mutable module-level state: `_bookmarkCache` and `_bookmarkCacheValid`. If one test populates the cache, the next test may see stale cache data.
**How to avoid:** Call `BookmarkUtils.invalidateBookmarkCache()` in `beforeEach` to reset internal state. The global `resetChromeMocks()` does NOT reset BookmarkUtils internal state.
**Warning signs:** Tests that pass alone but fail in suite, especially for `getAllBookmarks`.

### Pitfall 5: Recursive Mock Setup for getChildren
**What goes wrong:** `findArcifyFolder`, `getBookmarksFromFolderRecursive`, `findBookmarkInFolderRecursive`, `removeBookmarkByUrl`, `matchTabsWithBookmarks`, and `updateBookmarkTitle` all call `chrome.bookmarks.getChildren` recursively with different folder IDs.
**Why it happens:** A single `mockResolvedValue` returns the same data for ALL calls. Recursive traversal needs different data for different folder IDs.
**How to avoid:** Use `mockImplementation` with conditional logic based on the folderId argument:
```javascript
chromeMock.bookmarks.getChildren.mockImplementation(async (folderId) => {
    const tree = {
        '0': [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }],
        '2': [{ id: '100', title: 'Arcify' }],
        '100': [{ id: '200', title: 'Work' }, { id: '201', title: 'Personal' }],
        '200': [{ id: '300', title: 'GitHub', url: 'https://github.com' }],
    };
    return tree[folderId] || [];
});
```
**Warning signs:** Tests returning unexpected empty arrays or wrong bookmark data.

### Pitfall 6: openBookmarkAsTab Has DOM and Complex Context Dependencies
**What goes wrong:** Testing `openBookmarkAsTab` requires a complex `context` parameter with `spaces`, `activeSpaceId`, `currentWindow`, `saveSpaces`, `createTabElement`, `activateTabInDOM`, `Utils`, and `reconcileSpaceTabOrdering`.
**Why it happens:** This function orchestrates Chrome API calls, DOM manipulation, and data persistence. It has the highest complexity of any function in the module.
**How to avoid:** Create a minimal context object with vi.fn() stubs for all required functions. Test the Chrome API calls and function invocations, not DOM behavior. If testability is too low without major restructuring, test at integration level per CONTEXT.md decision.
**Warning signs:** Complex setup code that obscures what's being tested.

## Code Examples

### Example 1: Testing findArcifyFolder (3-Method Fallback)
```javascript
describe('findArcifyFolder', () => {
    it('Method 1: finds Arcify folder via search', async () => {
        chromeMock.bookmarks.search.mockResolvedValue([
            { id: '100', title: 'Arcify' } // no url = folder
        ]);

        const result = await BookmarkUtils.findArcifyFolder();
        expect(result).toEqual({ id: '100', title: 'Arcify' });
        expect(chromeMock.bookmarks.search).toHaveBeenCalledWith({ title: 'Arcify' });
    });

    it('Method 1: skips search results that are bookmarks (have url)', async () => {
        chromeMock.bookmarks.search.mockResolvedValue([
            { id: '50', title: 'Arcify', url: 'https://arcify.com' } // has url = not a folder
        ]);
        chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
            if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
            return [];
        });

        const result = await BookmarkUtils.findArcifyFolder();
        expect(result).toBeNull();
    });

    it('Method 2: traverses tree when search fails', async () => {
        chromeMock.bookmarks.search.mockResolvedValue([]);
        chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
            if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
            if (id === '2') return [{ id: '100', title: 'Arcify' }]; // folder (no url)
            return [];
        });

        const result = await BookmarkUtils.findArcifyFolder();
        expect(result).toEqual({ id: '100', title: 'Arcify' });
    });
});
```

### Example 2: Testing getAllBookmarks with Cache
```javascript
describe('getAllBookmarks', () => {
    beforeEach(() => {
        BookmarkUtils.invalidateBookmarkCache();
    });

    it('fetches and flattens bookmark tree', async () => {
        chromeMock.bookmarks.getTree.mockResolvedValue([{
            id: '0',
            children: [{
                id: '1', title: 'Bookmarks Bar',
                children: [
                    { id: '10', title: 'GitHub', url: 'https://github.com', parentId: '1' },
                    { id: '11', title: 'Folder', children: [
                        { id: '20', title: 'Nested', url: 'https://nested.com', parentId: '11' }
                    ]}
                ]
            }]
        }]);

        const result = await BookmarkUtils.getAllBookmarks();
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: '10', title: 'GitHub', url: 'https://github.com', parentId: '1' });
    });

    it('returns cached results on second call', async () => {
        chromeMock.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [] }]);

        await BookmarkUtils.getAllBookmarks();
        await BookmarkUtils.getAllBookmarks();
        expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(1);
    });
});
```

### Example 3: Testing WebsiteNameExtractor (Pure Synchronous)
```javascript
import { WebsiteNameExtractor, websiteNameExtractor } from '../../shared/website-name-extractor.js';

describe('WebsiteNameExtractor', () => {
    const extractor = new WebsiteNameExtractor();

    describe('normalizeHostname', () => {
        it.each([
            ['https://www.example.com/path', 'example.com'],
            ['http://Example.COM', 'example.com'],
            ['example.com', 'example.com'],
            ['https://sub.example.com', 'sub.example.com'],
        ])('normalizes %s to %s', (url, expected) => {
            expect(extractor.normalizeHostname(url)).toBe(expected);
        });
    });

    describe('extractWebsiteName', () => {
        it('returns curated name for popular site', () => {
            expect(extractor.extractWebsiteName('https://github.com')).toBe('GitHub');
        });
        it('falls back to hostname parsing for unknown site', () => {
            expect(extractor.extractWebsiteName('https://mysite.com/page')).toBe('Mysite');
        });
    });
});
```

### Example 4: Testing utils.js (getFaviconUrl, getSettings)
```javascript
import { getFaviconUrl, getSettings } from '../../utils.js';
import { chromeMock } from '../mocks/chrome.js';

describe('getFaviconUrl', () => {
    it('builds favicon URL using chrome.runtime.getURL', () => {
        const result = getFaviconUrl('https://github.com', '32');
        expect(result).toContain('/_favicon/');
        expect(result).toContain('pageUrl=');
        expect(result).toContain('size=32');
    });

    it('defaults to size 16', () => {
        const result = getFaviconUrl('https://example.com');
        expect(result).toContain('size=16');
    });
});

describe('getSettings', () => {
    it('returns settings from chrome.storage.sync.get', async () => {
        chromeMock.storage.sync.get.mockResolvedValue({
            enableSpotlight: true,
            colorOverrides: null,
            debugLoggingEnabled: false
        });
        const settings = await getSettings();
        expect(settings.enableSpotlight).toBe(true);
    });
});
```

## Detailed Module Analysis

### bookmark-utils.js -- Function-by-Function Testability

| Function | Lines | Chrome APIs Used | Testability | Key Test Scenarios |
|----------|-------|-----------------|-------------|-------------------|
| `invalidateBookmarkCache()` | 4 | None | HIGH | Resets _bookmarkCache and _bookmarkCacheValid |
| `getAllBookmarks()` | 30 | `bookmarks.getTree` | HIGH | Flat tree, nested tree, empty tree, cache hit, cache miss, API error |
| `findArcifyFolder()` | 73 | `bookmarks.search`, `bookmarks.getChildren` | HIGH | Method 1 success, Method 1 skip (URL match), Method 2 traversal, Method 3 Other Bookmarks, all methods fail, API error |
| `getBookmarksFromFolderRecursive()` | 35 | `bookmarks.getChildren`, `tabs.query` | HIGH | Flat folder, nested folders, with tab matching, without tab matching, empty folder |
| `findBookmarkInFolderRecursive()` | 52 | `bookmarks.getChildren` | HIGH | Find by URL, find by title, not found, nested find, missing criteria, API error |
| `findBookmarkByUrl()` | 6 | None | HIGH | Match found, no match, null inputs, bookmark without URL |
| `findTabByUrl()` | 6 | None | HIGH | Match found, no match, null inputs, tab without URL |
| `openBookmarkAsTab()` | 60 | `tabs.create`, `tabs.group`, `tabs.update` | MEDIUM | Complex context dependency; test API calls and function invocations |
| `removeBookmarkByUrl()` | 26 | `bookmarks.getChildren`, `bookmarks.remove` | HIGH | Found and removed, not found, nested find, with options |
| `matchTabsWithBookmarks()` | 24 | `bookmarks.getChildren`, `tabs.query` | HIGH | Matching tabs, no matches, with name override, nested folders |
| `updateBookmarkTitle()` | 50 | `bookmarks.getChildren`, `bookmarks.update` + findArcifyFolder() | MEDIUM | Title updated, already correct, bookmark not found, space not found, Arcify folder not found |
| `isUnderArcifyFolder()` | 4 | None | HIGH | Direct child, nested (startsWith), different parent, null parentId |
| `getBookmarksData()` | 28 | `bookmarks.search` + findArcifyFolder() | MEDIUM | Results with Arcify exclusion, no Arcify folder, API error |

### website-name-extractor.js -- Function-by-Function Testability

| Function | Chrome APIs | Testability | Key Test Scenarios |
|----------|------------|-------------|-------------------|
| `extractWebsiteName(url)` | None | HIGH | Popular site, unknown site, invalid URL, error path |
| `normalizeHostname(url)` | None | HIGH | With/without protocol, www removal, lowercase, invalid URL fallback |
| `getCuratedName(hostname)` | None | HIGH | Known hostname, unknown hostname |
| `parseHostnameToName(hostname)` | None | HIGH | Single part, multi-part, subdomain removal, TLD removal, null input |
| `websiteNameExtractor` (singleton) | None | HIGH | Verify singleton instance works |

### popular-sites.js -- Untested Exports

| Export | Current Coverage | What to Test |
|--------|-----------------|-------------|
| `POPULAR_SITES` | Line-covered (data) | Verify structure: all values are strings, all keys are domain-like |
| `getAllDomains()` | NOT tested (function 0%) | Returns array of all domain keys, length matches POPULAR_SITES |
| `getDisplayName(domain)` | NOT tested (function 0%) | Known domain returns name, unknown returns null |
| `findMatchingDomains()` | Tested (in fuzzy-matching.test.js) | Already covered -- extend with edge cases if needed |
| `_popularSitesList` (internal) | Line-covered | Not directly testable (module-internal), tested through findMatchingDomains |

### utils.js -- Function-by-Function Testability

| Function | Chrome APIs | Testability | Key Test Scenarios |
|----------|------------|-------------|-------------------|
| `getFaviconUrl(u, size)` | `runtime.getURL` | HIGH | Default size, custom size, URL encoding |
| `getSettings()` | `storage.sync.get` | HIGH | Default settings returned, custom settings |
| `Utils` object | None | HIGH | Verify it exports both functions |

## Chrome Mock Extension Required

The following APIs must be added to `test/mocks/chrome.js` before bookmark-utils tests:

| API | Default Return | Used By |
|-----|---------------|---------|
| `chrome.bookmarks.getTree` | `vi.fn().mockResolvedValue([])` | `BookmarkUtils.getAllBookmarks` |
| `chrome.bookmarks.remove` | `vi.fn().mockResolvedValue(undefined)` | `BookmarkUtils.removeBookmarkByUrl` |
| `chrome.bookmarks.update` | `vi.fn().mockResolvedValue({})` | `BookmarkUtils.updateBookmarkTitle` |
| `chrome.tabs.group` | `vi.fn().mockResolvedValue(1)` | `BookmarkUtils.openBookmarkAsTab` |

Each must also have a corresponding `mockClear().mockResolvedValue(...)` line in `resetChromeMocks()`.

## Recommended Test File Organization

Following existing naming conventions (module-name.test.js in test/unit/):

| Test File | Source Module | Estimated Tests |
|-----------|--------------|-----------------|
| `test/unit/bookmark-utils.test.js` | `bookmark-utils.js` | 50-70 tests |
| `test/unit/website-name-extractor.test.js` | `shared/website-name-extractor.js` | 20-30 tests |
| `test/unit/popular-sites.test.js` | `shared/popular-sites.js` | 10-15 tests |
| `test/unit/utils.test.js` | `utils.js` | 8-12 tests |

### Recommended Describe Block Structure for bookmark-utils.test.js

```
describe('BookmarkUtils')
  describe('invalidateBookmarkCache')
  describe('getAllBookmarks')
    - cache behavior
    - tree traversal
    - error handling
  describe('findArcifyFolder')
    - Method 1: search by title
    - Method 2: tree traversal
    - Method 3: Other Bookmarks fallback
    - all methods fail
    - error handling
  describe('getBookmarksFromFolderRecursive')
    - flat folder
    - nested folders
    - with tab ID matching
  describe('findBookmarkInFolderRecursive')
    - find by URL
    - find by title
    - nested search
    - validation and errors
  describe('findBookmarkByUrl')
  describe('findTabByUrl')
  describe('openBookmarkAsTab')
    - basic tab creation
    - pinned tab handling
    - DOM replacement (if testable)
  describe('removeBookmarkByUrl')
    - found and removed
    - recursive search
    - not found
  describe('matchTabsWithBookmarks')
    - matching tabs
    - name overrides
  describe('updateBookmarkTitle')
    - successful update
    - title already matches
    - bookmark not found
    - space/Arcify folder not found
  describe('isUnderArcifyFolder')
  describe('getBookmarksData')
    - with Arcify exclusion
    - without Arcify folder
```

## Synthetic Test Data Patterns

Per CONTEXT.md: use programmatic bookmark objects, 5-10 bookmarks per test case.

### Standard Arcify Bookmark Tree Fixture
```javascript
// Realistic Arcify folder hierarchy
const arcifyTree = {
    '0': [
        { id: '1', title: 'Bookmarks Bar' },
        { id: '2', title: 'Other Bookmarks' }
    ],
    '1': [], // empty bookmarks bar
    '2': [
        { id: '100', title: 'Arcify' } // Arcify folder in Other Bookmarks
    ],
    '100': [ // Arcify folder contains space folders
        { id: '200', title: 'Work' },
        { id: '201', title: 'Personal' }
    ],
    '200': [ // Work space bookmarks
        { id: '300', title: 'GitHub', url: 'https://github.com' },
        { id: '301', title: 'Jira', url: 'https://jira.atlassian.com' },
        { id: '302', title: 'Docs', children: [] } // subfolder
    ],
    '302': [ // Docs subfolder
        { id: '400', title: 'Wiki', url: 'https://wiki.example.com' }
    ],
    '201': [ // Personal space bookmarks
        { id: '310', title: 'Gmail', url: 'https://mail.google.com' }
    ]
};

// Usage in mockImplementation:
chromeMock.bookmarks.getChildren.mockImplementation(async (id) => arcifyTree[id] || []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jest for testing | vitest 4.x | Already established | Vitest is the configured runner; do not use jest |
| Manual fuzzy matching | Fuse.js 7.x via FuseSearchService | Already established | popular-sites.js uses FuseSearchService, not manual matching |

**Deprecated/outdated:**
- None relevant to this phase. All tools are current.

## Open Questions

1. **openBookmarkAsTab testability depth**
   - What we know: This function requires a complex `context` parameter with 7 properties including DOM manipulation functions (`createTabElement`, `activateTabInDOM`, `replaceElement`).
   - What's unclear: Whether testing just the Chrome API calls (tabs.create, tabs.group, tabs.update) is sufficient, or if DOM replacement behavior should also be verified.
   - Recommendation: Test Chrome API calls and function invocation assertions with vi.fn() stubs for context functions. Skip DOM element replacement verification (it requires HTMLElement mocks). If coverage remains low, test at integration level per CONTEXT.md.

2. **Logger mock strategy**
   - What we know: Logger auto-initializes on import. The global chrome mock handles the initialization calls silently.
   - What's unclear: Whether Logger's `chrome.storage.sync.get` call during auto-init will interfere with `getSettings()` test assertions in utils.test.js (both call the same mock).
   - Recommendation: If interference occurs, use `vi.mock('../../logger.js')` or `vi.mock('../logger.js')` at top of test files to fully stub the Logger module. Otherwise, let the global mock handle it and reset mock call counts after Logger init.

## Sources

### Primary (HIGH confidence)
- **Source code analysis**: Direct reading of bookmark-utils.js (577 lines), website-name-extractor.js (96 lines), popular-sites.js (249 lines), utils.js (31 lines), logger.js (140 lines)
- **Test infrastructure analysis**: Direct reading of test/setup.js, test/mocks/chrome.js, and all 11 existing unit test files
- **vitest.config.js**: Test configuration (globals, node environment, setup file, coverage)
- **Coverage report**: `.planning/phases/13-audit-coverage-report/COVERAGE-REPORT.md` -- verified coverage numbers

### Secondary (MEDIUM confidence)
- **Vitest 4.x API**: vi.fn(), vi.mock(), mockResolvedValue(), mockImplementation() -- verified through actual usage in codebase

### Tertiary (LOW confidence)
- None -- all findings are based on direct source code analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- directly verified from package.json (vitest 4.0.18, fuse.js 7.1.0) and vitest.config.js
- Architecture: HIGH -- derived from reading all 11 existing unit test files and the shared mock
- Module analysis: HIGH -- function-by-function analysis from reading all 4 source files
- Chrome mock gaps: HIGH -- verified by grep comparison of bookmark-utils.js Chrome API calls vs test/mocks/chrome.js contents
- Pitfalls: HIGH -- identified from actual code patterns (Logger auto-init, this binding, recursive mocking)

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable -- testing infrastructure and source modules unlikely to change in 30 days)
