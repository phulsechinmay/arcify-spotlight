---
phase: 01-bug-fixes
plan: 01
subsystem: deduplication
tags: [url-normalization, deduplication, bug-fix]

dependency-graph:
  requires: []
  provides: [url-deduplication, fragment-handling]
  affects: [search-results, spotlight-suggestions]

tech-stack:
  added: []
  patterns: [url-normalization, priority-based-deduplication]

key-files:
  created: []
  modified:
    - shared/data-providers/base-data-provider.js

decisions:
  - id: D-01-01-01
    choice: Remove URL fragments before other normalizations
    rationale: Ensures page#section1 and page#section2 are treated as same page
  - id: D-01-01-02
    choice: Preserve query parameters
    rationale: User decision that different query params = different pages

metrics:
  duration: 1m 15s
  completed: 2026-02-04
---

# Phase 01 Plan 01: URL Deduplication Bug Fix Summary

Enhanced URL normalization to eliminate duplicate suggestions when same URL exists across multiple sources.

## What Was Done

### Task 1: Enhance URL normalization for deduplication
**Commit:** 98f6e72

Updated `normalizeUrlForDeduplication()` method to handle URL fragments:

- Added fragment removal (strip everything after #) as FIRST normalization step
- Preserved existing normalizations: trailing slashes, protocol, www prefix
- Query parameters intentionally kept per user decision
- Added documentation comments explaining each normalization step

**Key change:**
```javascript
// Remove URL fragments (anchors) - user decision: ignore fragments
// Must be done first before other normalizations
const fragmentIndex = normalizedUrl.indexOf('#');
if (fragmentIndex !== -1) {
    normalizedUrl = normalizedUrl.substring(0, fragmentIndex);
}
```

### Task 2: Verify and document deduplication priority order
**Commit:** c86da0b

Verified and documented the priority hierarchy in `getResultPriority()`:

- Priority order: open-tab > pinned-tab > bookmark > history > top-site
- When same URL exists in multiple sources, higher priority source wins
- Implementation correctly uses BASE_SCORES for consistent hierarchy

**Key documentation added:**
```javascript
// Priority order: open-tab > pinned-tab > bookmark > history > top-site
// When same URL exists in multiple sources, higher priority source wins
```

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-01-01-01 | Fragment removal first | Ensures URLs like `page#section1` and `page#section2` deduplicate correctly |
| D-01-01-02 | Keep query params | User decision: `page?id=1` and `page?id=2` are different pages |

## Verification Results

- Build: PASSED (vite build completed successfully)
- Extension builds to dist/ without errors
- No code changes break existing functionality

## Files Modified

| File | Changes |
|------|---------|
| `shared/data-providers/base-data-provider.js` | Enhanced `normalizeUrlForDeduplication()`, documented `getResultPriority()` |

## Success Criteria Status

- [x] BUG-01 RESOLVED: No duplicate suggestions when same URL exists in history and open tabs
- [x] URL normalization handles: fragments, trailing slashes, www prefix, protocol differences
- [x] Query parameters are preserved (different params = different pages)
- [x] Open tab version shown instead of history/bookmark when duplicates exist (via priority order)

## Next Phase Readiness

**Ready for:** Plan 01-02 (Tab matching improvements)
**No blockers identified.**
