# Phase 15: Provider & Component Tests - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Write unit tests for the four data provider and component logic modules: `autocomplete-provider.js`, `background-data-provider.js`, `shared-component-logic.js`, and `message-client.js`. Tests cover integration points, data flow, and error handling. No source code changes — test-only additions.

</domain>

<decisions>
## Implementation Decisions

### Mock Strategy
- Extend existing `test/mocks/chrome.js` — add missing Chrome APIs as needed, same pattern as Phase 14
- Mock at the Chrome API level (e.g., `chrome.runtime.sendMessage` returns canned data) — tests exercise full module flow including serialization
- Most tests use synchronous resolved promises for speed; a few dedicated tests use small delays to validate race conditions and async timing in Promise.allSettled flows
- Use jsdom (Vitest default) for shared-component-logic.js DOM manipulation — full DOM environment, closer to browser behavior

### Test Isolation Level
- One test file per module (autocomplete-provider.test.js, background-data-provider.test.js, shared-component-logic.test.js, message-client.test.js)
- Mock Chrome APIs but allow modules to call each other — catches interface mismatches between providers
- message-client.js: test that sendMessage is called with correct action type (not exact payload shape) — simpler, less brittle
- shared-component-logic.js: full lifecycle tests (show overlay → type → render suggestions → select) — catches integration issues between functions

### Error Scenario Depth
- background-data-provider: test ALL combinations of source success/failure (tabs fail + history ok, tabs ok + history fail, both fail, etc.) — exhaustive partial-failure coverage
- message-client: include runtime-unavailable scenarios (chrome.runtime undefined or throwing) — happens during extension updates/crashes
- autocomplete-provider: test malformed/unexpected data from Chrome search API (missing fields, null values, unexpected shapes) — defensive testing
- shared-component-logic: test DOM manipulation failures (missing elements, null references) — happens during rapid show/hide cycles

### Coverage Targets
- 80%+ line, function, AND branch coverage across all four modules
- Even thin API wrappers must be tested — verify they call the right APIs with right args
- Full test suite (491+ existing tests) must pass with no regressions after adding new tests

### Claude's Discretion
- Exact test count per module
- How to structure describe/it blocks within each test file
- Which specific mock return values to use in test cases
- Order of test execution within files

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching Phase 14 patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-provider-component-tests*
*Context gathered: 2026-02-13*
