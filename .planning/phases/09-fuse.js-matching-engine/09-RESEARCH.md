# Phase 9: Fuse.js Matching Engine - Research

**Researched:** 2026-02-06
**Domain:** Fuzzy search matching with Fuse.js in a Chrome extension search pipeline
**Confidence:** HIGH

## Summary

This research investigates replacing the hand-rolled `fuzzyMatch()` function and Chrome's native `bookmarks.search()` with Fuse.js across all data sources in the Arcify Spotlight extension. The current system has two core problems: (1) the character-order fuzzy match has no distance constraint, causing false positives on short queries, and (2) bookmarks only use Chrome's substring search, missing fuzzy matches entirely.

Fuse.js v7.1.0 is the standard library for client-side fuzzy search in JavaScript. It uses a modified Bitap algorithm, provides built-in match quality scores (0-1), supports weighted multi-key search, and ships at ~6.7KB minified+gzipped with zero dependencies. It is well-suited for the data volumes in this extension (typically <100 tabs, <1000 bookmarks, <100 history items per query).

The integration strategy is to create Fuse instances per data source at search time, search them with a shared configuration, and map Fuse.js scores (where 0=perfect, 1=mismatch) to the extension's existing 0-1 score format (where 1=perfect, 0=mismatch) by inverting: `matchScore = 1 - fuseScore`. Title fields should be weighted higher than URL fields. A threshold of 0.3-0.4 with `ignoreLocation: true` will eliminate false positives on short queries while preserving the fuzzy matching quality users expect.

**Primary recommendation:** Install Fuse.js v7.1.0, create a shared `FuseSearchService` utility that wraps Fuse instance creation and search with standardized configuration, then replace each data source's matching one at a time: tabs, pinned tabs, bookmarks, history, and popular sites.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fuse.js | 7.1.0 | Fuzzy search matching | 20k+ GitHub stars, zero dependencies, 3100+ npm dependents, Bitap algorithm with built-in scoring, actively maintained |

### Supporting

No additional libraries needed. Fuse.js is self-contained with zero dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fuse.js | microfuzz | Smaller (~1KB) but less configurable, no field weights, smaller community |
| Fuse.js | FlexSearch | Better for full-text search on large datasets, but heavier and designed for different use case (document search vs fuzzy match) |
| Fuse.js | Hand-rolled with scoring | More control but significantly more code to maintain, no battle-tested algorithm |

**Installation:**
```bash
npm install fuse.js
```

This adds fuse.js as a runtime dependency (not devDependency) since it runs in the extension's background script and overlay.

## Architecture Patterns

### Recommended Project Structure

```
shared/
  search/
    fuse-search-service.js    # Shared Fuse.js wrapper with standard config
  data-providers/
    base-data-provider.js     # Modified to use FuseSearchService
    background-data-provider.js  # Modified: bookmarks fetched then Fuse-filtered
  scoring-constants.js        # Updated with new score mapping
```

Note: The `shared/search/` directory is a recommendation. The `fuse-search-service.js` could also live directly in `shared/` to match the current flat structure. This is at the planner's discretion.

### Pattern 1: Centralized Fuse Configuration

**What:** A single `FuseSearchService` module that creates and manages Fuse instances with standardized options.

**When to use:** Every time a data source needs fuzzy matching.

**Why:** Ensures all data sources use identical threshold, distance, and weight settings. Prevents configuration drift where tabs use one threshold and bookmarks use another.

```javascript
// Source: Fuse.js official docs (https://www.fusejs.io/api/options.html)
import Fuse from 'fuse.js';

// Shared configuration for all data sources
const FUSE_OPTIONS = {
  // Fuzzy matching settings
  threshold: 0.4,          // 0.0=exact, 1.0=match anything. 0.4 balances fuzziness vs false positives
  distance: 100,           // How close match must be to expected location (default)
  ignoreLocation: true,    // CRITICAL: URLs and titles can have matches anywhere, not just near index 0

  // Scoring
  includeScore: true,      // REQUIRED: We need the 0-1 score for MATCH-04
  includeMatches: false,   // Not needed for v2.0 (could enable for match highlighting later)

  // Search behavior
  minMatchCharLength: 2,   // Prevent single-char queries from matching everything
  shouldSort: true,        // Let Fuse sort by score
  findAllMatches: false,   // Stop at first good match per item (performance)
  isCaseSensitive: false,  // Case-insensitive matching

  // Field weighting - title more important than URL (MATCH-02)
  keys: [
    { name: 'title', weight: 2 },   // Title matches worth 2x
    { name: 'url', weight: 1 }      // URL matches worth 1x
  ],

  // Field normalization
  fieldNormWeight: 1,      // Default. Shorter fields score higher (helps title over long URLs)
};

export class FuseSearchService {
  /**
   * Search a collection of items using Fuse.js
   * @param {Array} items - Array of objects with title and url properties
   * @param {string} query - Search query
   * @param {Object} optionOverrides - Override default options per source if needed
   * @returns {Array} Results with { item, score } where score is 0-1 (1=best match)
   */
  static search(items, query, optionOverrides = {}) {
    if (!items || items.length === 0 || !query) return [];

    const options = { ...FUSE_OPTIONS, ...optionOverrides };
    const fuse = new Fuse(items, options);
    const results = fuse.search(query);

    // Convert Fuse score (0=perfect, 1=mismatch) to our format (1=perfect, 0=mismatch)
    return results.map(result => ({
      item: result.item,
      matchScore: 1 - result.score  // Invert for our scoring system
    }));
  }
}
```

### Pattern 2: Per-Source Fuse Integration

**What:** Each data source creates its own Fuse instance for its specific data, but uses the shared configuration.

**When to use:** When data sources have different shapes or need slightly different search keys.

**Why:** Tabs have `title` and `url`, but popular sites have `domain` and `displayName`. The same Fuse config applies, but the keys may differ.

```javascript
// Tab filtering - replaces this.fuzzyMatch(queryLower, titleLower) || this.fuzzyMatch(queryLower, urlLower)
const fuseResults = FuseSearchService.search(allTabs, query, {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'url', weight: 1 }
  ]
});

// Bookmark filtering - replaces chrome.bookmarks.search(query) substring matching
// Step 1: Fetch ALL bookmarks (not filtered by Chrome)
// Step 2: Filter with Fuse.js
const allBookmarks = await this.getAllBookmarks();  // New method needed
const fuseResults = FuseSearchService.search(allBookmarks, query);

// Popular sites - different keys
const fuseResults = FuseSearchService.search(popularSitesList, query, {
  keys: [
    { name: 'displayName', weight: 2 },
    { name: 'domain', weight: 1 }
  ]
});
```

### Pattern 3: Score Inversion and Mapping

**What:** Fuse.js returns scores where 0=perfect match and 1=complete mismatch. The extension's existing system uses higher=better. The score must be inverted.

**When to use:** Every time a Fuse.js score is consumed by the scoring system.

**Critical detail:** The inversion formula is `matchScore = 1 - fuseScore`. This gives us a 0-1 value where 1 is a perfect match and 0 is no match, satisfying MATCH-04.

```javascript
// Fuse.js returns: { item: {...}, score: 0.15 }   (0.15 = quite good match)
// We need:         { item: {...}, matchScore: 0.85 } (0.85 = quite good match)

const matchScore = 1 - fuseResult.score;

// Store on SearchResult for Phase 10's weighted scoring
result.metadata.matchScore = matchScore;  // 0-1, where 1 = perfect
```

### Anti-Patterns to Avoid

- **Creating a single Fuse index for all sources combined:** Different data sources have different shapes and different key configurations. A unified index would require normalizing all data into a common shape, adding complexity without benefit. The REQUIREMENTS.md explicitly marks "pre-built unified search index" as out of scope.

- **Caching Fuse instances across searches:** The data changes between searches (tabs open/close, new bookmarks). Creating fresh Fuse instances per search is fast enough for the data volumes involved (<1000 items per source) and avoids stale index bugs.

- **Using `location` and `distance` without `ignoreLocation: true`:** By default, Fuse.js expects matches near the start of the string (location=0). For URLs, the interesting part (domain name, path) is often 15-30 characters in (after `https://www.`). Without `ignoreLocation: true`, URL matching would be unreliable.

- **Setting threshold too low (e.g., 0.1-0.2):** This would make matching almost exact-only, breaking the user's expectation that "ghub" matches "GitHub". A threshold of 0.3-0.4 preserves useful fuzzy matches while eliminating false positives on short queries.

- **Setting threshold too high (e.g., 0.6-0.8):** This is the current default (0.6) and would still produce too many false positives with short queries, which is exactly what MATCH-03 aims to fix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Character-order match (current `fuzzyMatch()`) | Fuse.js Bitap algorithm | Current impl has no distance constraint, no quality scoring, produces false positives |
| Match quality scoring | Custom score formula based on character positions | Fuse.js `includeScore: true` | Fuse.js considers character proximity, position, field length norm -- all battle-tested |
| Field-weighted search | Manual title/URL priority via if/else bonus chain | Fuse.js `keys` with `weight` | Fuse.js integrates weights into its scoring algorithm naturally |
| Case-insensitive matching | Manual `.toLowerCase()` everywhere | Fuse.js `isCaseSensitive: false` | Fuse handles it internally, less code surface |

**Key insight:** The current `fuzzyMatch()` is 20 lines of code that returns a boolean. Fuse.js replaces it with a battle-tested algorithm that returns a quality score, handles field weights, and has configurable thresholds -- all things that would take hundreds of lines to hand-roll properly.

## Common Pitfalls

### Pitfall 1: Fuse.js Score Direction (0=best, not 1=best)

**What goes wrong:** Developers assume higher Fuse.js scores mean better matches (like most scoring systems). In Fuse.js, 0 is a perfect match and 1 is a complete mismatch.

**Why it happens:** Nearly every other scoring system in this codebase (BASE_SCORES, SCORE_BONUSES) uses higher=better. Fuse.js is the opposite.

**How to avoid:** Always invert the score at the integration boundary: `matchScore = 1 - fuseScore`. Do this inside `FuseSearchService.search()` so downstream consumers never see the raw Fuse score.

**Warning signs:** Results sorted in reverse order (worst matches first). Tests showing that an exact match has a score near 0 instead of near 1.

### Pitfall 2: Default Location/Distance Settings Block URL Matches

**What goes wrong:** With default settings (`location: 0`, `distance: 100`, `threshold: 0.6`), Fuse.js expects matches near the start of the string. A match is only valid within `threshold * distance = 60` characters of position 0. URLs often have the interesting part beyond index 60 (e.g., `https://www.example.com/very/long/path/to/page`).

**Why it happens:** Fuse.js was designed for searching titles and names, not URLs. Its location-aware scoring penalizes matches far from the expected position.

**How to avoid:** Set `ignoreLocation: true` in the Fuse options. This disables position-based scoring entirely, making Fuse match patterns anywhere in the string.

**Warning signs:** URL-only matches not appearing in results. A page with "github" in the URL but not the title not being found.

### Pitfall 3: Bookmark Data Fetching Strategy Change

**What goes wrong:** Currently, `chrome.bookmarks.search(query)` does both fetching AND filtering in one API call. With Fuse.js, you need ALL bookmarks first, then Fuse filters them. Fetching all bookmarks on every keystroke is expensive.

**Why it happens:** Chrome's `bookmarks.search()` does server-side substring filtering. Fuse.js requires client-side filtering, so the full dataset must be available.

**How to avoid:** Cache the full bookmark list. Bookmarks change rarely compared to tabs. Build a bookmark cache on spotlight open (via `spotlightOpened` message), invalidate on bookmark change events (which are already listened to for Arcify cache). Use `chrome.bookmarks.getTree()` or `chrome.bookmarks.search('')` to get all bookmarks, then filter with Fuse.js.

**Warning signs:** Slow bookmark results. Multiple `chrome.bookmarks.getTree()` calls per search session.

### Pitfall 4: Threshold Tuning for Short vs Long Queries

**What goes wrong:** A single threshold value cannot optimally serve both 2-character queries ("gh") and 8-character queries ("github d"). Short queries with a lenient threshold produce many false positives. Long queries with a strict threshold miss reasonable fuzzy matches.

**Why it happens:** Short queries have inherently less information content. A 2-character query can match many strings by chance.

**How to avoid:** Use `minMatchCharLength: 2` to filter very short matches from results. Consider a dynamic threshold that tightens for short queries: `threshold = Math.max(0.2, 0.4 - (query.length * 0.02))`. However, start with a fixed threshold of 0.4 and tune based on testing before adding dynamic behavior.

**Warning signs:** Query "ab" matching "xyz123". Query "gh" returning 50+ results from tabs.

### Pitfall 5: Losing Existing Behavior Users Depend On

**What goes wrong:** The hand-rolled `fuzzyMatch()` supports abbreviation patterns like "ghub" -> "GitHub" and "yt" -> "YouTube". If Fuse.js's threshold is too strict, these beloved shortcuts break.

**Why it happens:** Fuse.js uses the Bitap algorithm which matches differently from a character-order scan. Some patterns that worked before may not match, and vice versa.

**How to avoid:** Create a test suite with the existing fuzzyMatch test cases (test/unit/fuzzy-matching.test.js) and verify they pass with Fuse.js. The existing tests cover: "ghub"->GitHub, "yt"->YouTube, "gml"->Gmail, "fb"->Facebook, "goog"->Google, "rd"->Reddit, "tw"->Twitter. These must all still work.

**Warning signs:** Users reporting that their favorite shortcuts stopped working. Existing fuzzy-matching tests failing.

### Pitfall 6: Bundle Size in Chrome Extension Context

**What goes wrong:** Fuse.js adds ~6.7KB gzipped to the bundle. In a Chrome extension, the background script is not served over HTTP (no gzip benefit), so the actual size impact is the minified size (~22KB).

**Why it happens:** Chrome extensions load from local disk, not over the network. Bundle size matters less for load time but more for install size and Chrome Web Store review.

**How to avoid:** This is acceptable. 22KB minified is trivial for a Chrome extension (most extensions are 100KB-1MB+). The Vite build already bundles and minifies. Fuse.js will be tree-shaken by Vite's Rollup to include only what's imported.

**Warning signs:** None expected. This is informational.

## Code Examples

### Example 1: Basic Fuse.js Search with Score

```javascript
// Source: https://www.fusejs.io/api/options.html, https://www.fusejs.io/examples.html
import Fuse from 'fuse.js';

const tabs = [
  { title: 'GitHub - Dashboard', url: 'https://github.com' },
  { title: 'Google Chrome Help', url: 'https://support.google.com/chrome' },
  { title: 'Gmail - Inbox', url: 'https://mail.google.com' }
];

const fuse = new Fuse(tabs, {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'url', weight: 1 }
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true
});

const results = fuse.search('git');
// Returns:
// [
//   { item: { title: 'GitHub - Dashboard', url: '...' }, score: 0.05, refIndex: 0 },
//   ...
// ]
// Lower score = better match. "GitHub" matches "git" closely.
```

### Example 2: Replacing fuzzyMatch() in Tab Filtering

```javascript
// BEFORE: hand-rolled fuzzyMatch (background-data-provider.js:33-53)
const filteredTabs = tabs.filter(tab => {
  return this.fuzzyMatch(queryLower, titleLower) ||
         this.fuzzyMatch(queryLower, urlLower);
});

// AFTER: Fuse.js search
const fuse = new Fuse(tabs, {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'url', weight: 1 }
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  isCaseSensitive: false
});

const fuseResults = fuse.search(query);
// fuseResults is already sorted by score (best first)
// Each result has: { item: <original tab object>, score: <0-1 where 0=perfect> }
```

### Example 3: Replacing Chrome's bookmarks.search() with Fuse.js

```javascript
// BEFORE: Chrome substring-only search (bookmark-utils.js:489-520)
const bookmarks = await chrome.bookmarks.search(query);
// Problem: "ghub" does NOT find a bookmark titled "GitHub"

// AFTER: Fetch all, filter with Fuse.js
// Step 1: Get all bookmarks (cached, not per-keystroke)
const allBookmarks = await this.getBookmarkCache();

// Step 2: Search with Fuse.js
const fuse = new Fuse(allBookmarks, {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'url', weight: 1 }
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2
});

const results = fuse.search(query);
// Now "ghub" DOES find "GitHub" bookmarks via fuzzy matching
```

### Example 4: Score Inversion for Integration

```javascript
// Fuse.js score: 0 = perfect match, 1 = mismatch
// Extension score: 1 = perfect match, 0 = mismatch

function fuseToExtensionScore(fuseResult) {
  // Invert: 0.05 Fuse score -> 0.95 match quality
  const matchScore = 1 - fuseResult.score;

  return {
    item: fuseResult.item,
    matchScore: matchScore  // 0-1 where 1 = perfect (MATCH-04)
  };
}
```

### Example 5: Replacing Popular Sites Matching

```javascript
// BEFORE: Manual start/contains/name matching (popular-sites.js:223-264)
// Three separate match type checks with manual scoring

// AFTER: Fuse.js with custom keys for popular sites
const popularSitesList = Object.entries(POPULAR_SITES).map(([domain, name]) => ({
  domain: domain.split('.')[0],  // "github" from "github.com"
  displayName: name,
  fullDomain: domain
}));

const fuse = new Fuse(popularSitesList, {
  keys: [
    { name: 'displayName', weight: 2 },
    { name: 'domain', weight: 1.5 }
  ],
  threshold: 0.3,      // Tighter for popular sites (well-known names)
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2
});

const results = fuse.search(query).slice(0, 5); // Cap at 5 like current behavior
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled character-order scan | Fuse.js Bitap algorithm | Phase 9 (now) | Eliminates false positives, adds match scoring |
| Chrome substring bookmark search | Fuse.js fuzzy bookmark search | Phase 9 (now) | Enables fuzzy matching for bookmarks |
| Boolean match (yes/no) | Quality score (0-1) | Phase 9 (now) | Foundation for Phase 10's weighted scoring |
| Flat type-based scoring only | Match quality + type-based scoring | Phase 10 (next) | Better result relevance |

**Key version facts:**
- Fuse.js v7.1.0 released February 2025 (latest stable as of today)
- v7.x is the current major version line
- Supports ES modules natively (works with this project's `"type": "module"` setup)
- Zero dependencies (no transitive dependency concerns)

## Integration Strategy

### Bookmark Cache Architecture

The biggest architectural change is for bookmarks. Currently, `chrome.bookmarks.search(query)` handles both data retrieval and filtering. With Fuse.js, these must be separated:

1. **Data Retrieval (cached):** Fetch all bookmarks via `chrome.bookmarks.getTree()` or iterate bookmark folders. Cache this list. Invalidate on bookmark change events (already handled by Arcify cache listeners in `background.js`).

2. **Filtering (per search):** Create a Fuse instance with the cached bookmarks and search with the query.

**Cache invalidation events already exist** in `background.js` lines 19-48: `onCreated`, `onRemoved`, `onMoved`, `onChanged`, `onImportBegan`, `onImportEnded`. These currently invalidate the Arcify cache. The bookmark cache can piggyback on the same events.

### Migration Path (per data source)

Each source can be migrated independently:

1. **Tabs** (`getOpenTabsData`): Replace `this.fuzzyMatch()` filter with `FuseSearchService.search(tabs, query)`. Tab data is fetched fresh each time, so no caching concern.

2. **Pinned Tabs** (`getPinnedTabsData`): Same pattern as tabs. Replace `this.fuzzyMatch()` with Fuse search.

3. **Bookmarks** (`getBookmarksData`): Most complex. Replace `chrome.bookmarks.search(query)` with cached full list + Fuse search. Needs new cache layer.

4. **History** (`getHistoryData`): `chrome.history.search()` returns relevance-ordered results. Keep Chrome's history search for data retrieval (it's good at recency/frequency), but apply Fuse.js as a secondary filter to add match quality scoring. OR: fetch a broader set and Fuse-filter. Both approaches are valid.

5. **Popular Sites** (`findMatchingDomains`): Replace manual start/contains/name matching with Fuse search on the POPULAR_SITES array.

6. **Top Sites** (`findMatchingTopSites`): Replace manual filter logic with Fuse search.

### What Stays the Same

- **SearchResult class** (`search-types.js`): No changes needed. Add `matchScore` to metadata.
- **Deduplication** (`deduplicateResults`): Unchanged. Works on normalized URLs, independent of matching.
- **Arcify enrichment** (`enrichWithArcifyInfo`): Unchanged. Works on result URLs after matching.
- **Instant suggestions** (`generateInstantSuggestion`): Unchanged. This is URL detection, not fuzzy matching.
- **Autocomplete provider**: Unchanged for now. Google's API does its own matching.
- **SearchEngine** (`search-engine.js`): Unchanged. Orchestration layer that delegates to data provider.
- **Two-phase suggestion model**: Unchanged. Instant phase is independent of matching algorithm.

### What Changes

| Component | Change | Scope |
|-----------|--------|-------|
| `base-data-provider.js: fuzzyMatch()` | Delete entirely | Remove method |
| `base-data-provider.js: calculateRelevanceScore()` | Add matchScore integration | Modify to use metadata.matchScore |
| `base-data-provider.js: findMatchingTopSites()` | Replace manual filter with Fuse | Rewrite method |
| `base-data-provider.js: getFuzzyDomainMatches()` | Replace with Fuse on POPULAR_SITES | Rewrite method |
| `background-data-provider.js: getOpenTabsData()` | Replace fuzzyMatch filter with Fuse | Modify filter logic |
| `background-data-provider.js: getPinnedTabsData()` | Replace fuzzyMatch filter with Fuse | Modify filter logic |
| `background-data-provider.js: getBookmarksData()` | Add bookmark cache + Fuse filter | Major rewrite |
| `bookmark-utils.js: getBookmarksData()` | Refactor to support fetching all bookmarks | Modify to support no-filter mode |
| `scoring-constants.js` | May need updates for matchScore ranges | Minor updates |
| `popular-sites.js: findMatchingDomains()` | Replace with Fuse search | Rewrite |
| `test/unit/fuzzy-matching.test.js` | Rewrite for Fuse.js behavior | Full rewrite |
| `test/unit/scoring.test.js` | Update for matchScore integration | Partial update |
| NEW: `shared/fuse-search-service.js` | Fuse.js wrapper with shared config | New file |

## Fuse.js Configuration Recommendation

Based on research, here is the recommended configuration with rationale:

| Option | Value | Rationale |
|--------|-------|-----------|
| `threshold` | 0.4 | Balances fuzziness ("ghub"->GitHub works) with false positive prevention on short queries. Lower than default 0.6 to be stricter. |
| `ignoreLocation` | true | URLs and titles have useful content at any position, not just near index 0 |
| `includeScore` | true | Required for MATCH-04 (match quality score 0-1) |
| `isCaseSensitive` | false | Current behavior is case-insensitive |
| `minMatchCharLength` | 2 | Prevents single-character matches from polluting results |
| `shouldSort` | true | Let Fuse sort by match quality |
| `findAllMatches` | false | Performance: stop after finding best match region |
| `keys` (tabs/bookmarks) | `[{name:'title', weight:2}, {name:'url', weight:1}]` | MATCH-02: title matches rank higher than URL-only matches |
| `fieldNormWeight` | 1 | Default. Shorter fields (titles) naturally score higher than longer fields (URLs) |

## Open Questions

1. **History data source strategy**
   - What we know: `chrome.history.search()` does its own relevance-based matching. Fuse.js would provide match quality scoring.
   - What's unclear: Should we keep Chrome's history search for retrieval and just add Fuse scoring on top? Or fetch a broader history set and fully Fuse-filter it?
   - Recommendation: Keep Chrome's history search for retrieval (it respects recency natively), then apply Fuse.js scoring to the returned results for match quality. This avoids needing to cache all history.

2. **Threshold value requires empirical tuning**
   - What we know: 0.4 is a reasonable starting point based on documentation and community practices.
   - What's unclear: Whether "ghub"->GitHub works at 0.4, or whether it needs 0.45-0.5. This depends on Fuse.js's Bitap implementation details.
   - Recommendation: Start with 0.4, write tests for the key abbreviation patterns, and adjust if needed. The threshold is a single constant, easy to tune.

3. **Bookmark cache size for very large collections**
   - What we know: Most users have <1000 bookmarks. Fetching all is fast.
   - What's unclear: Performance impact for users with 5000+ bookmarks (bookmark hoarders).
   - Recommendation: Implement with cache and test. If performance is a concern, add a cap (e.g., 2000 most recent bookmarks) as an optimization later.

## Sources

### Primary (HIGH confidence)
- [Fuse.js Official Documentation - Options](https://www.fusejs.io/api/options.html) - All configuration options verified
- [Fuse.js Official Documentation - Scoring Theory](https://www.fusejs.io/concepts/scoring-theory.html) - Score calculation and Bitap algorithm
- [Fuse.js Official Documentation - Methods](https://www.fusejs.io/api/methods.html) - API methods: search, setCollection, add, remove
- [Fuse.js Official Documentation - Indexing](https://www.fusejs.io/api/indexing.html) - Pre-built indexes, createIndex, parseIndex
- [Fuse.js Official Documentation - Examples](https://www.fusejs.io/examples.html) - Weighted search, extended search
- [Fuse.js GitHub Repository](https://github.com/krisk/Fuse) - v7.1.0, 20k+ stars, Apache-2.0
- [npm fuse.js](https://www.npmjs.com/package/fuse.js) - v7.1.0, 3100+ dependents

### Secondary (MEDIUM confidence)
- [Bundlephobia fuse.js](https://bundlephobia.com/package/fuse.js@7.1.0) - ~6.7KB minified+gzipped
- [Best of JS - Fuse.js](https://bestofjs.org/projects/fusejs) - Community adoption metrics
- Existing codebase analysis: `base-data-provider.js`, `background-data-provider.js`, `bookmark-utils.js`, `scoring-constants.js`, `popular-sites.js`, `search-engine.js` - Verified current architecture

### Tertiary (LOW confidence)
- Various Medium/blog articles on Fuse.js best practices - Cross-referenced with official docs
- GitHub issues #576, #164, #764 on threshold and minMatchCharLength behavior - Known issues to watch for

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Fuse.js is the established standard, verified via official docs and npm
- Architecture: HIGH - Based on thorough analysis of existing codebase plus Fuse.js API
- Pitfalls: HIGH - Identified from official docs (score direction, location), codebase analysis (bookmark cache), and community issues (threshold tuning)
- Integration strategy: HIGH - Mapped every file that needs changes based on reading all source files
- Threshold value: MEDIUM - 0.4 is an informed recommendation but needs empirical validation

**Research date:** 2026-02-06
**Valid until:** 2026-05-06 (Fuse.js is stable, v7.x unlikely to have breaking changes in 90 days)
