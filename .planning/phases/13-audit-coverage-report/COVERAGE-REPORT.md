# Coverage Audit Report

Generated: 2026-02-10
Tool: Vitest 4.0.18 with V8 coverage provider
Test suite: 15 test files, 339 tests (all passing)

## Summary

- **Total source modules:** 21
- **Well tested:** 6 (>70% line coverage with dedicated tests)
- **Partially tested:** 8 (30-70% line coverage or indirect coverage only)
- **Untested:** 7 (<30% line coverage or no test mapping)
- **Overall line coverage:** 37.55%

## Coverage Metrics

All percentages from `npx vitest run --coverage` (V8 provider).

### shared/data-providers/

| Module | Stmts % | Branch % | Funcs % | Lines % | Classification |
|--------|---------|----------|---------|---------|----------------|
| arcify-provider.js | 87.14 | 78.12 | 100 | 90.76 | Well tested |
| base-data-provider.js | 73.16 | 66.66 | 65.11 | 72.60 | Well tested |
| autocomplete-provider.js | 50.81 | 48.14 | 44.44 | 51.66 | Partially tested |
| background-data-provider.js | 40.83 | 28.07 | 42.85 | 41.96 | Partially tested |

### shared/ (non-data-providers)

| Module | Stmts % | Branch % | Funcs % | Lines % | Classification |
|--------|---------|----------|---------|---------|----------------|
| fuse-search-service.js | 100 | 100 | 100 | 100 | Well tested |
| scoring-constants.js | 100 | 100 | 100 | 100 | Well tested |
| selection-manager.js | 100 | 96.77 | 100 | 100 | Well tested |
| search-types.js | 93.75 | 90.90 | 100 | 93.33 | Well tested |
| search-engine.js | 63.79 | 54.11 | 100 | 63.79 | Partially tested |
| popular-sites.js | 84.61 | 60.00 | 60 | 100 | Partially tested |
| ui-utilities.js | 34.65 | 42.85 | 88.23 | 34.69 | Partially tested |
| website-name-extractor.js | 3.22 | 0 | 20 | 3.57 | Untested |
| message-client.js | 0 | 0 | 0 | 0 | Untested |
| shared-component-logic.js | 0 | 0 | 0 | 0 | Untested |
| styling.js | 0 | 0 | 0 | 0 | Untested |

### Root-level modules

| Module | Stmts % | Branch % | Funcs % | Lines % | Classification |
|--------|---------|----------|---------|---------|----------------|
| background.js | 41.63 | 49.56 | 34.28 | 41.88 | Partially tested |
| logger.js | 51.35 | 30.30 | 88.88 | 54.28 | Partially tested |
| bookmark-utils.js | 8.77 | 3.63 | 7.40 | 9.38 | Untested |
| utils.js | 12.50 | 0 | 0 | 12.50 | Untested |
| newtab.js | 0 | 0 | 0 | 0 | Untested |
| overlay.js | 0 | 0 | 0 | 0 | Untested |

## Source-to-Test Mapping

| Source Module | Test File(s) | Notes |
|---------------|-------------|-------|
| **shared/data-providers/arcify-provider.js** | test/unit/arcify-provider.test.js | Dedicated unit tests (21 tests). Also imports BookmarkUtils from bookmark-utils.js. |
| **shared/data-providers/base-data-provider.js** | test/unit/scoring.test.js, test/unit/deduplication.test.js, test/unit/arcify-enrichment.test.js, test/unit/fuzzy-matching.test.js, test/integration/regression.test.js | Extensively tested through multiple test files covering scoring, dedup, enrichment, and fuzzy matching. |
| **shared/data-providers/autocomplete-provider.js** | (none direct) | Only exercised indirectly through integration tests that import background.js. No dedicated test file. Coverage comes from background.js dynamic imports. |
| **shared/data-providers/background-data-provider.js** | (none direct) | Only exercised indirectly through integration tests that import background.js (message-passing, activation-flow). No dedicated test file. |
| **shared/fuse-search-service.js** | test/unit/fuzzy-matching.test.js | Direct import and dedicated tests. 100% coverage. |
| **shared/scoring-constants.js** | test/unit/scoring.test.js | Direct import with comprehensive scoring formula tests (66 tests). 100% coverage. |
| **shared/selection-manager.js** | test/unit/selection-manager.test.js | Dedicated unit tests (37 tests). 100% coverage. |
| **shared/search-types.js** | (multiple) | Imported by most test files as a type/constant module. 93% coverage. |
| **shared/search-engine.js** | test/unit/search-engine-debounce.test.js, test/unit/search-engine-cache.test.js, test/unit/action-routing.test.js, test/integration/regression.test.js | Well-covered by multiple test files (debounce, cache, action routing, regression). Functions at 100%, but lines at 63.79% due to untested error paths. |
| **shared/popular-sites.js** | test/unit/fuzzy-matching.test.js | Only `findMatchingDomains` is tested. Other exports (site list data, helper functions) not directly exercised. Lines at 100% but branches at 60% and functions at 60%. |
| **shared/ui-utilities.js** | test/unit/url-utilities.test.js, test/unit/space-chip-ui.test.js, test/unit/action-routing.test.js (indirect) | URL formatting and chip rendering tested directly. Large portions of formatting/rendering logic untested (lines 113-165, 228-316). |
| **shared/website-name-extractor.js** | (none) | No test file. 3.57% line coverage comes from indirect loading. |
| **shared/message-client.js** | (none) | No test file. 0% coverage. Only referenced in integration test imports of background.js but not directly exercised. |
| **shared/shared-component-logic.js** | (none) | No test file. 0% coverage. Contains overlay input handling, lifecycle, and rendering logic. |
| **shared/styling.js** | (none) | No test file. 0% coverage. Contains CSS injection/styling logic. |
| **background.js** | test/integration/message-passing.test.js, test/integration/activation-flow.test.js | Exercised via dynamic import in integration tests. 41.88% line coverage -- message handlers tested but many code paths untested. |
| **bookmark-utils.js** | test/unit/arcify-provider.test.js (indirect) | Only imported via arcify-provider.test.js mock setup. 9.38% line coverage -- folder detection, tree traversal, and import handling largely untested. |
| **logger.js** | (none direct) | No dedicated test. 54.28% coverage from indirect use via other module imports. Log levels partially exercised. |
| **utils.js** | (none) | No test file. 12.50% line coverage from indirect loading. Contains utility functions. |
| **newtab.js** | test/integration/activation-flow.test.js (indirect) | Only indirectly referenced in activation-flow tests. 0% actual coverage -- the test mocks don't execute newtab.js code paths. |
| **overlay.js** | test/integration/activation-flow.test.js (indirect) | Only indirectly referenced. 0% actual coverage -- content script logic is not exercised in node environment tests. |

## Prioritized Gap List

Modules classified as "untested" or "partially tested", ranked by risk.

Risk scoring:
- **Code complexity**: HIGH (>200 lines with branching logic), MEDIUM (100-200 lines or moderate branching), LOW (<100 lines or simple logic)
- **Change frequency**: HIGH (>5 commits), MEDIUM (2-5 commits), LOW (1 commit)
- **User-facing impact**: HIGH (directly affects search results, UI rendering, or user actions), MEDIUM (affects data flow but not directly visible), LOW (internal helpers, logging)
- **Overall risk**: HIGH (2+ high factors), MEDIUM (1 high factor or 2+ medium), LOW (all low/medium)

| Priority | Module | Classification | Lines | Complexity | Change Freq | User Impact | Risk | Recommended Action |
|----------|--------|---------------|-------|------------|-------------|-------------|------|--------------------|
| 1 | bookmark-utils.js | Untested (9%) | 577 | HIGH | LOW (2) | HIGH | HIGH | Add unit tests for folder detection, tree traversal, and import handling. Critical for Arcify bookmark integration. |
| 2 | overlay.js | Untested (0%) | 707 | HIGH | HIGH (8) | HIGH | HIGH | Content script with complex DOM manipulation. Requires DOM mocking strategy. Key user-facing component. |
| 3 | newtab.js | Untested (0%) | 508 | HIGH | HIGH (9) | HIGH | HIGH | New tab page override with full overlay logic. Same DOM challenge as overlay.js. |
| 4 | background-data-provider.js | Partially tested (42%) | 282 | HIGH | HIGH (9) | HIGH | HIGH | Add unit tests for data aggregation, Promise.allSettled orchestration, enrichment pipeline, and partial-failure paths. |
| 5 | shared-component-logic.js | Untested (0%) | 194 | MEDIUM | MEDIUM (4) | HIGH | HIGH | Shared overlay input handling, lifecycle, and rendering. Directly affects both overlay.js and newtab.js user experience. |
| 6 | message-client.js | Untested (0%) | 203 | MEDIUM | MEDIUM (3) | HIGH | HIGH | Message serialization, error handling, response parsing. Foundation for all background-overlay communication. |
| 7 | autocomplete-provider.js | Partially tested (52%) | 188 | MEDIUM | LOW (1) | HIGH | MEDIUM | Add unit tests for Chrome search API integration, result formatting, and error/empty-result paths. |
| 8 | ui-utilities.js | Partially tested (35%) | 352 | HIGH | HIGH (11) | HIGH | MEDIUM | Chip rendering and URL formatting tested; large untested blocks remain (lines 113-165, 228-316). Already has 3 test files -- extend existing coverage. |
| 9 | search-engine.js | Partially tested (64%) | 285 | HIGH | MEDIUM (3) | HIGH | MEDIUM | Functions 100% but lines 63.79%. Error paths and edge cases in search execution untested. Already has 3 test files. |
| 10 | background.js | Partially tested (42%) | 483 | HIGH | HIGH (10) | MEDIUM | MEDIUM | Integration tests exist but many code paths untested. Service worker with command handlers, tab management, storage. |
| 11 | website-name-extractor.js | Untested (4%) | 96 | LOW | LOW (1) | MEDIUM | MEDIUM | Domain name parsing and extraction. Small but used in result display. Add focused unit tests. |
| 12 | popular-sites.js | Partially tested (100% lines) | 249 | MEDIUM | LOW (2) | MEDIUM | LOW | Lines 100% but branches 60%, functions 60%. Add tests for untested branches and helper functions. |
| 13 | logger.js | Partially tested (54%) | 139 | LOW | LOW (1) | LOW | LOW | Internal logging utility. Add basic tests for log levels and formatting if time permits. |
| 14 | utils.js | Untested (13%) | 31 | LOW | LOW (1) | LOW | LOW | Very small utility file. Quick wins for 100% coverage. |
| 15 | styling.js | Untested (0%) | 52 | LOW | LOW (1) | LOW | LOW | CSS injection logic. Limited testability in node environment. Assess if DOM-dependent tests are worthwhile. |

## Recommendations

### Phase 14: Utility Module Tests (Priority 1, 11-12, 14)
Focus on the utility modules with highest gap-to-effort ratio:
- **bookmark-utils.js** (Priority 1): Largest untested file at 577 lines. Critical for Arcify integration. Pure logic functions are highly testable.
- **website-name-extractor.js** (Priority 11): Small file, quick to test. Domain parsing logic is pure and deterministic.
- **popular-sites.js** (Priority 12): Extend existing coverage to hit untested branches and functions.
- **utils.js** (Priority 14): Tiny file, trivial to reach 100%.

### Phase 15: Provider & Component Tests (Priority 4-7, 9)
Focus on the data flow and communication layer:
- **background-data-provider.js** (Priority 4): Core data aggregation with Promise.allSettled. High change frequency indicates active development area.
- **shared-component-logic.js** (Priority 5): Shared overlay logic used by both overlay.js and newtab.js. Testing this covers logic for both entry points.
- **message-client.js** (Priority 6): Foundation for all extension messaging. Error handling and timeout scenarios are critical.
- **autocomplete-provider.js** (Priority 7): Chrome search API wrapper. Mock-based testing is straightforward.
- **search-engine.js** (Priority 9): Extend existing tests to cover error paths and bring line coverage above 80%.

### Phase 16: Low Priority & E2E (Priority 2-3, 8, 10, 13, 15)
Address remaining gaps and structural challenges:
- **overlay.js** and **newtab.js** (Priority 2-3): These are the largest untested files but require DOM mocking. With shared-component-logic.js tested in Phase 15, the unique logic in these files is primarily DOM wiring. Consider targeted tests for critical paths rather than exhaustive coverage.
- **ui-utilities.js** (Priority 8): Extend the 3 existing test files to cover remaining untested blocks.
- **background.js** (Priority 10): Extend integration tests to cover more message handler paths.
- **logger.js** and **styling.js** (Priority 13, 15): Low priority -- test if time permits.
- **E2E investigation**: Document why E2E tests were disabled in CI (commit b991caa) and determine path forward.

### Key Observations

1. **Coverage is concentrated**: 6 modules have >90% coverage (fuse-search-service, scoring-constants, selection-manager, search-types, arcify-provider, popular-sites lines). The remaining 15 modules average ~25%.
2. **Integration tests provide indirect coverage**: background.js, autocomplete-provider.js, and background-data-provider.js get partial coverage from message-passing and activation-flow integration tests, but this coverage is brittle and hard to maintain.
3. **DOM-dependent modules are the biggest gap**: overlay.js (707 lines), newtab.js (508 lines), and shared-component-logic.js (194 lines) total 1,409 lines at 0% coverage. Testing shared-component-logic.js (Phase 15) is the highest-leverage investment since it contains the shared logic used by both UI entry points.
4. **bookmark-utils.js is under-tested relative to its importance**: At 577 lines with only 9% coverage, it handles the entire Arcify bookmark tree traversal that powers the extension's core differentiating feature.
