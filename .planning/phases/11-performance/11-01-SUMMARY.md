---
phase: 11-performance
plan: 01
subsystem: performance
tags: [promise-allsettled, debounce, parallel-fetching, search-pipeline]

# Dependency graph
requires:
  - phase: 09-fuse-matching-engine
    provides: Fuse.js-based matching in all data sources
  - phase: 10-weighted-scoring
    provides: Multi-signal scoring formula applied after fetching
provides:
  - Parallel data source fetching via Promise.allSettled (PERF-01)
  - Single debounce layer at UI level only (PERF-02)
affects: [11-performance (plans 02-03), 12-regression-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [Promise.allSettled for parallel independent async, single-debounce-layer architecture]

key-files:
  created: []
  modified:
    - shared/data-providers/base-data-provider.js
    - background.js

key-decisions:
  - "Promise.allSettled over Promise.all for error isolation across 6 independent data sources"
  - "Retain getSpotlightSuggestionsUsingCache() in SearchEngine for backward compatibility"
  - "Route all background handler queries through getSpotlightSuggestionsImmediate()"

patterns-established:
  - "Parallel fetching: All independent data source calls wrapped in Promise.allSettled with per-source fallback to empty array"
  - "Single debounce: UI-layer debounce (SharedSpotlightLogic.createInputHandler 150ms) is the sole debounce point; background uses immediate path"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 11 Plan 01: Parallel Data Fetching & Single Debounce Summary

**Promise.allSettled parallel fetching for 6 data sources and single-layer 150ms debounce (eliminating ~300ms double debounce)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T07:09:07Z
- **Completed:** 2026-02-07T07:10:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced 6 sequential try/catch data fetcher blocks with single Promise.allSettled() call, enabling parallel fetching of tabs, pinned tabs, bookmarks, history, top sites, and autocomplete
- Eliminated double debounce (overlay 150ms + SearchEngine 150ms = ~300ms) by routing background handler through getSpotlightSuggestionsImmediate(), reducing effective debounce to 150ms
- All 320 existing tests pass with zero changes needed -- the refactoring preserved all method signatures and return values

## Task Commits

Each task was committed atomically:

1. **Task 1: Parallelize data source fetching with Promise.allSettled** - `cdaf6b3` (perf)
2. **Task 2: Eliminate double debouncing by routing background handler through immediate path** - `261a900` (perf)

## Files Created/Modified
- `shared/data-providers/base-data-provider.js` - Replaced 6 sequential try/catch blocks (57 lines) with Promise.allSettled (17 lines) for parallel data fetching
- `background.js` - Changed getSpotlightSuggestions handler to use getSpotlightSuggestionsImmediate() for all queries

## Decisions Made
- **Promise.allSettled over Promise.all:** allSettled provides per-source error isolation -- if one source fails (e.g., autocomplete network timeout), all other source results are preserved. Promise.all would discard everything on any single rejection.
- **Retain getSpotlightSuggestionsUsingCache():** The method is kept in SearchEngine for backward compatibility and potential future use (e.g., direct SearchEngine consumers). Only the background.js message handler routing was changed.
- **No changes to search-engine.js production code:** The plan specified no production code changes to SearchEngine, and this was followed exactly. The method still exists, and the cache is intact.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Parallel fetching (PERF-01) and single debounce (PERF-02) are complete
- Plan 11-02 (progressive rendering / PERF-03) can proceed -- it builds on the Promise.allSettled pattern established here by splitting local vs autocomplete phases
- Plan 11-03 (debounce/cache test updates) can proceed -- the debounce behavior change is committed and tests need updating to reflect the new single-debounce architecture
- No blockers or concerns

---
*Phase: 11-performance*
*Completed: 2026-02-07*
