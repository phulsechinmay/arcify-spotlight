# Phase 10: Weighted Scoring System - Research

**Researched:** 2026-02-06
**Domain:** Multi-signal relevance scoring for browser extension search results
**Confidence:** HIGH

## Summary

This research investigates how to replace the current flat `base + matchScore * 25` scoring formula in `calculateRelevanceScore()` with a weighted multi-signal formula that incorporates match quality (from Fuse.js), source type priority, recency, and frequency. The current system already has all the raw data needed -- `visitCount` and `lastVisitTime` are collected in history metadata (since Phase 9) but unused in scoring, and `matchScore` (0-1) from Fuse.js is available on all data sources.

The approach is to refactor `calculateRelevanceScore()` in `base-data-provider.js` into a multi-signal scoring function. Each signal is normalized to 0-1 and multiplied by a configurable weight. The signals are: (1) type priority (existing hierarchy), (2) match quality (Fuse.js matchScore), (3) recency (exponential decay on lastVisitTime), (4) frequency (log-scaled visitCount). Additionally, autocomplete scoring needs a conditional boost when local results are sparse, so autocomplete suggestions become visible when they are most useful.

No new libraries are needed. This is purely a refactoring of the scoring formula in `scoring-constants.js` and `calculateRelevanceScore()` in `base-data-provider.js`, plus updating existing tests.

**Primary recommendation:** Refactor `calculateRelevanceScore()` to use a weighted multi-signal formula with configurable weights, add recency and frequency computations for history items, and add a conditional autocomplete boost when local result count is low. All weights and thresholds should be defined as named constants in `scoring-constants.js`.

## Standard Stack

### Core

No new libraries needed. This phase operates entirely within the existing codebase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none) | - | - | Pure algorithmic change to scoring formula |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| vitest | (existing) | Unit tests for scoring | Validate all scoring scenarios |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled weighted formula | TF-IDF library | Over-engineering for 6 signals and <100 items per search |
| Linear weights | Machine-learned weights | No training data, no infrastructure; linear weights are tunable and debuggable |
| Additive scoring | Multiplicative scoring | Additive is easier to reason about and debug; multiplicative can produce extreme values |

## Architecture Patterns

### Recommended Project Structure

No new files are needed. Changes are confined to existing files:

```
shared/
  scoring-constants.js        # Add weight constants, recency/frequency helpers
  data-providers/
    base-data-provider.js     # Refactor calculateRelevanceScore()
test/
  unit/
    scoring.test.js           # Update/expand tests for multi-signal scoring
```

### Pattern 1: Normalized Additive Weighted Scoring

**What:** Each scoring signal is normalized to a 0-1 range, multiplied by a weight, and summed. The final score is a single number where higher = better.

**When to use:** When combining heterogeneous signals (type enum, match quality float, timestamp, count) into a single ranking score.

**Why additive over multiplicative:** Additive scoring ensures that a zero in one signal does not zero out the entire score. A history item with visitCount=0 should still rank based on type, match quality, and recency.

**Formula:**

```javascript
// Weighted multi-signal formula
score = (w_type * typeScore) + (w_match * matchQuality) + (w_recency * recencyScore) + (w_frequency * frequencyScore)

// Where:
// typeScore     = BASE_SCORES[type] / MAX_BASE_SCORE  (normalized 0-1)
// matchQuality  = metadata.matchScore                 (already 0-1 from Fuse.js)
// recencyScore  = exponential decay on lastVisitTime  (0-1, history only, 0 for non-history)
// frequencyScore = log-scaled visitCount              (0-1, history only, 0 for non-history)
```

**Recommended weights:**

```javascript
const SCORING_WEIGHTS = {
    TYPE:      0.40,   // Source type is the strongest signal (preserves hierarchy)
    MATCH:     0.35,   // Match quality is the second strongest signal
    RECENCY:   0.15,   // Recency matters for history items
    FREQUENCY: 0.10,   // Frequency is a supporting signal
};
// Weights sum to 1.0 for a max theoretical score of 1.0
```

**Why these weights:**
- TYPE at 0.40: Requirement SCORE-02 explicitly states "source type priority preserved." This must be the dominant signal so that open tabs still rank above bookmarks for equally strong matches.
- MATCH at 0.35: Match quality is the primary differentiator within a type tier. A perfect match for "github" should rank above a fuzzy match for "github" regardless of other signals.
- RECENCY at 0.15: Requirement SCORE-03 says "recently visited pages score higher." This needs enough weight to visibly affect ranking but not enough to override type hierarchy.
- FREQUENCY at 0.10: Requirement SCORE-04 says "frequently visited pages score higher." This is a supporting signal that should tiebreak between equally recent results.

### Pattern 2: Exponential Recency Decay

**What:** Convert `lastVisitTime` (epoch ms) to a 0-1 score using exponential decay. Recent visits score close to 1, old visits decay toward 0.

**When to use:** For history results that have `lastVisitTime` in metadata.

**Why exponential over linear:** Linear decay treats 1 hour ago and 6 hours ago as nearly identical. Exponential decay correctly captures that a page visited 5 minutes ago is dramatically more relevant than one visited 6 hours ago.

```javascript
// Exponential decay with configurable half-life
function calculateRecencyScore(lastVisitTime) {
    if (!lastVisitTime) return 0;
    const ageMs = Date.now() - lastVisitTime;
    const ageHours = ageMs / (1000 * 60 * 60);
    const halfLifeHours = 24; // Score halves every 24 hours
    return Math.pow(0.5, ageHours / halfLifeHours);
}

// Examples:
// Visited 5 min ago:   ageHours = 0.083  -> score = 0.997
// Visited 1 hour ago:  ageHours = 1      -> score = 0.972
// Visited 6 hours ago: ageHours = 6      -> score = 0.841
// Visited 24 hours ago: ageHours = 24    -> score = 0.500
// Visited 3 days ago:  ageHours = 72     -> score = 0.125
// Visited 7 days ago:  ageHours = 168    -> score = 0.008
```

### Pattern 3: Logarithmic Frequency Scaling

**What:** Convert `visitCount` to a 0-1 score using logarithmic scaling. This prevents high-count pages from dominating.

**When to use:** For history results that have `visitCount` in metadata.

**Why logarithmic:** Raw visit counts vary enormously (1 vs 500). Linear scaling would make a 500-visit page completely dominate. Log scaling compresses the range: the difference between 1 visit and 10 visits is meaningful, but the difference between 100 and 500 visits is less so.

```javascript
function calculateFrequencyScore(visitCount) {
    if (!visitCount || visitCount <= 0) return 0;
    // log1p(x) = ln(1 + x), avoids log(0)
    // Normalize to 0-1 range with a reasonable cap
    const LOG_CAP = Math.log1p(100); // ~4.615
    return Math.min(1, Math.log1p(visitCount) / LOG_CAP);
}

// Examples:
// visitCount = 1:   score = 0.150
// visitCount = 5:   score = 0.388
// visitCount = 10:  score = 0.519
// visitCount = 25:  score = 0.705
// visitCount = 50:  score = 0.852
// visitCount = 100: score = 1.000
// visitCount = 500: score = 1.000 (capped)
```

### Pattern 4: Conditional Autocomplete Boost

**What:** When local results (non-autocomplete) are sparse, boost autocomplete scores so they become visible.

**When to use:** After collecting all results but before final sorting (in `getSpotlightSuggestions()` or `scoreAndSortResults()`).

**Why:** Requirement SCORE-05 states "autocomplete suggestions score competitively when few local results match." The current base score of 30 means autocomplete results never appear when ANY local result exists (lowest local base is 60). Instead of raising the base permanently (which would pollute results when local data is plentiful), apply a conditional boost.

```javascript
// In scoreAndSortResults or getSpotlightSuggestions:
const localResults = results.filter(r => r.type !== ResultType.AUTOCOMPLETE_SUGGESTION);
const autocompleteResults = results.filter(r => r.type === ResultType.AUTOCOMPLETE_SUGGESTION);

if (localResults.length < 3 && autocompleteResults.length > 0) {
    // Boost autocomplete to compete with history-level results
    const boostFactor = (3 - localResults.length) / 3; // 1.0 when 0 local, 0.67 when 1, 0.33 when 2
    autocompleteResults.forEach(r => {
        r.score += AUTOCOMPLETE_BOOST_MAX * boostFactor;
    });
}
```

### Pattern 5: Final Score Scaling for Output

**What:** The weighted formula produces a 0-1 score, but the current system uses scores in the 0-115 range. Scale the final score to the existing range for backward compatibility.

**When to use:** At the end of `calculateRelevanceScore()`.

**Why:** The rest of the system (deduplication priority, result sorting) expects higher-is-better numeric scores. Keeping the output in a similar range avoids breaking other code that compares scores.

```javascript
// Scale 0-1 weighted score to 0-115 range (matching current max: 90 + 25)
const SCORE_SCALE = 115;
return weightedScore * SCORE_SCALE;
```

### Anti-Patterns to Avoid

- **Trying to tune weights to perfection before shipping:** Start with the recommended weights, test with real queries, and iterate. Weights are named constants -- easy to adjust.

- **Making recency/frequency affect non-history types:** Only history items have meaningful `visitCount` and `lastVisitTime`. Applying these signals to tabs, bookmarks, or autocomplete results would produce meaningless scores. When these signals are not applicable, they should contribute 0 to the score, and the remaining weights should effectively redistribute.

- **Breaking the type hierarchy with extreme weights:** If MATCH weight is too high (e.g., 0.8), a low-type result with a perfect match could outrank a high-type result with a moderate match. This violates SCORE-02. The TYPE weight must be high enough to preserve the hierarchy for equally-matched results.

- **Normalizing autocomplete scores the same way:** Autocomplete results do not have Fuse.js matchScore, visitCount, or lastVisitTime. They need their own scoring path (base score + position penalty + conditional boost).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential decay | Manual `Math.pow()` with raw timestamps | Named helper function with configurable half-life constant | Raw timestamp math is error-prone; half-life is a single tuning knob |
| Log scaling | Division by hardcoded max visit count | `Math.log1p()` with configurable cap constant | Linear division by max is fragile; log naturally compresses |
| Weight tuning | Hardcoded magic numbers in scoring formula | Named constants in `scoring-constants.js` | Named constants are self-documenting and easy to find/adjust |
| Signal normalization | Ad-hoc range mapping per signal | Consistent 0-1 normalization for all signals | Makes weight comparison meaningful; 0.4 type vs 0.35 match is intuitive |

**Key insight:** The current scoring system already has the right structure (base score + bonus). The refactoring replaces the additive bonus approach with a weighted formula, keeping the same inputs and outputs but producing better rankings.

## Common Pitfalls

### Pitfall 1: Breaking the Type Hierarchy (SCORE-02 Violation)

**What goes wrong:** With poorly chosen weights, a history item with a perfect match could outrank an open tab with a moderate match. Users expect open tabs to always appear near the top.

**Why it happens:** If MATCH weight is too high relative to TYPE weight, the type hierarchy is no longer the dominant factor.

**How to avoid:** Set TYPE weight >= MATCH weight (0.40 >= 0.35). Verify with test cases:
- Open tab (matchScore 0.6) should outrank bookmark (matchScore 0.9) -- or at least be very close
- Open tab (matchScore 0.6) should outrank history (matchScore 1.0) -- type gap must overcome match gap

**Warning signs:** Tests showing bookmarks or history items ranking above open tabs for the same query.

### Pitfall 2: Recency/Frequency for Non-History Types

**What goes wrong:** Applying recency/frequency signals to tabs, bookmarks, or autocomplete produces meaningless scores or errors (undefined metadata fields).

**Why it happens:** Only history items have `visitCount` and `lastVisitTime`. Other types have different metadata structures.

**How to avoid:** In the scoring function, check the result type before accessing recency/frequency metadata. For non-history types, these signals contribute 0. Effectively, non-history items are scored as: `TYPE * 0.40 + MATCH * 0.35 + 0 + 0 = weighted on type + match only, up to 0.75`.

**This creates a problem:** Non-history items can never reach the full 1.0 score because two signals are always 0. The solution is to redistribute weights for non-history types OR normalize so the achievable maximum for each type is still competitive.

**Recommended approach:** For non-history types, use adjusted weights that sum to 1.0:
```javascript
// Non-history effective weights (redistributed):
// TYPE:  0.40 / 0.75 = 0.533
// MATCH: 0.35 / 0.75 = 0.467
```
This can be implemented simply by dividing by the sum of applicable weights.

### Pitfall 3: Autocomplete Score Collapse

**What goes wrong:** Autocomplete results have no matchScore (Google's API does its own matching), no visitCount, no lastVisitTime. If the weighted formula is applied naively, they score near 0 because 3 of 4 signals are absent.

**Why it happens:** Autocomplete results come pre-scored from Google's API. They do not go through Fuse.js and have no browser history metadata.

**How to avoid:** Autocomplete results need a separate scoring path. Keep their existing base score (30, decreasing by position) and apply the conditional boost from Pattern 4. Do NOT run them through the weighted formula.

**Warning signs:** All autocomplete results scoring 0 or near-0 after the refactor.

### Pitfall 4: Score Magnitude Change Breaking Other Code

**What goes wrong:** The current system produces scores in the 0-115 range. If the new formula produces 0-1 scores without scaling, deduplication priority (`getResultPriority()`) and any other code comparing scores breaks.

**Why it happens:** `getResultPriority()` adds `result.score` to the type-based priority. If scores drop from ~90 to ~0.9, priorities collapse.

**How to avoid:** Either (a) scale the output to the existing range (multiply by 115), or (b) update all score consumers. Option (a) is safer and less invasive.

**Warning signs:** Deduplication keeping the wrong result when both have the same URL. Results sorted in unexpected order.

### Pitfall 5: matchScore = 0 or null Edge Cases

**What goes wrong:** When matchScore is null/0 (string-match fallback path), the MATCH signal contributes nothing, effectively reducing the achievable score by 35%.

**Why it happens:** Some result types (fuzzy domain matches, results without Fuse.js processing) may not have matchScore.

**How to avoid:** Fall back to the legacy string-matching bonuses when matchScore is absent, OR compute a synthetic matchScore from the string-matching checks:
```javascript
// Synthetic matchScore from string matching
if (exactTitleMatch) syntheticScore = 1.0;
else if (titleStartsWith) syntheticScore = 0.8;
else if (titleContains) syntheticScore = 0.6;
else if (urlContains) syntheticScore = 0.3;
else syntheticScore = 0.1; // Passed some filter to get here
```

### Pitfall 6: History 7-Day Window Limits Frequency Signal Value

**What goes wrong:** Chrome's `history.search()` is called with a 7-day window. Pages visited frequently but not in the last 7 days have visitCount = 0 in the results (because the item is not returned at all).

**Why it happens:** The `startTime` parameter limits which history items are returned. `visitCount` on returned items reflects ALL-TIME visits, but items outside the window are not returned.

**How to avoid:** This is a known limitation. The frequency signal works correctly for the items that ARE returned (they have all-time visitCount). Consider extending the window to 30 days in a future iteration (mentioned in quick-005 research). For Phase 10, this does not need to change -- the frequency signal adds value for items within the current window.

**Warning signs:** None immediately. This is a scope limitation to document, not a bug.

## Code Examples

### Example 1: Refactored calculateRelevanceScore()

```javascript
// Source: Codebase analysis of base-data-provider.js + scoring-constants.js
calculateRelevanceScore(result, query) {
    // Autocomplete results use their own scoring path
    if (result.type === ResultType.AUTOCOMPLETE_SUGGESTION) {
        return result.score || BASE_SCORES.AUTOCOMPLETE_SUGGESTION;
    }

    // Signal 1: Type score (normalized 0-1)
    const typeScore = this.getTypeScore(result.type);

    // Signal 2: Match quality (0-1 from Fuse.js, or synthetic from string matching)
    const matchQuality = this.getMatchQuality(result, query);

    // Signal 3: Recency (0-1, history only)
    const recencyScore = (result.type === ResultType.HISTORY)
        ? calculateRecencyScore(result.metadata?.lastVisitTime)
        : 0;

    // Signal 4: Frequency (0-1, history only)
    const frequencyScore = (result.type === ResultType.HISTORY)
        ? calculateFrequencyScore(result.metadata?.visitCount)
        : 0;

    // Determine applicable weights (redistribute for non-history)
    const isHistory = result.type === ResultType.HISTORY;
    const weights = isHistory
        ? SCORING_WEIGHTS
        : { TYPE: SCORING_WEIGHTS.TYPE, MATCH: SCORING_WEIGHTS.MATCH };

    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

    const weightedScore =
        (weights.TYPE / weightSum) * typeScore +
        (weights.MATCH / weightSum) * matchQuality +
        (isHistory ? (weights.RECENCY / weightSum) * recencyScore : 0) +
        (isHistory ? (weights.FREQUENCY / weightSum) * frequencyScore : 0);

    // Scale to existing score range for backward compatibility
    return Math.max(0, weightedScore * SCORE_SCALE);
}
```

### Example 2: Type Score Normalization

```javascript
// Source: Codebase analysis of scoring-constants.js
const TYPE_SCORE_MAP = {
    [ResultType.OPEN_TAB]:       1.0,    // 90/90 = 1.0
    [ResultType.PINNED_TAB]:     0.944,  // 85/90 = 0.944
    [ResultType.BOOKMARK]:       0.889,  // 80/90 = 0.889
    [ResultType.HISTORY]:        0.778,  // 70/90 = 0.778
    [ResultType.TOP_SITE]:       0.667,  // 60/90 = 0.667
};

function getTypeScore(type) {
    return TYPE_SCORE_MAP[type] || 0;
}
```

### Example 3: Recency Score Calculation

```javascript
// Source: Research - exponential decay pattern for time-based relevance
const RECENCY_HALF_LIFE_HOURS = 24;

function calculateRecencyScore(lastVisitTime) {
    if (!lastVisitTime) return 0;
    const ageHours = (Date.now() - lastVisitTime) / (1000 * 60 * 60);
    if (ageHours < 0) return 1; // Future timestamp (clock skew), treat as just visited
    return Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
}
```

### Example 4: Frequency Score Calculation

```javascript
// Source: Research - logarithmic scaling for count-based signals
const FREQUENCY_LOG_CAP = Math.log1p(100);

function calculateFrequencyScore(visitCount) {
    if (!visitCount || visitCount <= 0) return 0;
    return Math.min(1, Math.log1p(visitCount) / FREQUENCY_LOG_CAP);
}
```

### Example 5: Conditional Autocomplete Boost

```javascript
// Source: Codebase analysis of base-data-provider.js getSpotlightSuggestions()
const AUTOCOMPLETE_BOOST_MAX = 40; // Enough to bring 30 -> 70 (history level)
const LOCAL_RESULT_THRESHOLD = 3;  // Boost kicks in below this count

function applyAutocompleteBoost(results) {
    const localCount = results.filter(r =>
        r.type !== ResultType.AUTOCOMPLETE_SUGGESTION
    ).length;

    if (localCount >= LOCAL_RESULT_THRESHOLD) return; // No boost needed

    const boostFactor = (LOCAL_RESULT_THRESHOLD - localCount) / LOCAL_RESULT_THRESHOLD;
    results.forEach(r => {
        if (r.type === ResultType.AUTOCOMPLETE_SUGGESTION) {
            r.score += AUTOCOMPLETE_BOOST_MAX * boostFactor;
        }
    });
}
```

### Example 6: Scoring Verification Test

```javascript
// Source: Codebase analysis of test/unit/scoring.test.js patterns
describe('weighted scoring - type hierarchy preserved (SCORE-02)', () => {
    it('open tab with moderate match outranks bookmark with perfect match', () => {
        const openTab = {
            type: 'open-tab',
            title: 'GitHub Dashboard',
            url: 'https://github.com',
            metadata: { matchScore: 0.6 }
        };
        const bookmark = {
            type: 'bookmark',
            title: 'GitHub',
            url: 'https://github.com',
            metadata: { matchScore: 1.0 }
        };
        const tabScore = provider.calculateRelevanceScore(openTab, 'github');
        const bookmarkScore = provider.calculateRelevanceScore(bookmark, 'github');
        expect(tabScore).toBeGreaterThan(bookmarkScore);
    });
});

describe('weighted scoring - recency signal (SCORE-03)', () => {
    it('recently visited history item outranks old one', () => {
        const recent = {
            type: 'history',
            title: 'Jira Board',
            url: 'https://jira.example.com',
            metadata: { matchScore: 0.8, lastVisitTime: Date.now() - 5 * 60 * 1000, visitCount: 5 }
        };
        const old = {
            type: 'history',
            title: 'Jira Board',
            url: 'https://jira.example.com/old',
            metadata: { matchScore: 0.8, lastVisitTime: Date.now() - 5 * 24 * 60 * 60 * 1000, visitCount: 5 }
        };
        const recentScore = provider.calculateRelevanceScore(recent, 'jira');
        const oldScore = provider.calculateRelevanceScore(old, 'jira');
        expect(recentScore).toBeGreaterThan(oldScore);
    });
});
```

## Signal Design Details

### How Each Requirement Maps to Signals

| Requirement | Signal | Implementation |
|-------------|--------|----------------|
| SCORE-01 | All 4 signals | Weighted formula: type + matchQuality + recency + frequency |
| SCORE-02 | TYPE weight dominance | TYPE weight (0.40) > any single other weight |
| SCORE-03 | Recency signal | Exponential decay on `lastVisitTime`, half-life 24h |
| SCORE-04 | Frequency signal | Log-scaled `visitCount`, cap at 100 visits |
| SCORE-05 | Autocomplete boost | Conditional boost when local results < 3 |

### Score Range Analysis

With the recommended weights and scaling:

**Open tab (perfect match):** typeScore=1.0, matchQuality=1.0
- Non-history effective: (0.533 * 1.0) + (0.467 * 1.0) = 1.0
- Scaled: 1.0 * 115 = **115** (max possible)

**Open tab (moderate match):** typeScore=1.0, matchQuality=0.6
- Non-history effective: (0.533 * 1.0) + (0.467 * 0.6) = 0.813
- Scaled: 0.813 * 115 = **93.5**

**History (perfect match, visited 5min ago, 50 visits):** typeScore=0.778, matchQuality=1.0, recency=0.997, frequency=0.852
- Weighted: (0.40 * 0.778) + (0.35 * 1.0) + (0.15 * 0.997) + (0.10 * 0.852) = 0.311 + 0.350 + 0.150 + 0.085 = **0.896**
- Scaled: 0.896 * 115 = **103.0**

**History (perfect match, visited 5 days ago, 2 visits):** typeScore=0.778, matchQuality=1.0, recency=0.125, frequency=0.238
- Weighted: (0.40 * 0.778) + (0.35 * 1.0) + (0.15 * 0.125) + (0.10 * 0.238) = 0.311 + 0.350 + 0.019 + 0.024 = **0.704**
- Scaled: 0.704 * 115 = **80.9**

**Autocomplete (base, no boost):** 30 (unchanged)

**Autocomplete (boosted, 0 local results):** 30 + 40 = **70** (competes with history)

This analysis confirms:
1. Type hierarchy is preserved (open tab 93.5 > history 103 only when history has recency+frequency advantage, which is correct behavior)
2. Recent history visibly outranks old history (103 vs 81)
3. Frequent history visibly outranks infrequent history
4. Autocomplete becomes competitive when local results are sparse

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat base score per type | matchScore * 25 bonus on base | Phase 9 (current) | Match quality affects ranking within type tier |
| visitCount/lastVisitTime ignored | Incorporated as recency + frequency signals | Phase 10 (this phase) | History items ranked by relevance, not just type |
| Fixed autocomplete score 30 | Conditional boost based on local result count | Phase 10 (this phase) | Autocomplete visible when most useful |
| Simple additive bonuses | Weighted multi-signal formula | Phase 10 (this phase) | Configurable, normalized, principled scoring |

**What stays the same:**
- Fuse.js matching (Phase 9) unchanged
- Deduplication logic unchanged
- Arcify enrichment unchanged
- Two-phase suggestion model unchanged
- SearchResult class unchanged
- Data fetching logic unchanged

## Testing Strategy

### Unit Tests to Write/Update

1. **Type hierarchy preservation (SCORE-02):** Open tab > pinned tab > bookmark > history > top site for same matchScore
2. **Recency signal (SCORE-03):** History item visited 5min ago > same item visited 5 days ago
3. **Frequency signal (SCORE-04):** History item with visitCount 50 > same with visitCount 2
4. **Combined recency + frequency:** Verify both signals contribute independently
5. **Autocomplete boost (SCORE-05):** Autocomplete scores rise when 0 local results, stay low when 5+ local results
6. **matchScore null fallback:** Results without matchScore still get reasonable scores (synthetic matchScore from string matching)
7. **Recency helper pure function:** Edge cases (null, 0, negative age, exactly at half-life)
8. **Frequency helper pure function:** Edge cases (0, 1, 100, 1000)
9. **Weight redistribution for non-history types:** Verify non-history scores use the full 0-1 range
10. **Score scale backward compatibility:** Verify output range is compatible with existing consumers

### Existing Tests to Update

The current `test/unit/scoring.test.js` has 30+ tests covering:
- Base scores by result type
- Title/URL match bonuses
- matchScore integration
- Case insensitivity
- Minimum score enforcement

These tests use the current additive formula and will need updating to match the new weighted formula output. The test structure (test scenarios) stays the same; the expected values change.

## Open Questions

1. **Exact weight values need empirical validation**
   - What we know: 0.40/0.35/0.15/0.10 is a principled starting point based on requirement priorities
   - What's unclear: Whether these specific values produce the best perceived ranking in real use
   - Recommendation: Ship with these weights, put them in named constants, and plan to tune based on feedback. The weights can be adjusted without any structural changes.

2. **Should the history window be extended from 7 days to 30 days?**
   - What we know: The quick-005 research recommended extending to 30 days. The frequency signal is more valuable with a longer window.
   - What's unclear: Whether this scope creep is appropriate for Phase 10
   - Recommendation: Keep as-is for Phase 10 (7-day window). The frequency signal still works for returned items. Window extension can be a quick task or Phase 11+ item.

3. **How should autocomplete results with URL-type suggestions be scored?**
   - What we know: Some Google autocomplete suggestions ARE URLs (e.g., typing "github" suggests "github.com"). These currently get AUTOCOMPLETE_SUGGESTION type with base score 30.
   - What's unclear: Should URL-type autocomplete suggestions get a higher base or different treatment?
   - Recommendation: Treat all autocomplete suggestions uniformly for Phase 10. The conditional boost handles the "no local results" case. URL-type autocomplete suggestions compete with local results on the boost path.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `shared/scoring-constants.js` - Current scoring constants, base scores, bonuses
- Codebase analysis: `shared/data-providers/base-data-provider.js` - Current `calculateRelevanceScore()`, `scoreAndSortResults()`, `deduplicateResults()`
- Codebase analysis: `shared/data-providers/background-data-provider.js` - History data with visitCount/lastVisitTime collection
- Codebase analysis: `shared/fuse-search-service.js` - matchScore (0-1) format from Phase 9
- Codebase analysis: `test/unit/scoring.test.js` - Existing test patterns and coverage
- Project planning: `.planning/REQUIREMENTS.md` - SCORE-01 through SCORE-05 requirements
- Project planning: `.planning/quick/005-research-search-suggestion-algorithm-and/SEARCH-ALGORITHM-RESEARCH.md` - Detailed analysis of current weaknesses

### Secondary (MEDIUM confidence)
- [Chrome History API documentation](https://developer.chrome.com/docs/extensions/reference/api/history) - HistoryItem properties (visitCount, lastVisitTime)
- Quick-005 research Section 9: Proposed improvement #2 (recency/frequency scoring formula) and #5 (autocomplete boost)

### Tertiary (LOW confidence)
- Exponential decay half-life of 24 hours: This is a reasonable starting point but needs empirical validation. Could be 12h or 48h.
- Log cap of 100 visits: Most users probably have <100 visits for any single page in a 7-day window. The cap may need adjusting if users have extreme browsing patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; pure algorithmic change in existing files
- Architecture: HIGH - Weighted additive formula is well-understood; all signals already exist in the codebase
- Pitfalls: HIGH - Identified from thorough analysis of the existing scoring system and its consumers
- Weight values: MEDIUM - Principled but untested; need empirical validation
- Recency/frequency formulas: MEDIUM - Standard mathematical approaches, but parameter values (half-life, log cap) are estimates

**Research date:** 2026-02-06
**Valid until:** 2026-06-06 (no external dependencies; validity limited only by codebase changes)
