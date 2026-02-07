# Phase 12: Regression Validation - Research

**Researched:** 2026-02-06
**Domain:** Test validation, regression testing, behavioral verification
**Confidence:** HIGH

## Summary

Phase 12 is a pure validation phase -- no new code is written. The goal is to confirm that the 326 existing tests all pass and that three critical behavioral contracts are preserved: deduplication across data sources, Arcify enrichment with "Open Pinned Tab" wording, and action routing (tab switching vs URL navigation vs bookmark opening).

The research involved a thorough audit of the existing test suite (14 test files, 326 tests across unit/integration/E2E layers), the source modules those tests exercise, and the specific behavioral contracts required by REG-01 and REG-02. All 326 tests currently pass with zero failures. The three behavioral areas (deduplication, Arcify enrichment, action routing) are already extensively tested in existing test files, but the tests verify individual unit behavior -- they do not verify the end-to-end flow from query to deduplicated, enriched, action-routed results in a single integrated test.

**Primary recommendation:** Run the full test suite to verify REG-01, then write targeted integration-level regression tests for the three REG-02 behavioral contracts (deduplication, enrichment, action routing) that exercise the real code path from `getSpotlightSuggestions()` through dedup, enrichment, scoring, and into `handleResultAction()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (existing) | Test runner | Already the project's test runner; 326 tests use it |
| Fuse.js | (existing) | Fuzzy matching | Already installed and integrated in Phase 9 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest --reporter=verbose | N/A | Detailed test output | Use for regression run to see every test name |
| vitest --coverage | N/A | Coverage reporting | Verify no coverage regressions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New regression test file | Manual testing | Not repeatable, not automatable |
| Separate test framework | vitest (existing) | No reason to add a second framework |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
test/
├── unit/                          # Existing unit tests (11 files)
│   ├── deduplication.test.js      # URL normalization + priority hierarchy
│   ├── action-routing.test.js     # handleResultAction for all result types
│   ├── arcify-enrichment.test.js  # enrichWithArcifyInfo behavior
│   ├── arcify-provider.test.js    # ArcifyProvider cache/lookup
│   ├── scoring.test.js            # Weighted scoring, type hierarchy
│   ├── fuzzy-matching.test.js     # FuseSearchService + findMatchingDomains
│   ├── search-engine-debounce.test.js  # Debounce + immediate path
│   ├── search-engine-cache.test.js     # Cache TTL behavior
│   ├── selection-manager.test.js  # Keyboard navigation
│   ├── space-chip-ui.test.js      # Chip rendering + action text
│   └── url-utilities.test.js      # URL utility functions
├── integration/                   # Existing integration tests (3 files)
│   ├── message-passing.test.js    # Chrome message passing
│   ├── activation-flow.test.js    # Spotlight activation lifecycle
│   └── regression.test.js         # NEW: REG-02 end-to-end behavioral tests
├── e2e/                           # Existing E2E tests (1 file, excluded from vitest)
│   └── tests/spotlight.e2e.test.js
└── mocks/
    └── chrome.js                  # Chrome API mock scaffolding
```

### Pattern 1: Integration-Level Behavioral Tests
**What:** Test the full flow from `BaseDataProvider.getSpotlightSuggestions()` through dedup, enrichment, and scoring to verify REG-02 contracts
**When to use:** When verifying that multiple subsystems work together correctly
**Example:**
```javascript
// Pattern: Mock the abstract data fetchers, call the real business logic
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';

// Create a concrete test subclass with controlled data
class TestDataProvider extends BaseDataProvider {
    constructor(data) {
        super();
        this._data = data;
    }
    async getOpenTabsData(query) { return this._data.tabs || []; }
    async getBookmarksData(query) { return this._data.bookmarks || []; }
    async getHistoryData(query) { return this._data.history || []; }
    async getTopSitesData() { return this._data.topSites || []; }
    async getAutocompleteData(query) { return this._data.autocomplete || []; }
    async getPinnedTabsData(query) { return this._data.pinnedTabs || []; }
}

// Test deduplication: same URL from two sources -> only highest-priority type kept
it('deduplicates same URL from history + open tabs (open tab wins)', async () => {
    const provider = new TestDataProvider({
        tabs: [{ id: 1, windowId: 1, title: 'GitHub', url: 'https://github.com', _matchScore: 0.9 }],
        history: [{ title: 'GitHub', url: 'https://github.com', visitCount: 10, lastVisitTime: Date.now(), _matchScore: 0.8 }],
    });
    // Override arcify to skip
    provider.arcifyProvider = { ensureCacheBuilt: async () => {}, hasData: () => false };

    const results = await provider.getSpotlightSuggestions('github');
    const githubResults = results.filter(r => r.url && r.url.includes('github.com'));
    expect(githubResults.length).toBe(1);
    expect(githubResults[0].type).toBe('open-tab');
});
```

### Pattern 2: Wording Verification Tests
**What:** Test that Arcify-enriched results produce the correct action text via `SpotlightUtils.formatResult()`
**When to use:** Verifying REG-02's "Arcify enrichment still works" requirement
**Example:**
```javascript
// Verify the full pipeline: enrichment -> formatResult -> correct wording
it('Arcify-bookmarked tab shows "Open Pinned Tab" wording', () => {
    const result = new SearchResult({
        type: ResultType.OPEN_TAB,
        title: 'GitHub',
        url: 'https://github.com',
        metadata: { tabId: 1, windowId: 1, isArcify: true, spaceName: 'Work', groupName: 'Work' }
    });
    const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
    expect(formatted.action).toBe('Open Pinned Tab');
});
```

### Pattern 3: Action Routing Verification
**What:** Confirm that selecting different result types triggers the correct Chrome API calls
**When to use:** Verifying REG-02's "action routing unchanged" requirement
**Example:**
```javascript
// Already extensively tested in action-routing.test.js
// Regression test confirms the contract still holds after all v2.0 changes
```

### Anti-Patterns to Avoid
- **Duplicating existing tests:** The 326 existing tests already cover individual behaviors. Do NOT re-test what is already tested. Focus on gaps.
- **Testing implementation details:** Do NOT test internal Fuse.js config values or scoring formula constants. Test observable behavior.
- **Snapshot testing for scoring:** Score values change when formula weights change. Test relative ordering (A > B), not exact values.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Running 326 tests | Custom test runner | `npx vitest run` | Vitest already configured and running |
| Chrome API mocking | New mock framework | `test/mocks/chrome.js` + `test/setup.js` | Comprehensive mocks already exist |
| Data provider testing | Mock individual Chrome APIs | TestDataProvider subclass of BaseDataProvider | Mock at the abstract method boundary, exercise real business logic |
| Verifying test count | Manual counting | `vitest run --reporter=verbose 2>&1 \| grep "Tests"` | Machine-readable output |

**Key insight:** Phase 12 is about confirming existing behavior, not building new infrastructure. Leverage everything already built.

## Common Pitfalls

### Pitfall 1: Testing Units in Isolation When Integration Matters
**What goes wrong:** All 326 unit tests pass, but the deduplication-then-enrichment-then-scoring pipeline has a subtle interaction bug that no unit test catches
**Why it happens:** Unit tests mock dependencies; the mocks may not reflect real behavior after v2.0 changes
**How to avoid:** Write integration tests that exercise `getSpotlightSuggestions()` with a concrete TestDataProvider subclass, using real dedup/enrichment/scoring logic
**Warning signs:** Tests pass but manual testing shows duplicates or wrong wording

### Pitfall 2: Forgetting Progressive Rendering Changed the Data Flow
**What goes wrong:** Tests only exercise the old `getSpotlightSuggestions()` path but miss the new `getLocalSuggestions()` -> merge -> `getSpotlightSuggestions()` progressive rendering path from Phase 11
**Why it happens:** Phase 11 added a two-phase rendering pipeline; local results render first, then autocomplete appends via the full path
**How to avoid:** Test both `getLocalSuggestions()` and `getSpotlightSuggestions()` paths; verify dedup works across both phases
**Warning signs:** Duplicates appear when autocomplete results arrive in Phase 2

### Pitfall 3: URL Normalization Edge Cases in Deduplication
**What goes wrong:** Two results with the "same" URL but different normalization (e.g., trailing slash, www prefix, http vs https) both appear
**Why it happens:** `normalizeUrlForDeduplication()` handles most cases but edge cases may slip through
**How to avoid:** Include edge case URLs in deduplication regression tests (fragment, trailing slash, www, protocol, query params)
**Warning signs:** Duplicate results visible in the UI for what looks like the same page

### Pitfall 4: Arcify Enrichment Requires Mock Setup
**What goes wrong:** Integration tests crash or skip enrichment because `arcifyProvider` triggers dynamic import
**Why it happens:** `enrichWithArcifyInfo()` uses `import('./arcify-provider.js')` dynamically; in test context this may fail or return unexpected mock
**How to avoid:** Pre-set `provider.arcifyProvider` in test setup (same pattern as arcify-enrichment.test.js)
**Warning signs:** TypeError from import, or enrichment silently skipped

### Pitfall 5: Confusing Test Count with Test Coverage
**What goes wrong:** "All 326 tests pass" is treated as sufficient, but important behaviors have no test
**Why it happens:** REG-01 says "all existing tests pass" but REG-02 requires specific behavioral verification
**How to avoid:** REG-01 is satisfied by running tests; REG-02 needs explicit behavioral tests for the three contracts
**Warning signs:** Tests pass but dedup/enrichment/routing could be broken without failing a test

## Code Examples

### Full Test Suite Run (REG-01)
```bash
# Run all 326 tests, verify zero failures
npx vitest run --reporter=verbose
# Expected: "326 passed (326)" and "14 passed (14)" test files
```

### Deduplication Integration Test
```javascript
// Source: Derived from base-data-provider.js deduplicateResults() + normalizeUrlForDeduplication()
describe('REG-02: Deduplication across data sources', () => {
    it('same URL from history + open tabs shows only once (open-tab wins)', async () => {
        // Setup: github.com exists as both an open tab and in history
        const provider = createTestProvider({
            tabs: [{ id: 1, windowId: 1, title: 'GitHub', url: 'https://github.com', _matchScore: 0.9 }],
            history: [{ title: 'GitHub', url: 'https://github.com', visitCount: 10, lastVisitTime: Date.now(), _matchScore: 0.8 }]
        });
        const results = await provider.getSpotlightSuggestions('github');
        const githubResults = results.filter(r => r.url?.includes('github.com'));
        expect(githubResults).toHaveLength(1);
        expect(githubResults[0].type).toBe('open-tab');
    });

    it('normalizes URL variants for deduplication', async () => {
        const provider = createTestProvider({
            tabs: [{ id: 1, windowId: 1, title: 'Example', url: 'https://www.example.com/', _matchScore: 0.9 }],
            history: [{ title: 'Example', url: 'http://example.com', visitCount: 5, lastVisitTime: Date.now(), _matchScore: 0.7 }]
        });
        const results = await provider.getSpotlightSuggestions('example');
        const exampleResults = results.filter(r => r.url?.includes('example.com'));
        expect(exampleResults).toHaveLength(1);
    });
});
```

### Arcify Enrichment Wording Test
```javascript
// Source: Derived from ui-utilities.js formatResult() + arcify-enrichment.test.js patterns
describe('REG-02: Arcify enrichment preserved', () => {
    it('Arcify-bookmarked tab with matching group shows "Open Pinned Tab"', () => {
        const result = new SearchResult({
            type: ResultType.OPEN_TAB,
            title: 'GitHub',
            url: 'https://github.com',
            metadata: { tabId: 1, windowId: 1, isArcify: true, spaceName: 'Work', groupName: 'Work' }
        });
        const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
        expect(formatted.action).toBe('Open Pinned Tab');
    });

    it('Arcify bookmark (not open tab) shows "Open Pinned Tab"', () => {
        const result = new SearchResult({
            type: ResultType.BOOKMARK,
            title: 'GitHub',
            url: 'https://github.com',
            metadata: { bookmarkId: 'b1', isArcify: true, spaceName: 'Work', spaceColor: 'blue' }
        });
        const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
        expect(formatted.action).toBe('Open Pinned Tab');
    });

    it('PINNED_TAB type shows "Open Favorite Tab"', () => {
        const result = new SearchResult({
            type: ResultType.PINNED_TAB,
            title: 'GitHub',
            url: 'https://github.com',
            metadata: { bookmarkId: 'b1', spaceName: 'Work' }
        });
        const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
        expect(formatted.action).toBe('Open Favorite Tab');
    });
});
```

### Action Routing Test
```javascript
// Source: Derived from search-engine.js handleResultAction() + action-routing.test.js patterns
describe('REG-02: Action routing unchanged', () => {
    it('selecting an open tab switches to it (tabs.update + windows.update)', async () => {
        const engine = new SearchEngine({ isBackgroundProvider: true, getSpotlightSuggestions: vi.fn() });
        const result = { type: ResultType.OPEN_TAB, url: 'https://github.com', metadata: { tabId: 42, windowId: 1 } };
        await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);
        expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { active: true });
        expect(chromeMock.windows.update).toHaveBeenCalledWith(1, { focused: true });
    });

    it('selecting a URL navigates to it (tabs.create)', async () => {
        const engine = new SearchEngine({ isBackgroundProvider: true, getSpotlightSuggestions: vi.fn() });
        const result = { type: ResultType.URL_SUGGESTION, url: 'https://example.com' };
        await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com' });
    });

    it('selecting a bookmark opens it (tabs.create)', async () => {
        const engine = new SearchEngine({ isBackgroundProvider: true, getSpotlightSuggestions: vi.fn() });
        const result = { type: ResultType.BOOKMARK, url: 'https://github.com' };
        await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://github.com' });
    });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled fuzzyMatch() | Fuse.js FuseSearchService | Phase 9 | All matching is now Fuse.js-based |
| Flat per-type scoring | Weighted multi-signal formula | Phase 10 | Scores use TYPE+MATCH+RECENCY+FREQUENCY |
| Sequential data fetching | Promise.allSettled parallel | Phase 11 | All 6 sources fetched concurrently |
| Double debounce (150ms+150ms) | Single UI-layer debounce | Phase 11 | Background uses immediate path |
| All-at-once rendering | Two-phase progressive | Phase 11 | Local first, autocomplete appends |

**Deprecated/outdated:**
- `fuzzyMatch()`: Removed in Phase 9, replaced by FuseSearchService. `getFuzzyMatchScore()` still exported but marked deprecated in scoring-constants.js
- `getSpotlightSuggestionsUsingCache()`: Retained in SearchEngine but no longer called from background.js message handler (Phase 11). Tests preserved for backward compatibility.

## Open Questions

1. **E2E tests excluded from vitest but part of the suite**
   - What we know: E2E tests use Puppeteer + Node test runner, excluded from vitest via `vitest.config.js`
   - What's unclear: Should Phase 12 run E2E tests as well for full regression coverage?
   - Recommendation: Focus on vitest unit/integration tests for REG-01 (326 tests). E2E tests are run separately and are not part of the "300+ tests" count. Document their status but do not block on them.

2. **getLocalSuggestions() not covered by integration tests**
   - What we know: Phase 11 added `getLocalSuggestions()` for progressive rendering Phase 1, but no integration test exercises the full local-only pipeline
   - What's unclear: Could deduplication behave differently in the local-only path?
   - Recommendation: Add a regression test that calls `getLocalSuggestions()` with duplicate data to verify dedup works in both paths

## Existing Test Coverage Audit

### Files with direct REG-02 relevance (already tested):
| Test File | Tests | What It Covers | REG-02 Gap |
|-----------|-------|----------------|------------|
| deduplication.test.js | 14 | URL normalization, priority hierarchy | Tests dedup primitives, NOT the full pipeline |
| arcify-enrichment.test.js | 9 | enrichWithArcifyInfo behavior | Tests enrichment in isolation, NOT wording output |
| arcify-provider.test.js | 16 | ArcifyProvider cache/lookup | Tests provider, NOT integration with formatResult |
| space-chip-ui.test.js | 22 | Chip rendering + action text wording | Tests formatResult, but as unit test with manual metadata |
| action-routing.test.js | 22 | handleResultAction for all types | Tests routing in isolation |
| scoring.test.js | 42 | Weighted scoring, type hierarchy, signals | Tests scoring formula correctness |
| fuzzy-matching.test.js | 19 | FuseSearchService + findMatchingDomains | Tests Fuse.js search behavior |

### Files with REG-01 relevance (run verification):
| Test File | Tests | Category |
|-----------|-------|----------|
| All 14 test files | 326 total | Unit + Integration |

### Gap analysis:
- **No test exercises `getSpotlightSuggestions()` end-to-end with real dedup + enrichment + scoring.** Each subsystem is tested in isolation.
- **No test verifies that `getLocalSuggestions()` deduplicates correctly** (Phase 11 addition).
- **Action routing tests already comprehensive** -- 22 tests cover all result types in both modes. No gap.
- **Wording tests already comprehensive** -- space-chip-ui.test.js covers all Arcify wording variations. No gap.
- **The primary gap is integration-level deduplication** -- verifying that two data sources returning the same URL results in exactly one result after the full pipeline.

## Sources

### Primary (HIGH confidence)
- Codebase audit: All 14 test files read and analyzed
- `test/unit/deduplication.test.js` - 14 tests for URL normalization and priority
- `test/unit/arcify-enrichment.test.js` - 9 tests for enrichment behavior
- `test/unit/action-routing.test.js` - 22 tests for action routing
- `test/unit/scoring.test.js` - 42 tests for weighted scoring
- `test/unit/space-chip-ui.test.js` - 22 tests for chip UI and wording
- `test/unit/fuzzy-matching.test.js` - 19 tests for Fuse.js matching
- `shared/data-providers/base-data-provider.js` - Full dedup + enrichment + scoring pipeline
- `shared/search-engine.js` - Action routing implementation
- `shared/ui-utilities.js` - formatResult() wording logic
- `vitest.config.js` - Test configuration (excludes E2E)
- `npx vitest run` - Verified 326 tests pass, 14 test files

### Secondary (MEDIUM confidence)
- STATE.md, ROADMAP.md, REQUIREMENTS.md - Phase context and requirements

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; everything is already in the project
- Architecture: HIGH - Test patterns well-established in existing 14 test files; TestDataProvider subclass approach proven
- Pitfalls: HIGH - All pitfalls identified from direct codebase analysis of real code paths

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no external dependencies or fast-moving libraries)
