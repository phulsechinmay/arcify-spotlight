---
phase: 10-weighted-scoring-system
plan: 01
subsystem: scoring
tags: [weighted-scoring, recency, frequency, autocomplete-boost, multi-signal]

# Dependency graph
requires:
  - phase: 09-fuse.js-matching-engine
    provides: "Fuse.js matchScore (0-1) on all search results"
provides:
  - "Weighted multi-signal calculateRelevanceScore with type/match/recency/frequency signals"
  - "Named scoring constants (SCORING_WEIGHTS, TYPE_SCORE_MAP, SCORE_SCALE)"
  - "calculateRecencyScore() and calculateFrequencyScore() helper functions"
  - "Conditional autocomplete boost in scoreAndSortResults"
affects:
  - "10-02 (scoring tests must be updated for new formula)"
  - "12-regression-validation (score output range unchanged, dedup unaffected)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalized additive weighted scoring (4 signals, 0-1 each, configurable weights)"
    - "Exponential recency decay with configurable half-life (24h)"
    - "Logarithmic frequency scaling with configurable cap (100 visits)"
    - "Weight redistribution for non-applicable signals (non-history types)"
    - "Conditional autocomplete boost based on local result sparsity"

key-files:
  created: []
  modified:
    - "shared/scoring-constants.js"
    - "shared/data-providers/base-data-provider.js"

key-decisions:
  - "Keep SCORE_BONUSES import in base-data-provider.js even though unused -- still referenced by tests"
  - "Autocomplete results bypass weighted formula entirely -- they have their own scoring path"
  - "Synthetic matchScore (string matching fallback) takes highest applicable value, not additive"
  - "Weight redistribution for non-history types divides by sum of applicable weights (0.75)"
  - "Score output scaled to 0-115 range for backward compatibility with dedup priority"

patterns-established:
  - "Weighted scoring with configurable constants in scoring-constants.js"
  - "Signal-specific helpers as pure exported functions (calculateRecencyScore, calculateFrequencyScore)"
  - "Type-conditional scoring paths (history gets 4 signals, non-history gets 2 redistributed)"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 10 Plan 01: Weighted Scoring System Summary

**4-signal weighted scoring formula (type 0.40, match 0.35, recency 0.15, frequency 0.10) with exponential recency decay, log-scaled frequency, and conditional autocomplete boost**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T06:34:38Z
- **Completed:** 2026-02-07T06:37:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced flat `base + matchScore * 25` scoring with principled 4-signal weighted formula
- Added recency signal (exponential decay, 24h half-life) and frequency signal (log-scaled, cap at 100) for history items
- Added conditional autocomplete boost that activates when fewer than 3 local results exist
- All scoring weights and thresholds defined as named constants (no magic numbers)
- Score output range 0-115 maintained for backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scoring weights, helpers, and type score map** - `c03acdf` (feat)
2. **Task 2: Refactor calculateRelevanceScore and add autocomplete boost** - `a60c435` (feat)

## Files Created/Modified
- `shared/scoring-constants.js` - Added SCORING_WEIGHTS, TYPE_SCORE_MAP, SCORE_SCALE, calculateRecencyScore, calculateFrequencyScore, AUTOCOMPLETE_BOOST_MAX, LOCAL_RESULT_THRESHOLD (existing exports unchanged)
- `shared/data-providers/base-data-provider.js` - Replaced calculateRelevanceScore with weighted formula, added autocomplete boost to scoreAndSortResults

## Decisions Made
- **Autocomplete bypass:** Autocomplete results skip the weighted formula entirely and keep their base score (30 - position). The conditional boost in scoreAndSortResults handles the sparse-results case.
- **Synthetic matchScore:** When Fuse.js matchScore is unavailable, a synthetic score is computed from string matching (exact=1.0, startsWith=0.8, contains=0.6, URL=0.3, default=0.1). Takes highest applicable value.
- **Weight redistribution:** Non-history types only use TYPE and MATCH signals. Weights are redistributed (0.533/0.467) so these types can still reach the full 0-115 score range.
- **SCORE_BONUSES retained:** Kept in import even though the new formula does not use it -- still referenced by test files and harmless to keep.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scoring formula is complete and produces correct rankings
- Existing scoring tests in `test/unit/scoring.test.js` will need updating (expected values changed) -- this is Plan 10-02
- Score output range (0-115) unchanged, deduplication priority unaffected
- All 5 SCORE requirements addressed: SCORE-01 (weighted formula), SCORE-02 (type hierarchy preserved), SCORE-03 (recency signal), SCORE-04 (frequency signal), SCORE-05 (autocomplete boost)

## Score Range Verification

| Scenario | Score | Notes |
|----------|-------|-------|
| Open tab, perfect match | 115.0 | Max possible |
| Open tab, moderate match (0.6) | 93.5 | Still above bookmark |
| Bookmark, perfect match | 108.2 | Below open tab perfect |
| History, perfect match, 5min ago, 50 visits | 99.0 | Recency+freq boost |
| History, perfect match, 5 days ago, 2 visits | 80.9 | Decayed recency |
| Autocomplete, no boost | 30 | Unchanged base |
| Autocomplete, full boost (0 local) | 70 | Competes with history |

---
*Phase: 10-weighted-scoring-system*
*Completed: 2026-02-07*
