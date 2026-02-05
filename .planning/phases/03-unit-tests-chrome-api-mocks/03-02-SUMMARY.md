---
phase: 03-unit-tests-chrome-api-mocks
plan: 02
subsystem: testing
tags: [vitest, debounce, chrome-api, action-routing, mocking]

dependency-graph:
  requires:
    - 03-01 (chrome mock setup, cache tests)
  provides:
    - Debounce behavior verification tests
    - Action routing Chrome API tests
  affects:
    - 04-01 (integration tests will build on mocking patterns)

tech-stack:
  added: []
  patterns:
    - vi.advanceTimersByTimeAsync for debounced async functions
    - it.each() for table-driven API routing tests
    - chromeMock verification for Chrome API calls

key-files:
  created:
    - test/unit/search-engine-debounce.test.js
    - test/unit/action-routing.test.js
  modified: []

decisions:
  - id: DEBOUNCE-ASYNC
    choice: "Use vi.advanceTimersByTimeAsync() consistently"
    reason: "Prevents promise/timer deadlocks in debounced async tests"
  - id: ACTION-ROUTING-TABLE
    choice: "Table-driven tests with it.each() for URL result types"
    reason: "URL_SUGGESTION, BOOKMARK, HISTORY, TOP_SITE share same routing logic"
  - id: BACKGROUND-ONLY-SCOPE
    choice: "Test only isBackgroundProvider: true path"
    reason: "Content script path uses message passing which is Phase 4 scope"

metrics:
  duration: "~2 minutes"
  completed: 2026-02-05
---

# Phase 03 Plan 02: SearchEngine Debounce and Action Routing Tests Summary

**One-liner:** 40 tests verifying debounce coalescing and Chrome API action routing using vi.advanceTimersByTimeAsync and chromeMock.

## What Was Built

### 1. SearchEngine Debounce Tests (9 tests)
Tests verifying debounce mechanism prevents rapid-fire API calls:

- **Rapid query coalescing:** Multiple queries within 150ms window trigger only final query
- **Query cancellation:** New query cancels pending debounced query even at boundary
- **Separate windows:** Queries after debounce delay trigger independently
- **Empty query handling:** Empty strings debounce normally and cancel pending queries
- **Mode handling:** Mode changes during debounce window only trigger final mode

Key pattern using async timer advancement:
```javascript
engine.getSpotlightSuggestionsUsingCache('t', 'current-tab');
await vi.advanceTimersByTimeAsync(50);
engine.getSpotlightSuggestionsUsingCache('te', 'current-tab');
await vi.advanceTimersByTimeAsync(50);
// ... only final query triggers provider
```

### 2. Action Routing Tests (31 tests)
Tests verifying handleResultAction calls correct Chrome APIs:

**OPEN_TAB routing:**
- NEW_TAB mode: `chrome.tabs.update(tabId, {active: true})` + `chrome.windows.update(windowId, {focused: true})`
- CURRENT_TAB mode: `chrome.tabs.update(currentTabId, {url: ...})` or queries active tab

**URL-based types (URL_SUGGESTION, BOOKMARK, HISTORY, TOP_SITE):**
- NEW_TAB mode: `chrome.tabs.create({url: ...})`
- CURRENT_TAB mode: `chrome.tabs.update(currentTabId, {url: ...})`

**SEARCH_QUERY:**
- `chrome.search.query({text: query, disposition: 'NEW_TAB' | 'CURRENT_TAB'})`

**Error cases (10 tests):**
- OPEN_TAB without tabId throws
- URL types without url throw
- SEARCH_QUERY without metadata.query throws
- Unknown result type throws
- No active tab found throws

Table-driven pattern:
```javascript
it.each([
    [ResultType.URL_SUGGESTION],
    [ResultType.BOOKMARK],
    [ResultType.HISTORY],
    [ResultType.TOP_SITE],
])('%s in NEW_TAB mode calls chrome.tabs.create', async (resultType) => {
    // Test body
});
```

## Commits

| Hash | Message |
|------|---------|
| a41243c | test(03-02): add SearchEngine debounce behavior tests |
| b4fdfe6 | test(03-02): add SearchEngine action routing tests |

## Test Count Progression

| Milestone | Tests |
|-----------|-------|
| Before Plan 03-02 | 157 |
| After Task 1 (debounce) | 166 |
| After Task 2 (action routing) | 197 |
| **Total Added** | **40** |

## Verification Results

```
npm test
 9 test files passed (197 tests)
 - search-engine-debounce.test.js: 9 tests
 - action-routing.test.js: 31 tests
```

## Success Criteria Met

1. [x] Debounce tests verify rapid queries (< 150ms apart) trigger only one API call
2. [x] Debounce tests verify new query cancels pending debounced query
3. [x] Action routing tests verify OPEN_TAB calls chrome.tabs.update for tab switching
4. [x] Action routing tests verify URL types call chrome.tabs.create for NEW_TAB mode
5. [x] Action routing tests verify SEARCH_QUERY calls chrome.search.query with correct disposition
6. [x] All tests pass without flakiness (using async timer advancement)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for Plan 03-03:** Message passing tests

Dependencies satisfied:
- Chrome mock has all required APIs (tabs, windows, search, runtime.sendMessage)
- Timer mocking patterns established
- Table-driven test patterns proven for result types
- Error handling patterns verified

Phase 3 requirements complete: 2/3
- [x] 03-01: Cache behavior tests
- [x] 03-02: Debounce and action routing tests
- [ ] 03-03: Message passing tests
