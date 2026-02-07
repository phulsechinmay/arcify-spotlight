# Phase 11: Performance - Research

**Researched:** 2026-02-07
**Domain:** JavaScript async patterns, Chrome Extension search pipeline optimization
**Confidence:** HIGH

## Summary

Phase 11 addresses three performance bottlenecks identified during quick-005 research: sequential data fetching, double debouncing, and all-or-nothing rendering. The codebase has clear, isolated locations where each change needs to happen, and no external libraries are required -- this is a pure refactoring phase using native JavaScript async primitives.

The central change is in `base-data-provider.js` `getSpotlightSuggestions()`, which currently `await`s six data sources sequentially (openTabs, pinnedTabs, bookmarks, history, topSites, autocomplete). Wrapping these in `Promise.allSettled()` eliminates the waterfall. The double debounce lives across two files: `shared-component-logic.js` (overlay 150ms) and `search-engine.js` (SearchEngine 150ms), stacking to ~300ms effective delay. Removing the SearchEngine debounce and keeping only the UI-layer debounce halves the perceived latency. Progressive rendering requires splitting the single `getSpotlightSuggestions()` call into two phases: fast local sources first, then async autocomplete appended when ready.

**Primary recommendation:** Refactor `BaseDataProvider.getSpotlightSuggestions()` to use `Promise.allSettled()` for parallel fetching, remove `SearchEngine.DEBOUNCE_DELAY` (keep only the UI-layer debounce in `SharedSpotlightLogic.createInputHandler()`), and split the suggestion pipeline into immediate-local and deferred-autocomplete phases for progressive rendering.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `Promise.allSettled()` | ES2020 (native) | Parallel data fetching with per-source error isolation | Standard JS -- no dependency needed; handles mixed resolve/reject cleanly |
| `setTimeout`/`clearTimeout` | native | Single debounce layer | Already in use; no library needed for simple debounce |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | No additional libraries needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Promise.allSettled()` | `Promise.all()` with individual try/catch | `allSettled` is cleaner -- no need to wrap each promise in its own catch. `Promise.all` short-circuits on first rejection, losing all other results. Since each data source already has its own try/catch in the caller, both work, but `allSettled` is semantically clearer. |
| Custom debounce | lodash.debounce | Over-engineering -- the existing 6-line debounce in `createInputHandler` is sufficient |
| ReadableStream/async generator for progressive | Simple two-phase callback | Streams add complexity without benefit for 2 phases with 6 sources |

**Installation:**
```bash
# No new packages needed -- all changes use native JS APIs
```

## Architecture Patterns

### Recommended Project Structure
No new files needed. Changes are contained within existing files:
```
shared/
├── data-providers/
│   └── base-data-provider.js   # PERF-01: Promise.allSettled in getSpotlightSuggestions
├── search-engine.js            # PERF-02: Remove DEBOUNCE_DELAY and debounce logic
├── shared-component-logic.js   # PERF-02: Keep as single debounce layer (already exists)
overlay.js                      # PERF-03: Two-phase rendering (local instant, autocomplete deferred)
newtab.js                       # PERF-03: Same two-phase rendering pattern
```

### Pattern 1: Parallel Data Fetching with Promise.allSettled
**What:** Replace sequential `await` calls with `Promise.allSettled()` to fetch all data sources concurrently
**When to use:** When multiple independent async operations need to run and individual failures should not block others

Current (sequential -- ~6 round trips):
```javascript
// base-data-provider.js getSpotlightSuggestions() lines 66-113
try { openTabs = await this.getOpenTabs(trimmedQuery); } catch { openTabs = []; }
try { pinnedTabs = await this.getPinnedTabSuggestions(trimmedQuery); } catch { pinnedTabs = []; }
try { bookmarks = await this.getBookmarkSuggestions(trimmedQuery); } catch { bookmarks = []; }
try { history = await this.getHistorySuggestions(trimmedQuery); } catch { history = []; }
try { topSites = await this.getTopSites(); } catch { topSites = []; }
try { autocomplete = await this.getAutocompleteSuggestions(trimmedQuery); } catch { autocomplete = []; }
```

Target (parallel -- 1 round trip, slowest wins):
```javascript
const results = await Promise.allSettled([
    this.getOpenTabs(trimmedQuery),
    this.getPinnedTabSuggestions(trimmedQuery),
    this.getBookmarkSuggestions(trimmedQuery),
    this.getHistorySuggestions(trimmedQuery),
    this.getTopSites(),
    this.getAutocompleteSuggestions(trimmedQuery),
]);

const [openTabs, pinnedTabs, bookmarks, history, topSites, autocomplete] =
    results.map(r => r.status === 'fulfilled' ? r.value : []);
```

### Pattern 2: Single Debounce Layer
**What:** Remove the SearchEngine's internal 150ms debounce, keeping only the UI-layer debounce
**When to use:** When debounce exists in two layers creating cumulative delay

Current double debounce path:
```
Keystroke
  -> overlay.js createInputHandler (150ms debounce)
    -> SpotlightMessageClient.getSuggestions()
      -> background.js 'getSpotlightSuggestions' handler
        -> SearchEngine.getSpotlightSuggestionsUsingCache (150ms debounce)
          -> getSuggestionsImpl() -> dataProvider.getSpotlightSuggestions()
```
Total: ~300ms effective debounce before any work starts.

Target single debounce path:
```
Keystroke
  -> overlay.js createInputHandler (150ms debounce) [SINGLE DEBOUNCE]
    -> SpotlightMessageClient.getSuggestions()
      -> background.js 'getSpotlightSuggestions' handler
        -> SearchEngine.getSpotlightSuggestionsImmediate() [NO DEBOUNCE]
          -> getSuggestionsImpl() -> dataProvider.getSpotlightSuggestions()
```
Total: 150ms debounce, then immediate execution.

**Implementation:** In `background.js`, change the `getSpotlightSuggestions` handler to call `getSpotlightSuggestionsImmediate()` instead of `getSpotlightSuggestionsUsingCache()`. The cache can optionally be kept (it still saves re-fetching for identical queries), but the debounce in SearchEngine must be removed from the message handler path.

### Pattern 3: Progressive Rendering (Two-Phase Suggestions)
**What:** Split suggestion pipeline so local results render immediately while autocomplete appends later
**When to use:** When one source (network autocomplete) is significantly slower than others (local Chrome APIs)

Current: All 6 sources fetched in one batch -> all results rendered at once
Target: Phase 1 (local: tabs, pinned, bookmarks, history, topSites) renders immediately -> Phase 2 (autocomplete) appends when ready

Two implementation options:

**Option A: Split inside BaseDataProvider (recommended)**
```javascript
// New method: getLocalSuggestions() - fast local sources only
async getLocalSuggestions(query, mode) {
    const results = await Promise.allSettled([
        this.getOpenTabs(query),
        this.getPinnedTabSuggestions(query),
        this.getBookmarkSuggestions(query),
        this.getHistorySuggestions(query),
        this.getTopSites(),
    ]);
    // ... dedup, enrich, score, return
}

// New method: getAutocompleteSuggestionsForQuery() - network source only
async getAutocompleteSuggestionsForQuery(query) {
    return await this.getAutocompleteSuggestions(query);
}
```

**Option B: Split at the overlay/newtab level**
Call background twice: once for local results, once for autocomplete. More message passing overhead but simpler background changes.

**Recommendation:** Option A. Split inside the data provider, expose two methods, and let the caller (via SearchEngine/background.js) orchestrate the two-phase response. This keeps the message passing efficient (potentially one message for local, one for autocomplete, or a single message with a callback pattern).

### Anti-Patterns to Avoid
- **Removing the cache entirely:** The SearchEngine cache (30s TTL) still has value for instant back-navigation to previous queries. Only the debounce needs removal.
- **Using Promise.all instead of Promise.allSettled:** If any single source throws (e.g., autocomplete network timeout), Promise.all would discard all results from successfully resolved sources.
- **Moving debounce to the background script:** The debounce must stay in the UI layer (overlay/newtab) where the keystroke events originate. Moving it to background would mean every keystroke still generates a chrome.runtime.sendMessage call.
- **Creating a unified streaming API:** Over-engineering for 2 phases. Simple callback or two-message pattern is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel async with error isolation | Custom try/catch wrapper for each promise | `Promise.allSettled()` | Native API, handles mixed resolve/reject, clean destructuring |
| Debounce function | New debounce utility | Existing `createInputHandler` in `SharedSpotlightLogic` | Already implemented correctly, just need to remove the duplicate |
| Race condition protection | Custom locking/sequencing | Query ID pattern (increment counter, discard stale responses) | Simple integer comparison, prevents rendering stale results from slow queries |

**Key insight:** This phase is a refactoring task, not a feature build. All the primitives already exist in the codebase or in native JavaScript. The work is about removing unnecessary layers (double debounce), parallelizing what's currently sequential, and splitting a single batch into two render phases.

## Common Pitfalls

### Pitfall 1: Stale Response Rendering
**What goes wrong:** User types "abc", results start fetching. User changes to "xyz". The "abc" autocomplete response arrives after "xyz" local results and overwrites them.
**Why it happens:** Progressive rendering introduces a race condition when autocomplete for query N arrives after local results for query N+1.
**How to avoid:** Use a query generation counter (monotonically increasing integer). When autocomplete results arrive, compare against current query -- if query has changed, discard the stale response.
**Warning signs:** Results flickering, showing results for previous query briefly.

### Pitfall 2: Breaking the Existing Test Suite
**What goes wrong:** The debounce removal changes timing behavior that 15+ existing tests depend on.
**Why it happens:** `search-engine-debounce.test.js` (11 tests) and `search-engine-cache.test.js` (5 tests) use fake timers and assert specific debounce delays of 150ms.
**How to avoid:** Plan test updates as part of each change. The debounce tests need to be rewritten to test the new single-debounce-at-UI-layer pattern. Cache tests should be updated but the caching behavior itself stays.
**Warning signs:** Tests failing due to timeout expectations.

### Pitfall 3: Autocomplete Duplicating Local Results
**What goes wrong:** Autocomplete returns a suggestion that's already in the local results (e.g., "github.com" from bookmarks AND autocomplete).
**Why it happens:** Progressive rendering shows local results first, then appends autocomplete. If deduplication only ran on the first batch, autocomplete duplicates slip through.
**How to avoid:** Run deduplication when merging autocomplete into existing local results, using the same `deduplicateResults()` method already in BaseDataProvider.
**Warning signs:** Duplicate URLs appearing in results list.

### Pitfall 4: Scoring Inconsistency Between Phases
**What goes wrong:** Local results are scored and sorted, then autocomplete arrives and is appended at the bottom regardless of score.
**Why it happens:** Two separate score-and-sort operations instead of a merged re-sort.
**How to avoid:** When autocomplete arrives, merge with existing local results, re-run `scoreAndSortResults()` on the combined set, and re-render. This preserves the conditional autocomplete boost logic (SCORE-05).
**Warning signs:** Autocomplete results always appearing at bottom even when they should rank higher.

### Pitfall 5: Message Passing Overhead from Two Calls
**What goes wrong:** Splitting into two phases means two `chrome.runtime.sendMessage` round trips instead of one, adding overhead.
**Why it happens:** Each message to background is an IPC call with serialization cost.
**How to avoid:** Either (a) have background return local results first and fire a follow-up message for autocomplete, or (b) accept the two-message overhead (it's still faster than waiting for autocomplete to complete before showing anything), or (c) use a single message where background sends local results immediately and the overlay appends autocomplete when it arrives via a second response.
**Warning signs:** Perceptible delay between opening spotlight and seeing results.

## Code Examples

### Example 1: Promise.allSettled Parallel Fetching
```javascript
// In base-data-provider.js getSpotlightSuggestions()
// Replace the sequential try/catch blocks (lines 66-113) with:

const settled = await Promise.allSettled([
    this.getOpenTabs(trimmedQuery),
    this.getPinnedTabSuggestions(trimmedQuery),
    this.getBookmarkSuggestions(trimmedQuery),
    this.getHistorySuggestions(trimmedQuery),
    this.getTopSites(),
    this.getAutocompleteSuggestions(trimmedQuery),
]);

const [openTabs, pinnedTabs, bookmarks, history, topSites, autocomplete] =
    settled.map(result => {
        if (result.status === 'fulfilled') return result.value;
        Logger.error('[SearchProvider] Source failed:', result.reason);
        return [];
    });
```

### Example 2: Removing SearchEngine Debounce from Message Path
```javascript
// In background.js, change the 'getSpotlightSuggestions' handler:
// FROM:
const results = query
    ? await backgroundSearchEngine.getSpotlightSuggestionsUsingCache(query, message.mode)
    : await backgroundSearchEngine.getSpotlightSuggestionsImmediate('', message.mode);

// TO (both paths use immediate -- debounce is in UI layer):
const results = await backgroundSearchEngine.getSpotlightSuggestionsImmediate(
    query, message.mode
);
```

### Example 3: Stale Query Guard for Progressive Rendering
```javascript
// In overlay.js / newtab.js
let currentQueryId = 0;

async function handleAsyncSearch() {
    const query = input.value.trim();
    const queryId = ++currentQueryId;

    // Phase 1: Local results (fast)
    const localResults = await SpotlightMessageClient.getLocalSuggestions(query, mode);
    if (queryId !== currentQueryId) return; // Stale -- discard
    asyncSuggestions = localResults;
    updateDisplay();

    // Phase 2: Autocomplete (slow, network)
    const autocompleteResults = await SpotlightMessageClient.getAutocompleteSuggestions(query);
    if (queryId !== currentQueryId) return; // Stale -- discard
    // Merge autocomplete with existing local results
    asyncSuggestions = mergeAndDeduplicate(localResults, autocompleteResults);
    updateDisplay();
}
```

### Example 4: Two-Phase Method in BaseDataProvider
```javascript
// New method on BaseDataProvider
async getLocalSuggestions(query, mode) {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return this.getDefaultResults(mode);

    const settled = await Promise.allSettled([
        this.getOpenTabs(trimmedQuery),
        this.getPinnedTabSuggestions(trimmedQuery),
        this.getBookmarkSuggestions(trimmedQuery),
        this.getHistorySuggestions(trimmedQuery),
        this.getTopSites(),
    ]);

    const [openTabs, pinnedTabs, bookmarks, history, topSites] =
        settled.map(r => r.status === 'fulfilled' ? r.value : []);

    const allResults = [...openTabs, ...pinnedTabs, ...bookmarks, ...history];
    const matchingTopSites = this.findMatchingTopSites(topSites, trimmedQuery);
    const fuzzyDomainMatches = this.getFuzzyDomainMatches(trimmedQuery);
    allResults.push(...matchingTopSites, ...fuzzyDomainMatches);

    const deduped = this.deduplicateResults(allResults);
    const enriched = await this.enrichWithArcifyInfo(deduped);
    return this.scoreAndSortResults(enriched, trimmedQuery);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential awaits in try/catch blocks | `Promise.allSettled()` for parallel with error isolation | ES2020 (2020) | Eliminates waterfall, ~5x faster for 6 independent sources |
| Multiple debounce layers | Single debounce at input source | Industry best practice (Algolia docs) | Halves perceived latency from ~300ms to ~150ms |
| All-or-nothing batch rendering | Progressive/incremental rendering | Common in search UIs (Google, Algolia) | Local results appear immediately instead of waiting for slowest network source |

**Deprecated/outdated:**
- `Promise.all()` for independent sources where partial failure is acceptable: Use `Promise.allSettled()` instead (better error isolation)

## Open Questions

1. **Single message vs. two messages for progressive rendering?**
   - What we know: The overlay currently sends one `getSpotlightSuggestions` message and receives all results at once. Progressive rendering requires local results to arrive before autocomplete.
   - What's unclear: Whether to use two separate messages (`getLocalSuggestions` + `getAutocompleteSuggestions`) or a single message where the background worker sends two responses (not standard chrome.runtime.sendMessage pattern).
   - Recommendation: Use two separate messages. Chrome's `sendMessage` is request-response (one response per message), so streaming responses would require a different mechanism (ports). Two simple messages are clean and the message overhead is negligible compared to the network autocomplete latency (~200-500ms).

2. **Should the SearchEngine cache be kept, modified, or removed?**
   - What we know: The cache (30s TTL, keyed by query+mode) saves re-fetching for repeated queries. The debounce inside SearchEngine should be removed.
   - What's unclear: Whether the cache is still useful after parallelization (results arrive faster anyway).
   - Recommendation: Keep the cache but make it optional/lighter. It still helps for the common pattern of typing "git", backspacing, and retyping "git" -- the cache prevents re-fetching from all sources. May need to split into local-results cache and autocomplete cache.

3. **What debounce delay value to use for the single UI-layer debounce?**
   - What we know: Currently 150ms in both layers (stacking to ~300ms). Algolia recommends 200ms as optimal. Industry consensus: 150-200ms for desktop, 200-300ms for mobile.
   - What's unclear: Whether the current 150ms is the right value or should be adjusted when it becomes the only debounce.
   - Recommendation: Keep 150ms. It was already chosen as the per-layer delay, and with parallel fetching results will arrive faster. Increasing to 200ms would add unnecessary latency now that double debounce is eliminated.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `base-data-provider.js` lines 56-141 -- sequential fetching pattern identified
- Codebase analysis: `search-engine.js` lines 38-67 -- second debounce layer with 150ms delay
- Codebase analysis: `shared-component-logic.js` lines 171-192 -- first debounce layer with 150ms delay
- Codebase analysis: `overlay.js` lines 529-533 -- createInputHandler call with 150ms
- Codebase analysis: `background.js` lines 388-399 -- message handler using `getSpotlightSuggestionsUsingCache`
- [MDN Promise.allSettled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) -- API reference

### Secondary (MEDIUM confidence)
- [Algolia Debouncing Sources guide](https://www.algolia.com/doc/ui-libraries/autocomplete/guides/debouncing-sources) -- single debounce layer recommendation, 200ms preferred delay
- [Preventing Waterfall Effect in Data Retrieval](https://rishibakshi.hashnode.dev/how-to-prevent-the-waterfall-effect-in-data-fetching) -- Promise.all/allSettled comparison
- [Debounce Best Practices - BitSKingdom 2026](https://bitskingdom.com/blog/mastering-javascript-debouncing/) -- debounce timing guidance

### Tertiary (LOW confidence)
- None. All findings verified through codebase analysis or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Native JS APIs, no external libraries, patterns verified in codebase
- Architecture: HIGH -- Direct codebase analysis; exact file locations and line numbers identified for all changes
- Pitfalls: HIGH -- Race conditions and test impacts are well-understood patterns; specific test files identified (16 tests across 2 files)

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable -- no external dependencies to track)
