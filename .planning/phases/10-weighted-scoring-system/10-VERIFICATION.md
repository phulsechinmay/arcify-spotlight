---
phase: 10-weighted-scoring-system
verified: 2026-02-06T22:45:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 10: Weighted Scoring System Verification Report

**Phase Goal:** Results are ranked by a multi-signal formula combining match quality, source type, recency, and frequency

**Verified:** 2026-02-06T22:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Results are ordered by a combined score weighing type, match quality, recency, and frequency | ✓ VERIFIED | `calculateRelevanceScore()` implements 4-signal weighted formula (TYPE=0.40, MATCH=0.35, RECENCY=0.15, FREQUENCY=0.10). All signals contribute to final score. |
| 2 | Open tabs still appear above bookmarks and history for equally strong matches | ✓ VERIFIED | TYPE_SCORE_MAP preserves hierarchy: OPEN_TAB=1.0 > PINNED_TAB=0.944 > BOOKMARK=0.889 > HISTORY=0.778 > TOP_SITE=0.667. Test suite confirms type hierarchy with same matchScore. |
| 3 | A page visited 5 minutes ago ranks higher than the same page visited 3 weeks ago | ✓ VERIFIED | `calculateRecencyScore()` uses exponential decay (24h half-life). Test "history visited 5 min ago outranks same page visited 3 weeks ago" passes. |
| 4 | A page visited 50 times ranks higher than one visited twice | ✓ VERIFIED | `calculateFrequencyScore()` uses log-scaling (cap at 100). Test "history with 50 visits outranks same with 2 visits" passes. |
| 5 | Autocomplete suggestions appear in results when few local matches exist | ✓ VERIFIED | `scoreAndSortResults()` applies conditional boost: AUTOCOMPLETE_BOOST_MAX * ((3-localCount)/3) when localCount < 3. Tests verify full boost (0 local), partial (1 local), none (3+ local). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/scoring-constants.js` | Scoring weights, type score map, recency/frequency helpers, autocomplete boost constants | ✓ VERIFIED | 125 lines. Exports: SCORING_WEIGHTS (4 weights sum to 1.0), TYPE_SCORE_MAP (5 result types), SCORE_SCALE (115), calculateRecencyScore(), calculateFrequencyScore(), AUTOCOMPLETE_BOOST_MAX (40), LOCAL_RESULT_THRESHOLD (3). All existing exports preserved. |
| `shared/data-providers/base-data-provider.js` | Weighted multi-signal calculateRelevanceScore and autocomplete boost in scoreAndSortResults | ✓ VERIFIED | 630 lines. calculateRelevanceScore() implements 4-signal formula with weight redistribution for non-history types. scoreAndSortResults() applies conditional autocomplete boost. Imports all new constants from scoring-constants.js. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| base-data-provider.js | scoring-constants.js | import SCORING_WEIGHTS | ✓ WIRED | Line 5: `import { ..., SCORING_WEIGHTS, TYPE_SCORE_MAP, SCORE_SCALE, calculateRecencyScore, calculateFrequencyScore, AUTOCOMPLETE_BOOST_MAX, LOCAL_RESULT_THRESHOLD } from '../scoring-constants.js'` |
| calculateRelevanceScore | result.metadata.lastVisitTime | recency signal for history | ✓ WIRED | Line 415: `calculateRecencyScore(result.metadata?.lastVisitTime)` called when `result.type === ResultType.HISTORY` |
| calculateRelevanceScore | result.metadata.visitCount | frequency signal for history | ✓ WIRED | Line 420: `calculateFrequencyScore(result.metadata?.visitCount)` called when `result.type === ResultType.HISTORY` |
| scoreAndSortResults | AUTOCOMPLETE_BOOST_MAX | conditional boost when local results sparse | ✓ WIRED | Line 362: `r.score += AUTOCOMPLETE_BOOST_MAX * boostFactor` when `localCount < LOCAL_RESULT_THRESHOLD` |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SCORE-01: Weighted multi-signal formula (type + matchQuality + recency + frequency) | ✓ SATISFIED | calculateRelevanceScore() implements 4-signal formula. 66 tests pass including weighted scoring tests. |
| SCORE-02: Source type priority preserved (open tabs > pinned tabs > bookmarks > history > top sites > autocomplete) | ✓ SATISFIED | TYPE_SCORE_MAP defines normalized hierarchy. Test suite "type hierarchy preserved (SCORE-02)" has 3 tests verifying ordering. |
| SCORE-03: History results incorporate recency signal (recently visited pages score higher) | ✓ SATISFIED | calculateRecencyScore() with 24h half-life. Test "history visited 5 min ago outranks same page visited 3 weeks ago" passes. |
| SCORE-04: History results incorporate frequency signal (frequently visited pages score higher) | ✓ SATISFIED | calculateFrequencyScore() with log scaling. Test "history with 50 visits outranks same with 2 visits" passes. |
| SCORE-05: Autocomplete suggestions score competitively when few local results match | ✓ SATISFIED | Conditional boost in scoreAndSortResults(). Test suite "autocomplete boost (SCORE-05)" has 3 tests: full boost (0 local), partial (1 local), none (3+ local). |

### Anti-Patterns Found

No blockers or warnings. Code is clean and well-structured.

### Human Verification Required

None. All success criteria are programmatically verifiable through unit tests and code inspection.

---

## Detailed Verification

### Truth 1: Multi-Signal Weighted Formula

**Verification Method:** Code inspection + unit tests

**Implementation Analysis:**
- `calculateRelevanceScore()` (lines 378-444) implements 4-signal weighted formula
- Signal 1 (TYPE): Uses `TYPE_SCORE_MAP[result.type]` for normalized 0-1 type score
- Signal 2 (MATCH): Uses `result.metadata?.matchScore` from Fuse.js, or computes synthetic matchScore from string matching
- Signal 3 (RECENCY): For history only, calls `calculateRecencyScore(result.metadata?.lastVisitTime)` with exponential decay
- Signal 4 (FREQUENCY): For history only, calls `calculateFrequencyScore(result.metadata?.visitCount)` with log scaling
- Weight distribution: TYPE=0.40 (largest to preserve hierarchy), MATCH=0.35, RECENCY=0.15, FREQUENCY=0.10 (sum=1.0)
- Non-history types use redistributed weights (TYPE/sum=0.533, MATCH/sum=0.467) so they can still reach full 0-115 range

**Test Evidence:**
- 66 tests pass in `test/unit/scoring.test.js`
- Tests verify all 4 signals contribute to score
- Tests verify weight redistribution for non-history types
- Tests verify score range 0-115 maintained

**Conclusion:** ✓ VERIFIED

### Truth 2: Type Hierarchy Preserved

**Verification Method:** Code inspection + unit tests

**Implementation Analysis:**
- `TYPE_SCORE_MAP` defines normalized hierarchy (line 92-98):
  - OPEN_TAB: 1.0 (highest)
  - PINNED_TAB: 0.944
  - BOOKMARK: 0.889
  - HISTORY: 0.778
  - TOP_SITE: 0.667 (lowest)
- TYPE weight (0.40) is largest, ensuring type dominates scoring
- Weight redistribution for non-history preserves relative ordering

**Test Evidence:**
- Test suite "weighted scoring - type hierarchy preserved (SCORE-02)" has 3 tests:
  1. "open tab with same match outranks bookmark" - passes
  2. "open tab outranks history with same match and moderate signals" - passes
  3. "full type hierarchy for same matchScore" - verifies all 5 types in correct order
- Test "preserves non-history type hierarchy: open-tab > pinned-tab > bookmark > top-site" - passes

**Conclusion:** ✓ VERIFIED

### Truth 3: Recency Signal

**Verification Method:** Code inspection + unit tests

**Implementation Analysis:**
- `calculateRecencyScore()` (lines 106-111) implements exponential decay:
  - Half-life: 24 hours (RECENCY_HALF_LIFE_HOURS=24)
  - Formula: `Math.pow(0.5, ageHours / 24)`
  - Returns 1.0 for recent visits, 0.5 at 24h, ~0.01 at 7 days
  - Clock skew protection: returns 1 for future timestamps
- Applied only to history results (line 414: `isHistory ? calculateRecencyScore(...) : 0`)
- Contributes 15% of final score (RECENCY weight = 0.15)

**Test Evidence:**
- Helper tests (6 tests):
  - "returns ~1 for visit just now" - passes
  - "returns ~0.5 for visit 24 hours ago (half-life)" - passes
  - "returns near 0 for visit 7 days ago" - passes
  - "returns 0 for null/undefined lastVisitTime" - passes
  - "returns 1 for future timestamp (clock skew)" - passes
  - "more recent visit scores higher than older visit" - passes
- Integration test:
  - "history visited 5 min ago outranks same page visited 3 weeks ago" - passes
  - Test uses matchScore=0.8, visitCount=5 (same for both), only recency differs

**Conclusion:** ✓ VERIFIED

### Truth 4: Frequency Signal

**Verification Method:** Code inspection + unit tests

**Implementation Analysis:**
- `calculateFrequencyScore()` (lines 117-119) implements log scaling:
  - Cap: 100 visits (FREQUENCY_LOG_CAP = Math.log1p(100))
  - Formula: `Math.min(1, Math.log1p(visitCount) / FREQUENCY_LOG_CAP)`
  - Returns 0 for 0/null visits, ~0.852 for 50 visits, 1.0 for 100+ visits
- Applied only to history results (line 419: `isHistory ? calculateFrequencyScore(...) : 0`)
- Contributes 10% of final score (FREQUENCY weight = 0.10)

**Test Evidence:**
- Helper tests (5 tests):
  - "returns 0 for visitCount 0" - passes
  - "returns 0 for null/undefined visitCount" - passes
  - "returns 1 for visitCount >= 100 (cap)" - passes
  - "higher visit count produces higher score" - passes
  - "returns value between 0 and 1 for typical counts" - passes
- Integration test:
  - "history with 50 visits outranks same with 2 visits" - passes
  - Test uses matchScore=0.8, lastVisitTime=1h ago (same for both), only frequency differs

**Conclusion:** ✓ VERIFIED

### Truth 5: Autocomplete Boost When Few Local Results

**Verification Method:** Code inspection + unit tests

**Implementation Analysis:**
- `scoreAndSortResults()` (lines 346-373) applies conditional boost:
  - Counts non-autocomplete results: `localCount = results.filter(r => r.type !== AUTOCOMPLETE_SUGGESTION).length`
  - If `localCount < LOCAL_RESULT_THRESHOLD (3)`:
    - Computes `boostFactor = (3 - localCount) / 3`
    - Adds `AUTOCOMPLETE_BOOST_MAX (40) * boostFactor` to autocomplete scores
  - Examples:
    - 0 local results: boost = 40 * (3/3) = 40, autocomplete score 30 → 70
    - 1 local result: boost = 40 * (2/3) = 26.67, autocomplete score 30 → 56.67
    - 3+ local results: no boost, autocomplete score stays 30

**Test Evidence:**
- Test suite "weighted scoring - autocomplete boost (SCORE-05)" has 3 tests:
  1. "boosts autocomplete when 0 local results" - verifies score = 70 (30+40)
  2. "partially boosts autocomplete when 1 local result" - verifies score between 30 and 70
  3. "does not boost autocomplete when 3+ local results" - verifies score = 30 (unchanged)

**Conclusion:** ✓ VERIFIED

---

## Test Coverage Summary

**Total Tests:** 66 (all pass)

**Test Distribution by Feature:**
- SCORING_WEIGHTS constants: 2 tests
- calculateRecencyScore helper: 6 tests
- calculateFrequencyScore helper: 5 tests
- Type hierarchy (SCORE-02): 3 tests
- Recency signal (SCORE-03): 2 tests
- Frequency signal (SCORE-04): 1 test
- Autocomplete boost (SCORE-05): 3 tests
- Weight redistribution: 2 tests
- Base scores by type: 4 tests
- Title/URL match bonuses: 6 tests
- matchScore integration: 10 tests
- Case insensitivity: 2 tests
- Utility functions: 20 tests

**Coverage:** All 5 SCORE requirements have corresponding test coverage.

---

## Artifact Quality Assessment

### scoring-constants.js

**Lines:** 125
**Exports:** 16 (8 new + 8 existing preserved)

**Quality Indicators:**
- ✓ All weights are named constants (no magic numbers)
- ✓ Weights sum to 1.0 (verified by test)
- ✓ Type hierarchy clearly documented with comments
- ✓ Helper functions are pure (no side effects)
- ✓ All existing exports preserved for backward compatibility

**Level 1 (Existence):** ✓ EXISTS
**Level 2 (Substantive):** ✓ SUBSTANTIVE (125 lines, no stubs, exports verified)
**Level 3 (Wired):** ✓ WIRED (imported by base-data-provider.js, used by 66 tests)

### base-data-provider.js

**Lines:** 630
**Modified Method:** `calculateRelevanceScore()` (66 lines)
**Added Logic:** Autocomplete boost in `scoreAndSortResults()` (16 lines)

**Quality Indicators:**
- ✓ 4-signal formula implemented correctly
- ✓ Weight redistribution for non-history types
- ✓ Synthetic matchScore fallback when Fuse.js score unavailable
- ✓ Conditional autocomplete boost logic correct
- ✓ Score output range 0-115 maintained (backward compatible)
- ✓ Clear comments explaining each signal

**Level 1 (Existence):** ✓ EXISTS
**Level 2 (Substantive):** ✓ SUBSTANTIVE (630 lines, real implementation, no stubs)
**Level 3 (Wired):** ✓ WIRED (imports scoring-constants, used by scoring tests, called by search pipeline)

### test/unit/scoring.test.js

**Lines:** 679
**Tests:** 66 (all pass)

**Quality Indicators:**
- ✓ All 5 SCORE requirements have test coverage
- ✓ Tests use relative assertions (resilient to weight tuning)
- ✓ Edge cases covered (null, 0, future timestamps, clock skew)
- ✓ Helper functions tested independently
- ✓ Integration tests verify end-to-end scoring behavior

**Level 1 (Existence):** ✓ EXISTS
**Level 2 (Substantive):** ✓ SUBSTANTIVE (679 lines, comprehensive test coverage)
**Level 3 (Wired):** ✓ WIRED (imports both scoring-constants and base-data-provider, runs in CI)

---

## Implementation Highlights

### 1. Weight Redistribution for Non-History Types

The implementation correctly handles the asymmetry where only history items have recency/frequency data:

```javascript
if (isHistory) {
    // All 4 weights apply (sum = 1.0)
    weightedScore =
        SCORING_WEIGHTS.TYPE * typeScore +
        SCORING_WEIGHTS.MATCH * matchQuality +
        SCORING_WEIGHTS.RECENCY * recencyScore +
        SCORING_WEIGHTS.FREQUENCY * frequencyScore;
} else {
    // Only TYPE and MATCH apply, redistributed to sum to 1.0
    const weightSum = SCORING_WEIGHTS.TYPE + SCORING_WEIGHTS.MATCH;
    const effectiveTypeWeight = SCORING_WEIGHTS.TYPE / weightSum;
    const effectiveMatchWeight = SCORING_WEIGHTS.MATCH / weightSum;
    weightedScore =
        effectiveTypeWeight * typeScore +
        effectiveMatchWeight * matchQuality;
}
```

This ensures non-history types can still reach the full 0-115 score range.

### 2. Synthetic Match Score Fallback

When Fuse.js matchScore is unavailable (e.g., top sites, fuzzy domain matches), the implementation computes a synthetic score from string matching:

```javascript
if (titleLower === queryLower) {
    syntheticScore = 1.0;
} else if (titleLower.startsWith(queryLower)) {
    syntheticScore = 0.8;
} else if (titleLower.includes(queryLower)) {
    syntheticScore = 0.6;
}
if (urlLower.includes(queryLower) && syntheticScore < 0.3) {
    syntheticScore = 0.3;
}
```

This gracefully handles mixed result sources while maintaining consistent scoring behavior.

### 3. Autocomplete Boost Mechanics

The boost is proportional to sparsity:
- 0 local results: 100% boost (40 points added)
- 1 local result: 67% boost (26.67 points added)
- 2 local results: 33% boost (13.33 points added)
- 3+ local results: 0% boost (no change)

This ensures autocomplete suggestions appear when the user needs them (sparse local matches) but don't dominate when strong local matches exist.

---

## Backward Compatibility

✓ **Score Output Range:** 0-115 maintained (SCORE_SCALE = 115)
✓ **Deduplication Priority:** getResultPriority() still uses BASE_SCORES (unchanged)
✓ **Existing Exports:** All BASE_SCORES and SCORE_BONUSES preserved in scoring-constants.js
✓ **Test Suite:** 66/66 tests pass (0 failures)

---

_Verified: 2026-02-06T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
