# Phase 15: Provider & Component Tests - Research

**Researched:** 2026-02-12
**Domain:** Vitest unit testing for Chrome extension data providers and UI component logic
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extend existing `test/mocks/chrome.js` -- add missing Chrome APIs as needed, same pattern as Phase 14
- Mock at the Chrome API level (e.g., `chrome.runtime.sendMessage` returns canned data) -- tests exercise full module flow including serialization
- Most tests use synchronous resolved promises for speed; a few dedicated tests use small delays to validate race conditions and async timing in Promise.allSettled flows
- Use jsdom (Vitest default) for shared-component-logic.js DOM manipulation -- full DOM environment, closer to browser behavior
- One test file per module (autocomplete-provider.test.js, background-data-provider.test.js, shared-component-logic.test.js, message-client.test.js)
- Mock Chrome APIs but allow modules to call each other -- catches interface mismatches between providers
- message-client.js: test that sendMessage is called with correct action type (not exact payload shape) -- simpler, less brittle
- shared-component-logic.js: full lifecycle tests (show overlay -> type -> render suggestions -> select) -- catches integration issues between functions
- background-data-provider: test ALL combinations of source success/failure (tabs fail + history ok, tabs ok + history fail, both fail, etc.) -- exhaustive partial-failure coverage
- message-client: include runtime-unavailable scenarios (chrome.runtime undefined or throwing) -- happens during extension updates/crashes
- autocomplete-provider: test malformed/unexpected data from Chrome search API (missing fields, null values, unexpected shapes) -- defensive testing
- shared-component-logic: test DOM manipulation failures (missing elements, null references) -- happens during rapid show/hide cycles
- 80%+ line, function, AND branch coverage across all four modules
- Even thin API wrappers must be tested -- verify they call the right APIs with right args
- Full test suite (491+ existing tests) must pass with no regressions after adding new tests

### Claude's Discretion
- Exact test count per module
- How to structure describe/it blocks within each test file
- Which specific mock return values to use in test cases
- Order of test execution within files

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Summary

This phase adds unit tests for four modules: `autocomplete-provider.js`, `background-data-provider.js`, `shared-component-logic.js`, and `message-client.js`. The project already has a mature test infrastructure (491 tests passing via Vitest 4.0.18) with a well-structured Chrome API mock in `test/mocks/chrome.js` and a global setup file at `test/setup.js` that assigns `globalThis.chrome` and resets mocks between tests.

The four target modules have distinct testing challenges. `autocomplete-provider.js` uses the global `fetch()` API (NOT Chrome APIs) to call Google's suggest endpoint, requiring `vi.stubGlobal('fetch', ...)` or `vi.spyOn(globalThis, 'fetch')`. `background-data-provider.js` extends `BaseDataProvider` and makes extensive use of Chrome APIs (`tabs.query`, `tabGroups.query`, `storage.local.get`, `history.search`, `topSites.get`, `bookmarks.getChildren`) plus depends on `BookmarkUtils`, `AutocompleteProvider`, and `FuseSearchService`. `shared-component-logic.js` manipulates DOM elements (`innerHTML`, `addEventListener`, `closest`) and requires a DOM environment. `message-client.js` is a thin wrapper around `chrome.runtime.sendMessage` and `chrome.runtime.onMessage` with all-static methods.

A critical prerequisite: **jsdom must be installed** (`npm install -D jsdom`) before `shared-component-logic.js` tests can use the `// @vitest-environment jsdom` per-file annotation. It is not currently in the project's dependencies. All Chrome APIs used by these modules are already present in the existing `test/mocks/chrome.js` -- no new mock API surfaces need to be added.

**Primary recommendation:** Install jsdom as a dev dependency, use Vitest per-file `@vitest-environment` annotations for the one DOM-dependent test file, mock `fetch` globally for autocomplete-provider tests, and mock Logger + dependent modules (BookmarkUtils, FuseSearchService) following established patterns from Phase 14 tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.18 | Test runner, assertions, mocking | Already installed and configured |
| @vitest/coverage-v8 | 4.0.18 | Code coverage reporting | Already installed |
| jsdom | (latest) | DOM environment for shared-component-logic tests | Required by user decision; provides `document`, `addEventListener`, `closest` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fuse.js | 7.1.0 | Fuzzy search (already dependency) | Used by BackgroundDataProvider; can test with real Fuse or mock FuseSearchService |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom | happy-dom | happy-dom is faster but less complete; user locked decision on jsdom |
| jsdom | Manual document shim (as in space-chip-ui.test.js) | Simpler but user explicitly chose jsdom for closer browser behavior |

**Installation:**
```bash
npm install -D jsdom
```

## Architecture Patterns

### Recommended Project Structure
```
test/
├── mocks/
│   └── chrome.js              # Existing Chrome API mock (extend if needed)
├── setup.js                   # Global setup: globalThis.chrome = chromeMock
└── unit/
    ├── autocomplete-provider.test.js    # NEW
    ├── background-data-provider.test.js # NEW
    ├── shared-component-logic.test.js   # NEW (with @vitest-environment jsdom)
    ├── message-client.test.js           # NEW
    └── ... (existing test files)
```

### Pattern 1: Logger Mock (Mandatory for All Four Test Files)
**What:** Mock the Logger module before importing the module under test to prevent chrome.storage.sync.get side effects during import.
**When to use:** Every test file for these modules since they all import Logger.
**Example:**
```javascript
// Source: Existing pattern from test/unit/bookmark-utils.test.js
vi.mock('../../logger.js', () => ({
    Logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        initialize: vi.fn()
    }
}));
```

### Pattern 2: Fetch Mocking for AutocompleteProvider
**What:** Mock global `fetch` for testing HTTP calls to Google's suggest API. AutocompleteProvider uses `fetch()` with `AbortController` timeout.
**When to use:** autocomplete-provider.test.js
**Example:**
```javascript
// Source: Vitest docs - vi.stubGlobal
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Success case
mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ['test', ['test result 1', 'test result 2']]
});

// HTTP error case
mockFetch.mockResolvedValue({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests'
});

// Network/timeout error case
mockFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
```

### Pattern 3: Per-File Environment for DOM Tests
**What:** Use `// @vitest-environment jsdom` comment at the top of shared-component-logic.test.js to enable DOM APIs without changing the global config.
**When to use:** Only for shared-component-logic.test.js (the only file needing DOM).
**Example:**
```javascript
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Now document, HTMLElement, Event, etc. are available
```

### Pattern 4: Module Mocking with vi.mock for Dependencies
**What:** Mock dependent modules (BookmarkUtils, FuseSearchService, AutocompleteProvider) to isolate the module under test.
**When to use:** background-data-provider.test.js needs to mock BookmarkUtils and FuseSearchService.
**Example:**
```javascript
// Source: Existing pattern from test/unit/arcify-provider.test.js
vi.mock('../../bookmark-utils.js', () => ({
    BookmarkUtils: {
        findArcifyFolder: vi.fn().mockResolvedValue(null),
        getAllBookmarks: vi.fn().mockResolvedValue([]),
        getBookmarksFromFolderRecursive: vi.fn().mockResolvedValue([]),
        isUnderArcifyFolder: vi.fn().mockReturnValue(false),
        findTabByUrl: vi.fn().mockReturnValue(null)
    }
}));
```

### Pattern 5: Runtime-Unavailable Scenarios for message-client.js
**What:** Test chrome.runtime being undefined or throwing to simulate extension update/crash conditions.
**When to use:** message-client.test.js error scenarios.
**Example:**
```javascript
it('handles chrome.runtime being undefined', async () => {
    const savedRuntime = globalThis.chrome.runtime;
    globalThis.chrome.runtime = undefined;

    const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
    expect(result).toEqual([]);

    globalThis.chrome.runtime = savedRuntime;
});

it('handles chrome.runtime.sendMessage throwing', async () => {
    chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated')
    );

    const result = await SpotlightMessageClient.handleResult({}, 'current-tab');
    expect(result).toBe(false);
});
```

### Pattern 6: Promise.allSettled Partial-Failure Testing
**What:** Test BackgroundDataProvider inherited `getSpotlightSuggestions` where individual data sources can fail independently.
**When to use:** background-data-provider.test.js for exhaustive partial-failure scenarios.
**Example:**
```javascript
it('returns results from successful sources when tabs fail', async () => {
    chromeMock.tabs.query.mockRejectedValue(new Error('Tabs unavailable'));
    chromeMock.tabGroups.query.mockRejectedValue(new Error('TabGroups unavailable'));
    chromeMock.history.search.mockResolvedValue([
        { title: 'History Item', url: 'https://example.com', visitCount: 5 }
    ]);
    // ... other mocks as successful

    const results = await provider.getSpotlightSuggestions('test');
    // Should still contain history results despite tab failure
    expect(results.length).toBeGreaterThan(0);
});
```

### Anti-Patterns to Avoid
- **Testing BaseDataProvider methods directly on BackgroundDataProvider:** The decision says "mock Chrome APIs but allow modules to call each other," but note that `getSpotlightSuggestions`, `scoreAndSortResults`, `enrichWithArcifyInfo`, etc. live on BaseDataProvider. BackgroundDataProvider only implements the abstract data fetcher methods (`getOpenTabsData`, `getHistoryData`, etc.). Tests should focus on BackgroundDataProvider's own methods and only test inherited methods if needed for integration validation.
- **Mocking FuseSearchService when testing BackgroundDataProvider data flow:** Per the decision to "allow modules to call each other," let FuseSearchService run with real Fuse.js for data flow tests. Only mock it if isolating a specific error path.
- **Testing exact payload shapes in message-client:** User decision says test action type, not exact payload shape.
- **Using fake timers globally:** Only use `vi.useFakeTimers()` in specific describe blocks that need timing control (autocomplete caching TTL, debounce in shared-component-logic). The rest of the tests should use real timers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM environment | Manual document shim (like space-chip-ui.test.js) | jsdom via `@vitest-environment jsdom` | User decision; jsdom provides full DOM including events, closest(), querySelectorAll() |
| Fetch mocking | Custom fetch wrapper | `vi.stubGlobal('fetch', vi.fn())` | Vitest built-in global stubbing with automatic cleanup |
| AbortController mocking | Custom abort simulation | Node 25 has native AbortController | No mocking needed; AbortController works in Node |
| Timer control | Manual setTimeout tracking | `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()` | Established pattern in project (search-engine-debounce.test.js) |

**Key insight:** The existing test infrastructure handles 90% of what's needed. The main additions are: (1) installing jsdom, (2) mocking fetch, and (3) writing the test logic itself.

## Common Pitfalls

### Pitfall 1: Logger Initialization Side Effects
**What goes wrong:** Importing any module that imports Logger triggers `chrome.storage.sync.get` calls, polluting mock state and causing unexpected test failures.
**Why it happens:** Logger auto-initializes on import by reading debug settings from Chrome storage.
**How to avoid:** Always `vi.mock('../../logger.js', ...)` BEFORE importing the module under test. This is a hoisted mock and must appear at the top of the file.
**Warning signs:** Unexpected `chrome.storage.sync.get` calls in test output; mock call counts don't match expectations.

### Pitfall 2: AutocompleteProvider Uses fetch(), Not Chrome APIs
**What goes wrong:** Phase description mentions "Chrome search API integration" but AutocompleteProvider actually calls Google's suggest API via global `fetch()`, not any `chrome.search.*` API.
**Why it happens:** Naming confusion between Chrome's search API and Google's autocomplete suggest API.
**How to avoid:** Mock `fetch` (via `vi.stubGlobal`), not Chrome APIs, for autocomplete-provider tests. The `chrome.search.query` mock in chrome.js is NOT used by this module.
**Warning signs:** Tests pass but don't actually exercise the HTTP request path.

### Pitfall 3: BackgroundDataProvider's Deep Inheritance Chain
**What goes wrong:** Testing `getSpotlightSuggestions()` on BackgroundDataProvider exercises BaseDataProvider's business logic (scoring, deduplication, enrichment) in addition to the data fetcher methods.
**Why it happens:** BackgroundDataProvider extends BaseDataProvider; the abstract methods are overridden but the orchestration logic (Promise.allSettled, scoring, dedup) is inherited.
**How to avoid:** Test BackgroundDataProvider's own methods (`getOpenTabsData`, `getBookmarksData`, `getHistoryData`, `getTopSitesData`, `getAutocompleteData`, `getPinnedTabsData`, `getRecentTabsData`) directly. For Promise.allSettled testing, test via inherited `getSpotlightSuggestions` but mock the arcifyProvider to avoid dynamic import().
**Warning signs:** Tests become brittle to scoring constant changes or deduplication logic changes.

### Pitfall 4: ArcifyProvider Dynamic Import in enrichWithArcifyInfo
**What goes wrong:** BaseDataProvider.enrichWithArcifyInfo() uses `await import('./arcify-provider.js')` lazily. This dynamic import can fail or load unexpected modules in test.
**Why it happens:** The lazy import pattern avoids circular dependencies in production but creates test complexity.
**How to avoid:** Pre-set `provider.arcifyProvider` to a mock object in `beforeEach`, exactly as done in `test/unit/arcify-enrichment.test.js`. This bypasses the dynamic import entirely.
**Warning signs:** "Cannot find module" errors or unexpected ArcifyProvider behavior in tests.

### Pitfall 5: shared-component-logic.js SpotlightUtils.escapeHtml Requires document.createElement
**What goes wrong:** SpotlightUtils.escapeHtml (used by generateResultsHTML) calls `document.createElement('div')`, which fails without a DOM environment.
**Why it happens:** The escapeHtml implementation uses DOM APIs for reliable HTML escaping.
**How to avoid:** With jsdom environment (user decision), this works out of the box. No special handling needed. Also mock Logger and Utils (getFaviconUrl) since SpotlightUtils imports them.
**Warning signs:** "document is not defined" errors when running generateResultsHTML tests.

### Pitfall 6: message-client.js window.arcifyCurrentTabId
**What goes wrong:** `handleResult()` references `window.arcifyCurrentTabId` which is undefined in test environment.
**Why it happens:** This global is set by the overlay/popup at runtime.
**How to avoid:** In jsdom environment it would exist as `window.arcifyCurrentTabId` (undefined by default, which is fine -- the `|| null` fallback handles it). In node environment, `globalThis.window` doesn't exist but `window.arcifyCurrentTabId` would throw. Either use `// @vitest-environment jsdom` or set `globalThis.window = { arcifyCurrentTabId: null }` before import.
**Warning signs:** ReferenceError: window is not defined.

### Pitfall 7: Chrome Mock Reset Between Tests
**What goes wrong:** Tests that set up specific mock return values leak into subsequent tests.
**Why it happens:** The global setup.js calls `resetChromeMocks()` in `beforeEach`, but if a test modifies `globalThis.chrome.runtime` directly (for runtime-unavailable scenarios), it must restore it.
**How to avoid:** Always save and restore `globalThis.chrome.runtime` in runtime-unavailable tests. Use `afterEach` or try/finally patterns.
**Warning signs:** Tests pass in isolation but fail when run together.

## Code Examples

### Module Under Test: AutocompleteProvider Key Behaviors
```javascript
// Source: /Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/data-providers/autocomplete-provider.js

// 1. Caching: Results cached for 30s by cache key (trimmed + lowercased query)
// 2. Request deduplication: Concurrent identical requests share one fetch
// 3. Response format: Google returns [query, [suggestions], ...]
// 4. Timeout: 3s AbortController timeout on fetch
// 5. Result limit: Max 5 suggestions sliced from response
// 6. URL detection: Uses SpotlightUtils.isURL() to determine if suggestion is a URL
// 7. Error handling: AbortError logged as warn, other errors as error, always returns []
```

### Module Under Test: BackgroundDataProvider Key Behaviors
```javascript
// Source: /Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/data-providers/background-data-provider.js

// 1. getOpenTabsData: chrome.tabs.query + chrome.tabGroups.query in parallel,
//    FuseSearchService for filtering when query provided, groupMap enrichment
// 2. getRecentTabsData: tabs + tabGroups + storage.local.get in parallel,
//    sorted by lastActivity, sliced to limit
// 3. getBookmarksData: BookmarkUtils.getAllBookmarks() with Arcify folder exclusion,
//    FuseSearchService for filtering
// 4. getHistoryData: chrome.history.search (7-day window, 20 max),
//    FuseSearchService re-ranking, top 10 returned
// 5. getTopSitesData: simple chrome.topSites.get() wrapper
// 6. getAutocompleteData: delegates to this.autocompleteProvider
// 7. getPinnedTabsData: complex multi-step: storage -> tabs -> BookmarkUtils ->
//    per-space bookmark iteration -> FuseSearchService filtering
```

### Module Under Test: SharedSpotlightLogic Key Behaviors
```javascript
// Source: /Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/shared-component-logic.js

// 1. combineResults: Merges instant + async suggestions, deduplicates via SpotlightUtils.areResultsDuplicate
// 2. generateResultsHTML: Renders result items as HTML buttons with favicon, title, URL, action text, space chips
// 3. updateResultsDisplay: Sets innerHTML on container + setupFaviconErrorHandling
// 4. createKeyDownHandler: Returns event handler that delegates to SelectionManager then handles Enter/Escape
// 5. setupResultClickHandling: Event delegation on container for .arcify-spotlight-result-item clicks
// 6. createInputHandler: Returns debounced input handler (instant + delayed async callbacks)
```

### Module Under Test: SpotlightMessageClient Key Behaviors
```javascript
// Source: /Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/message-client.js

// 1. getSuggestions: sends 'getSpotlightSuggestions' action, returns response.results or []
// 2. getLocalSuggestions: sends 'getLocalSuggestions' action, returns response.results or []
// 3. getAutocompleteSuggestions: sends 'getAutocompleteSuggestions' action
// 4. handleResult: sends 'spotlightHandleResult' with window.arcifyCurrentTabId, returns boolean
// 5. getActiveSpaceColor: sends 'getActiveSpaceColor', returns {color, groupName} or defaults
// 6. notifyOpened/notifyClosed: fire-and-forget sendMessage (no await)
// 7. switchToTab: sends 'switchToTab' with tabId + windowId, returns boolean
// 8. navigateCurrentTab: sends 'navigateCurrentTab' with url, returns boolean
// 9. openNewTab: sends 'openNewTab' with url, returns boolean
// 10. performSearch: sends 'performSearch' with query + mode, returns boolean
// 11. setupGlobalCloseListener: adds onMessage listener, returns cleanup function
```

### SpotlightUtils Dependencies to Mock for shared-component-logic Tests
```javascript
// SpotlightUtils methods called by SharedSpotlightLogic:
// - areResultsDuplicate(a, b) - in combineResults
// - formatResult(result, mode, groupName) - in generateResultsHTML
// - generateSpaceChipHTML(result) - in generateResultsHTML
// - escapeHtml(text) - in generateResultsHTML (uses document.createElement)
// - getFaviconUrl(result) - in generateResultsHTML
// - setupFaviconErrorHandling(container) - in updateResultsDisplay
// - formatDebugInfo(result) - in generateResultsHTML

// With jsdom, escapeHtml works natively. Other methods can be tested through
// or mocked via vi.mock('./ui-utilities.js', ...) if isolation is needed.
```

### Recommended Mock Setup for BackgroundDataProvider Tests
```javascript
// Mock Logger (required)
vi.mock('../../logger.js', () => ({
    Logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), initialize: vi.fn() }
}));

// Mock BookmarkUtils (recommended for isolation)
vi.mock('../../bookmark-utils.js', () => ({
    BookmarkUtils: {
        getAllBookmarks: vi.fn().mockResolvedValue([]),
        findArcifyFolder: vi.fn().mockResolvedValue(null),
        getBookmarksFromFolderRecursive: vi.fn().mockResolvedValue([]),
        isUnderArcifyFolder: vi.fn().mockReturnValue(false),
        findTabByUrl: vi.fn().mockReturnValue(null)
    }
}));

// FuseSearchService: Let it run with real Fuse.js for data flow tests (per decision)
// Only mock when testing specific error paths
```

### Recommended Fetch Mock for AutocompleteProvider Tests
```javascript
// Mock Logger
vi.mock('../../logger.js', () => ({
    Logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), initialize: vi.fn() }
}));

// Mock global fetch
let mockFetch;
beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Google suggest API success response format
mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ['query', ['suggestion 1', 'suggestion 2', 'example.com']]
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual document shims (space-chip-ui.test.js) | Per-file `@vitest-environment jsdom` annotation | Available since Vitest 1.x | Cleaner DOM tests without global config changes |
| `jest.fn()` | `vi.fn()` | Project uses Vitest, not Jest | Same API but different import |
| `vi.mock()` with manual resets | `vi.mock()` + `beforeEach` `resetChromeMocks()` | Phase 14 established pattern | Consistent mock lifecycle |

**Deprecated/outdated:**
- The `globalThis.document` shim pattern used in `space-chip-ui.test.js` works but is inferior to jsdom for tests that need full DOM behavior (events, closest(), querySelectorAll). User decision specifies jsdom.

## Open Questions

1. **FuseSearchService: Mock or Real?**
   - What we know: The decision says "allow modules to call each other" which implies letting FuseSearchService run with real Fuse.js. Fuse.js is installed (7.1.0).
   - What's unclear: For some BackgroundDataProvider methods (getOpenTabsData, getBookmarksData, getHistoryData), FuseSearchService.search() is called with real data. If FuseSearchService is not mocked, tests need realistic mock data that Fuse.js will actually match.
   - Recommendation: Use real FuseSearchService for happy-path data flow tests (verifies integration). Provide mock data that will produce Fuse matches (e.g., items with titles matching the query). For error isolation tests, mock FuseSearchService only when needed.

2. **BackgroundDataProvider: Test Inherited BaseDataProvider Methods?**
   - What we know: BackgroundDataProvider overrides only the abstract data fetcher methods. The orchestration methods (getSpotlightSuggestions, getLocalSuggestions, getDefaultResults) and scoring/dedup logic live on BaseDataProvider.
   - What's unclear: Whether "background-data-provider.js has tests covering data aggregation, parallel fetch orchestration (Promise.allSettled)" means testing the inherited `getSpotlightSuggestions` on BackgroundDataProvider instances, or only testing the overridden data fetcher methods.
   - Recommendation: Test both: (a) each data fetcher method directly, and (b) `getSpotlightSuggestions` via BackgroundDataProvider to verify Promise.allSettled partial-failure behavior. The arcifyProvider must be pre-set as a mock to avoid dynamic import issues (following arcify-enrichment.test.js pattern).

3. **message-client.js: window Global in Node Environment**
   - What we know: `handleResult()` accesses `window.arcifyCurrentTabId`. In Node (default Vitest env), `window` is not defined.
   - What's unclear: Whether to use jsdom for message-client tests or provide a minimal window shim.
   - Recommendation: Use node environment (no DOM needed) and set `globalThis.window = { arcifyCurrentTabId: null }` in beforeAll/beforeEach. This is simpler than switching to jsdom just for one property access. Alternatively, the `|| null` fallback in the code means the undefined case is handled -- but the `window.` access itself would throw. A minimal shim is sufficient.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: All four source modules read and analyzed line-by-line
- `/vitest-dev/vitest` Context7 library -- per-file environment configuration, vi.stubGlobal, fetch mocking patterns
- Existing test files: `bookmark-utils.test.js`, `arcify-provider.test.js`, `arcify-enrichment.test.js`, `space-chip-ui.test.js`, `search-engine-debounce.test.js`, `website-name-extractor.test.js` -- all examined for mock patterns and conventions

### Secondary (MEDIUM confidence)
- Vitest docs (via Context7) -- `@vitest-environment jsdom` per-file annotation syntax confirmed
- Node.js 25.2.1 native `fetch` and `AbortController` support -- verified via `node --version`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already installed except jsdom; installation is trivial
- Architecture: HIGH -- patterns directly observed in 491 existing tests with consistent conventions
- Pitfalls: HIGH -- each pitfall derived from direct code analysis of the four target modules and their dependency chains

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (stable project; no framework migrations expected)
