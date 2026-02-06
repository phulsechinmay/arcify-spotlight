---
phase: quick
plan: 002
subsystem: testing
tags: [e2e, puppeteer, tab-groups, space-chip, message-passing]
requires: [quick-001]
provides: [e2e-tab-group-space-chip-coverage]
affects: [08-02]
tech-stack:
  patterns: [overlay-mode-e2e, service-worker-tab-group-api]
key-files:
  created: []
  modified:
    - test/e2e/tests/spotlight.e2e.test.js
    - background.js
decisions:
  - id: q002-d1
    title: Overlay mode for tab group E2E tests
    rationale: "Overlay mode (content script on regular page) provides reliable message passing to background. New tab page had issues with default results loading."
  - id: q002-d2
    title: Search by title not URL
    rationale: "Searching by URL generates an instant URL suggestion that deduplicates away the tab result with group metadata. Searching by title avoids this."
metrics:
  duration: ~15min
  completed: 2026-02-06
---

# Quick Task 002: E2E Tab Group Space Chip Summary

E2E tests for the full tab group space chip pipeline -- Chrome tab group API through background data provider enrichment to visible chip rendering in Spotlight overlay.

## What Was Done

### Task 1: Add E2E tests for tab group space chip display

Added two new E2E tests under `describe('E2E-05: Tab Group Space Chip')` in `test/e2e/tests/spotlight.e2e.test.js`:

**Test 1: "shows space chip with group name for a grouped tab suggestion"**
- Opens example.com in a new tab
- Creates a Chrome tab group named "Research" with color "blue" via `worker.evaluate()` calling `chrome.tabs.group()` and `chrome.tabGroups.update()`
- Opens a second page (google.com) and triggers Spotlight as overlay via service worker
- Types "Example" to search for the grouped tab
- Polls for `.arcify-space-chip` to appear in results (async background results)
- Asserts: chip text is "Research", title attribute is "Research", text color includes rgb(139, 179, 243), background includes rgb(139, 179, 243)

**Test 2: "does NOT show space chip for a non-grouped tab suggestion"**
- Opens example.com (no tab group)
- Opens Spotlight as overlay on google.com
- Types "Example" and waits for results
- Asserts: no `.arcify-space-chip` found on any result

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async onMessage listener breaking message passing**

- **Found during:** Task 1 (E2E test debugging)
- **Issue:** The first `chrome.runtime.onMessage.addListener` in `background.js` (line 185) was declared as an `async function`. In Chrome's messaging API, an async listener returns a Promise (truthy), which Chrome interprets as "I will call sendResponse later." This caused the first listener to steal the response channel for ALL messages -- even ones it doesn't handle (like `getSpotlightSuggestions`). The second listener that actually handles search queries would call `sendResponse`, but Chrome had already assigned the response channel to the first listener, so the response was lost.
- **Impact:** All async search results from the background (tab results, bookmarks, history) never arrived at the UI. Only instant suggestions (client-side generated) worked. This affected both newtab page and overlay mode.
- **Fix:** Changed `async function` to regular `function`. The `injectSpotlightScript()` calls don't need `await` -- they're fire-and-forget.
- **Files modified:** `background.js`
- **Commit:** e515304

**2. [Rule 3 - Blocking] Used overlay mode instead of newtab page for tests**

- **Found during:** Task 1 (test design)
- **Issue:** The plan specified using `openNewTabPage` and searching for the grouped tab. However, the newtab page's search input has a `handleSelectionChange` callback that modifies `input.value` when the selection manager auto-selects the first result. When using `page.type()` character-by-character, this creates interference between selection-driven input changes and search-driven input events.
- **Fix:** Tests use overlay mode (content script injection on google.com) following the E2E-04 pattern. Spotlight is triggered via `worker.evaluate()` sending `activateSpotlight` message to the content script. This provides a clean search experience without selection-driven interference.
- **Files modified:** `test/e2e/tests/spotlight.e2e.test.js`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Overlay mode for tab group tests | Content script overlay provides cleaner message pipeline than newtab page for E2E testing |
| Search by title ("Example") not URL ("example.com") | URL-format queries generate instant URL suggestions that deduplicate away the tab result with group metadata |
| Fire-and-forget for injectSpotlightScript | The function's result isn't needed by the listener; removing await eliminates the async requirement |

## Test Results

```
11 tests passing (9 existing + 2 new)
- E2E-01: Full Search Flow (3 tests)
- E2E-02: Keyboard Navigation (4 tests)
- E2E-03: Tab Switching (1 test)
- E2E-04: Overlay on Regular Page (1 test)
- E2E-05: Tab Group Space Chip (2 tests) [NEW]
```

294 unit/integration tests continue to pass.

## Pipeline Coverage

The new E2E-05 tests validate the complete space chip pipeline:

1. `chrome.tabs.group()` + `chrome.tabGroups.update()` (Chrome API)
2. `BackgroundDataProvider.getOpenTabsData()` (queries tabs + tab groups, builds groupMap)
3. `BaseDataProvider.getOpenTabs()` (maps groupName/groupColor into SearchResult metadata)
4. `SpotlightUtils.generateSpaceChipHTML()` (reads metadata.groupName/groupColor, generates chip HTML)
5. `SharedSpotlightLogic.generateResultsHTML()` (includes chip in result layout)
6. DOM assertion: `.arcify-space-chip` element with correct text, title, and color styles
