# Arcify Spotlight: Search Suggestion Algorithm Research

**Date:** 2026-02-07
**Scope:** End-to-end analysis of the search suggestion pipeline, from keystroke to rendered result
**Purpose:** Document the current system, identify weaknesses, and propose ranked improvements

---

## 1. Architecture Overview

### Full Pipeline Diagram

```
User Keystroke
    |
    v
overlay.js: input event listener
    |
    +--> [INSTANT PATH - zero latency]
    |    handleInstantInput()
    |    SpotlightUtils.generateInstantSuggestion(query)
    |      -> isURL(query) ? URL_SUGGESTION (score 1000) : SEARCH_QUERY (score 1000)
    |    updateDisplay() immediately
    |
    +--> [ASYNC PATH - debounced 150ms by createInputHandler]
         handleAsyncSearch()
         SpotlightMessageClient.getSuggestions(query, mode)
             |
             v
         chrome.runtime.sendMessage({ action: 'getSpotlightSuggestions' })
             |
             v
         background.js message listener
             |
             v
         SearchEngine.getSpotlightSuggestionsUsingCache(query, mode)
           (150ms debounce + 30s cache check)
             |
             v
         SearchEngine.getSuggestionsImpl(query, mode)
             |
             v
         BaseDataProvider.getSpotlightSuggestions(trimmedQuery, mode)
             |
             v
         Sequential data fetching (individual try/catch per source):
           1. getOpenTabs(query)          -> fuzzyMatch filter
           2. getPinnedTabSuggestions(query) -> fuzzyMatch filter
           3. getBookmarkSuggestions(query)  -> chrome.bookmarks.search
           4. getHistorySuggestions(query)   -> chrome.history.search
           5. getTopSites()                  -> chrome.topSites.get (unfiltered)
           6. getAutocompleteSuggestions(query) -> Google API
             |
             v
         findMatchingTopSites(topSites, query) -> filter top sites by query
         getFuzzyDomainMatches(query)           -> popular-sites.js fuzzy matching
             |
             v
         deduplicateResults(allResults)
           -> normalizeUrlForDeduplication() per URL
           -> higher priority type wins on collision
             |
             v
         enrichWithArcifyInfo(deduplicatedResults)
           -> lazy-load ArcifyProvider
           -> ensureCacheBuilt() (from chrome.storage.local or bookmark tree)
           -> O(1) Map lookup per result URL
             |
             v
         scoreAndSortResults(enrichedResults, query)
           -> calculateRelevanceScore() per result (base + bonuses)
           -> sort descending by score
           -> .slice(0, 8) cap at 8 results
             |
             v
         Return results array to SearchEngine
             |
             v
         Cache results (key: "query:mode", TTL: 30s)
             |
             v
         sendResponse({ results }) to content script
             |
             v
         overlay.js: asyncSuggestions = results
             |
             v
         SharedSpotlightLogic.combineResults(instantSuggestion, asyncSuggestions)
           -> instant suggestion first
           -> async results deduped against instant
             |
             v
         SharedSpotlightLogic.generateResultsHTML(combined, mode)
           -> SpotlightUtils.formatResult() per result
           -> SpotlightUtils.generateSpaceChipHTML() per result
           -> SpotlightUtils.getFaviconUrl() per result
             |
             v
         Rendered in DOM
```

### Two-Phase Suggestion Model

The spotlight uses a **two-phase suggestion model** for perceived instant responsiveness:

**Phase 1 - Instant (0ms latency):**
- `handleInstantInput()` fires synchronously on every keystroke
- Calls `SpotlightUtils.generateInstantSuggestion(query)` which runs purely client-side
- Detects if input is a URL (via `isURL()`) or a search query
- Returns a single result with score 1000 (always appears first)
- Display updates immediately - user always sees *something* after typing

**Phase 2 - Async (150ms+ latency):**
- `handleAsyncSearch()` fires after a 150ms debounce (via `createInputHandler`)
- Sends message to background service worker for full search
- Background SearchEngine adds another 150ms debounce + 30s cache check
- Full pipeline executes: data fetching, dedup, enrichment, scoring
- Results merge with instant suggestion via `combineResults()`

**Why two phases exist:** The instant phase eliminates perceived latency. Even when async results take 300-600ms (data fetching + scoring), the user sees their query reflected as a URL or search suggestion immediately. This prevents the UI from feeling "dead" during typing.

### Message Passing Flow

```
Content Script (overlay.js)
    |
    |-- SpotlightMessageClient.getSuggestions(query, mode)
    |     -> chrome.runtime.sendMessage({ action: 'getSpotlightSuggestions', query, mode })
    |
    v
Background Service Worker (background.js)
    |
    |-- chrome.runtime.onMessage listener
    |     -> backgroundSearchEngine.getSpotlightSuggestionsUsingCache(query, mode)
    |     -> sendResponse({ success: true, results })
    |
    v
Content Script receives results via sendResponse callback
```

All Chrome API calls (tabs, bookmarks, history, topSites) happen exclusively in the background service worker. The content script never calls Chrome APIs directly - it communicates entirely via message passing.

### Caching Architecture

The system has **three independent cache layers**:

| Cache Layer | Location | TTL | Key Format | Purpose |
|---|---|---|---|---|
| SearchEngine cache | `SearchEngine.cache` (Map) | 30s | `"query:mode"` | Avoid re-executing the full pipeline for repeated queries |
| AutocompleteProvider cache | `AutocompleteProvider.cache` (Map) | 30s | `query.toLowerCase()` | Avoid redundant Google API HTTP requests |
| ArcifyProvider cache | `ArcifyProvider.cache` (Map) + `chrome.storage.local` | Until invalidation | normalized URL | O(1) URL-to-space lookups; persists across service worker restarts |

**SearchEngine cache:** Checked before debouncing. If a cache hit occurs, the result resolves immediately without waiting for the debounce timer. Cache key includes mode (`current-tab`/`new-tab`) because results may differ by mode.

**AutocompleteProvider cache:** Deduplicates concurrent requests via `pendingRequests` Map. If the same query is requested while a fetch is in-flight, the second caller awaits the same promise rather than making a duplicate HTTP request.

**ArcifyProvider cache:** Built lazily on first access. Tries to restore from `chrome.storage.local` first (for service worker restart recovery), then falls back to rebuilding from the bookmark tree via `chrome.bookmarks.getSubTree()`. Invalidated on any bookmark CRUD event. Import batching (`onImportBegan`/`onImportEnded`) prevents thrashing during bulk operations.

---

## 2. Data Sources

### 2.1 Open Tabs

| Property | Value |
|---|---|
| **Chrome API** | `chrome.tabs.query({})` + `chrome.tabGroups.query({})` |
| **Filtering** | `fuzzyMatch(query, title)` OR `fuzzyMatch(query, url)` |
| **Data returned** | `{ title, url, favIconUrl, id, windowId, groupName, groupColor, pinned }` |
| **Result type** | `OPEN_TAB` (or `PINNED_TAB` if `tab.pinned === true`) |
| **Base score** | 90 (OPEN_TAB) or 85 (PINNED_TAB) |
| **File** | `background-data-provider.js: getOpenTabsData()` |

Tab groups are fetched in parallel with tabs via `Promise.all([chrome.tabs.query({}), chrome.tabGroups.query({})])`. A `groupMap` (Map<groupId, {title, color}>) is built for O(1) group lookups. When no query is provided, all tabs are returned (used for default results).

### 2.2 Pinned Tabs (Arcify Bookmarks)

| Property | Value |
|---|---|
| **Chrome API** | `chrome.storage.local.get('spaces')` + `chrome.tabs.query({})` + `BookmarkUtils.findArcifyFolder()` + `chrome.bookmarks.getChildren()` |
| **Filtering** | `fuzzyMatch(query, title)` OR `fuzzyMatch(query, url)` |
| **Data returned** | `{ title, url, id, spaceId, spaceName, spaceColor, tabId, isActive }` |
| **Result type** | `PINNED_TAB` |
| **Base score** | 85 |
| **File** | `background-data-provider.js: getPinnedTabsData()` |

This source walks the Arcify bookmark folder structure. For each space folder, it fetches bookmarks recursively via `BookmarkUtils.getBookmarksFromFolderRecursive()`, cross-references with the spaces array for color, and checks if the bookmark URL has a matching open tab (for `isActive` flag and `tabId`). The `findArcifyFolder()` method uses a 3-method fallback: search by title, tree traversal, and "Other Bookmarks" check.

### 2.3 Bookmarks

| Property | Value |
|---|---|
| **Chrome API** | `chrome.bookmarks.search(query)` |
| **Filtering** | Chrome's built-in substring matching; Arcify folder bookmarks excluded via `isUnderArcifyFolder()` |
| **Data returned** | `{ title, url, id }` |
| **Result type** | `BOOKMARK` |
| **Base score** | 80 |
| **File** | `bookmark-utils.js: getBookmarksData()` |

The filtering is delegated entirely to Chrome's `bookmarks.search()` API, which does substring matching on title and URL. This means fuzzy matching (e.g., "ghub" for "GitHub") does NOT work for bookmarks - only substring matches are returned. Arcify folder bookmarks are excluded by checking if the bookmark's `parentId` matches or starts with the Arcify folder ID.

### 2.4 History

| Property | Value |
|---|---|
| **Chrome API** | `chrome.history.search({ text: query, maxResults: 10, startTime: Date.now() - 7days })` |
| **Filtering** | Chrome's built-in matching; limited to last 7 days, max 10 results |
| **Data returned** | `{ title, url, visitCount, lastVisitTime }` |
| **Result type** | `HISTORY` |
| **Base score** | 70 |
| **File** | `background-data-provider.js: getHistoryData()` |

Both `visitCount` and `lastVisitTime` are stored in `metadata` on the `SearchResult` object, but **neither is used in scoring**. All history items get the same base score of 70 regardless of how often or recently they were visited. The 7-day window is hardcoded.

### 2.5 Top Sites

| Property | Value |
|---|---|
| **Chrome API** | `chrome.topSites.get()` |
| **Filtering** | `findMatchingTopSites()` - title/URL substring match + domain start match |
| **Data returned** | `{ title, url }` |
| **Result type** | `TOP_SITE` |
| **Base score** | 60 |
| **File** | `base-data-provider.js: getTopSites()`, `findMatchingTopSites()` |

Top sites are fetched unfiltered (all of them), then `findMatchingTopSites()` filters by: (1) title contains query, (2) URL contains query, or (3) the main domain starts with the query (e.g., "squaresp" matches "squarespace.com"). This is separate from the popular-sites fuzzy matching below.

### 2.6 Popular Sites Fuzzy Matches

| Property | Value |
|---|---|
| **Source** | `POPULAR_SITES` static mapping (~130 domains in `popular-sites.js`) |
| **Filtering** | `findMatchingDomains()` - domain start, domain contains, display name contains |
| **Data returned** | `{ domain, displayName, matchType }` |
| **Result type** | `TOP_SITE` (reuses the same type) |
| **Base score** | 60-65 (varies by match type via `getFuzzyMatchScore()`) |
| **File** | `popular-sites.js: findMatchingDomains()`, `base-data-provider.js: getFuzzyDomainMatches()` |

This is a static curated list of ~130 popular domains organized by category (search, social, tech, video, shopping, etc.). Matching types: `start` (domain prefix, score 65 with length penalty), `contains` (substring in domain, score 63), `name` (substring in display name, score 62). Results are capped at 5 matches and flagged with `metadata.fuzzyMatch = true` to bypass `calculateRelevanceScore()`.

### 2.7 Google Autocomplete

| Property | Value |
|---|---|
| **API** | `https://clients1.google.com/complete/search?client=firefox&q={query}` (unofficial) |
| **Filtering** | Minimum query length 2 characters; max 5 suggestions |
| **Data returned** | `{ title, url, score, metadata: { query, position, isUrl } }` |
| **Result type** | `AUTOCOMPLETE_SUGGESTION` |
| **Base score** | 30 (decreasing: 30, 29, 28, 27, 26) |
| **File** | `autocomplete-provider.js` |

Has its own 30-second cache and request deduplication. Request timeout is 3 seconds via `AbortController`. URL suggestions get website name extraction, search suggestions get Google search URLs. Score decreases by position: `BASE_SCORES.AUTOCOMPLETE_SUGGESTION - index` = 30, 29, 28, 27, 26.

### 2.8 Instant Suggestions

| Property | Value |
|---|---|
| **Source** | Client-side only (overlay.js via `SpotlightUtils.generateInstantSuggestion()`) |
| **Filtering** | None - always generated if query is non-empty |
| **Data returned** | URL suggestion or search query suggestion |
| **Result type** | `URL_SUGGESTION` or `SEARCH_QUERY` |
| **Score** | 1000 (`INSTANT_URL_SUGGESTION` or `INSTANT_SEARCH_QUERY`) |
| **File** | `ui-utilities.js: generateInstantSuggestion()` |

Always appears first in the combined results. Uses `isURL()` to determine if the input looks like a URL (supports protocols, domains, localhost, IP addresses, common TLDs). The instant suggestion is deduplicated against async results by `combineResults()` which uses `areResultsDuplicate()` for URL comparison.

---

## 3. Matching Algorithm

### 3.1 fuzzyMatch() Implementation

**Location:** `base-data-provider.js`, lines 454-474

```javascript
fuzzyMatch(query, text) {
    if (!query || !text) return false;
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Quick check: if query is contained, it's a match
    if (textLower.includes(queryLower)) {
        return true;
    }

    // Fuzzy match: all query characters must appear in order
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
        if (textLower[i] === queryLower[queryIndex]) {
            queryIndex++;
        }
    }
    return queryIndex === queryLower.length;
}
```

**Algorithm:** Two-pass matching:
1. **Substring check** (fast path): If the query is a substring of the text, return true immediately
2. **Character-order check** (fuzzy): Iterate through the text looking for each query character in sequence. All query characters must appear in the text in order, but can have any number of characters between them

**Examples:**
- `"ghub"` matches `"GitHub"` (g-i-t-**H**-**u**-**b** -- actually g...h...u...b in order)
- `"yt"` matches `"YouTube"` (y...t in order)
- `"gml"` matches `"Gmail"` (g...m...l in order)
- `"abc"` matches `"a_x_b_y_c_z"` (a...b...c in order, with many characters between)
- `"abc"` matches `"app backend controller"` (a...b...c scattered across words)

### 3.2 Tab Filtering

**Location:** `background-data-provider.js: getOpenTabsData()`, lines 33-53

Tabs are filtered using `fuzzyMatch()` on both title and URL:
```javascript
return this.fuzzyMatch(queryLower, titleLower) ||
       this.fuzzyMatch(queryLower, urlLower);
```

All tabs matching either criterion are included. There is no match-quality scoring at the filter stage - a tab that fuzzy-matches on a single scattered character pattern gets included just like an exact substring match.

### 3.3 Bookmark Filtering

**Location:** `bookmark-utils.js: getBookmarksData()`

Bookmarks are filtered by Chrome's `chrome.bookmarks.search(query)` API, which performs its own internal substring matching on title and URL. This means:
- `"github"` finds a bookmark titled "GitHub - Where the world builds software"
- `"ghub"` does **NOT** find that bookmark (Chrome's API does not do fuzzy matching)
- `"git"` finds it (substring match on "GitHub")

No additional fuzzy matching is applied after Chrome's search returns results.

### 3.4 History Filtering

**Location:** `background-data-provider.js: getHistoryData()`

History uses `chrome.history.search({ text: query })`, which performs Chrome's internal matching. Similar to bookmarks, this is substring-based, not fuzzy. Limited to last 7 days and max 10 results by hardcoded parameters.

### 3.5 Popular Sites Fuzzy Matching

**Location:** `popular-sites.js: findMatchingDomains()`

Three match types against the static POPULAR_SITES list:
1. **start** - domain (without TLD) starts with query: `"squaresp"` matches `"squarespace.com"`
2. **contains** - domain (without TLD) contains query: `"space"` matches `"squarespace.com"`
3. **name** - display name contains query: `"square"` matches `"Squarespace"` (via display name)

Results are sorted by an internal score (100 - length difference for start matches, 50 for contains, 30 for name) and limited to `maxResults` (default 10, used as 5 in `getFuzzyDomainMatches`).

### 3.6 Top Sites Matching

**Location:** `base-data-provider.js: findMatchingTopSites()`

Filters chrome.topSites results by:
1. Title contains query (substring)
2. URL contains query (substring)
3. Main domain (first part before `.`) starts with query (prefix match)

Example: query `"sq"` matches a top site `https://www.squarespace.com` via the domain start check.

### 3.7 Analysis: Is fuzzyMatch() Too Permissive?

**Yes.** The character-order fuzzy match has no constraint on the distance between matched characters. This leads to false positives:

- Query `"abc"` matches `"Authentication Backend Controller"` (a...b...c scattered across 3 words)
- Query `"tst"` matches `"The State of The Art"` (t...s...t)
- Query `"me"` matches every URL containing `".me"` or `"https://..."` (m in domain, e after)

The fuzzy match is **binary** (match/no match) with no quality score. A highly relevant match like `"git"` in `"GitHub"` is treated identically to a scattered match like `"git"` in `"Google Intelligence Tracker"`. Both pass the filter and receive the same base score.

---

## 4. Scoring System

### 4.1 BASE_SCORES Hierarchy

**Location:** `scoring-constants.js`

| Constant | Score | Used For |
|---|---|---|
| `INSTANT_SEARCH_QUERY` | 1000 | Instant search suggestion (Phase 1) |
| `INSTANT_URL_SUGGESTION` | 1000 | Instant URL suggestion (Phase 1) |
| `SEARCH_QUERY` | 100 | Fallback search query (error state) |
| `URL_SUGGESTION` | 95 | Fallback URL suggestion (error state) |
| `OPEN_TAB` | 90 | Currently open browser tab |
| `PINNED_TAB` | 85 | Arcify pinned/favorite tab |
| `BOOKMARK` | 80 | Chrome bookmark (non-Arcify) |
| `HISTORY` | 70 | Browser history item |
| `FUZZY_MATCH_START` | 65 | Popular site domain prefix match |
| `FUZZY_MATCH_CONTAINS` | 63 | Popular site domain substring match |
| `FUZZY_MATCH_NAME` | 62 | Popular site display name match |
| `FUZZY_MATCH_DEFAULT` | 60 | Default fuzzy match |
| `TOP_SITE` | 60 | Chrome top site |
| `AUTOCOMPLETE_SUGGESTION` | 30 | Google autocomplete suggestion |

### 4.2 SCORE_BONUSES

**Location:** `scoring-constants.js`

| Bonus | Value | Condition |
|---|---|---|
| `EXACT_TITLE_MATCH` | +20 | `title.toLowerCase() === query.toLowerCase()` |
| `TITLE_STARTS_WITH` | +15 | `title.toLowerCase().startsWith(query)` |
| `TITLE_CONTAINS` | +10 | `title.toLowerCase().includes(query)` |
| `URL_CONTAINS` | +5 | `url.toLowerCase().includes(query)` |

Bonuses are **mutually exclusive** for title matching (only the highest-matching bonus applies, via if/else-if chain). The URL bonus is **additive** (always checked independently).

### 4.3 calculateRelevanceScore()

**Location:** `base-data-provider.js`, lines 353-383

```
For each result:
  1. If metadata.fuzzyMatch === true → return result.score directly (pre-calculated)
  2. Otherwise: baseScore = BASE_SCORES[result.type]
  3. Apply title bonuses (exact > starts-with > contains)
  4. Apply URL bonus (additive)
  5. Return max(0, baseScore)
```

**Critical note:** Fuzzy match results from `getFuzzyDomainMatches()` bypass the standard scoring entirely. They use `getFuzzyMatchScore()` which calculates score based on match type and domain length, not query relevance.

**Score ranges by type (with bonuses):**

| Type | Min Score | Max Score (all bonuses) |
|---|---|---|
| OPEN_TAB | 90 | 115 (90 + 20 + 5) |
| PINNED_TAB | 85 | 110 (85 + 20 + 5) |
| BOOKMARK | 80 | 105 (80 + 20 + 5) |
| HISTORY | 70 | 95 (70 + 20 + 5) |
| TOP_SITE | 60 | 85 (60 + 20 + 5) |
| AUTOCOMPLETE | 30 | 30 (fuzzy match flag, bypasses bonuses) |

### 4.4 getFuzzyMatchScore()

**Location:** `scoring-constants.js`, lines 54-73

```javascript
getFuzzyMatchScore(matchType, domainLength, queryLength) {
    switch (matchType) {
        case 'start': score = 65 - (domainLength - queryLength) * 0.1;
        case 'contains': score = 63;
        case 'name': score = 62;
        default: score = 60;
    }
    return Math.max(score, 62); // Floor at FUZZY_MATCH_NAME
}
```

For `start` matches, shorter domains get higher scores. Example: query `"goo"` matching `"google.com"` (domain length 10) gets `65 - (10-3)*0.1 = 64.3`, while matching `"googleapis.com"` (domain length 14) gets `65 - (14-3)*0.1 = 63.9`. The minimum score is floored at 62 (`FUZZY_MATCH_NAME`).

### 4.5 getAutocompleteScore()

**Location:** `scoring-constants.js`, lines 49-51

```javascript
const getAutocompleteScore = (index) => BASE_SCORES.AUTOCOMPLETE_SUGGESTION - index;
```

Produces scores: 30, 29, 28, 27, 26 for positions 0-4. These results bypass `calculateRelevanceScore()` because they do not have `metadata.fuzzyMatch` set, but they DO go through the standard scoring path. Their base score is `BASE_SCORES.AUTOCOMPLETE_SUGGESTION = 30` plus any title/URL bonuses.

**Correction on bypass behavior:** Looking more carefully at the code, autocomplete suggestions are NOT flagged with `metadata.fuzzyMatch`, so they DO pass through `calculateRelevanceScore()`. Their pre-set `score` from `getAutocompleteScore()` is overwritten by `calculateRelevanceScore()` which sets it to `30 + bonuses`. The position-based scoring from `getAutocompleteScore()` is effectively lost.

### 4.6 Result Cap

Final results are capped at 8 items via `.slice(0, 8)` in `scoreAndSortResults()`. This means the top 8 scored results are shown. Combined with the instant suggestion (added separately in `combineResults`), the user sees up to 9 results total.

---

## 5. Deduplication

### 5.1 normalizeUrlForDeduplication()

**Location:** `base-data-provider.js`, lines 528-550

Normalization steps in order:
1. **Lowercase** the entire URL
2. **Remove fragments** (everything after `#`)
3. **Remove trailing slashes**
4. **Remove protocol** (`http://` or `https://`)
5. **Remove `www.` prefix**

Example: `"https://www.GitHub.com/features/#pricing/"` normalizes to `"github.com/features"`

**Query parameters are intentionally preserved.** Different query params = different pages (e.g., `?page=1` vs `?page=2`).

### 5.2 Priority System

**Location:** `base-data-provider.js: getResultPriority()`

When duplicates are found (same normalized URL), the result with higher priority wins:

```
open-tab (90) > pinned-tab (85) > bookmark (80) > history (70) > top-site (60) > autocomplete (30)
```

Priority is calculated as `BASE_SCORES[type] + result.score`, so a bookmark with score bonuses could potentially outpriority a bare open tab, but in practice the base score difference (90 vs 80) ensures open tabs almost always win.

For `top-site` type specifically, fuzzy matches use `BASE_SCORES.FUZZY_MATCH_START` (65) while regular top sites use `BASE_SCORES.TOP_SITE` (60).

### 5.3 Deduplication Timing

Deduplication happens **after** collecting all results but **before** Arcify enrichment and scoring. This ordering:
1. Prevents redundant Arcify lookups for duplicate URLs
2. Ensures higher-priority types are retained before scoring applies bonuses
3. Is applied to default results (no query) as well

A second deduplication layer exists in `combineResults()` (shared-component-logic.js) which deduplicates the instant suggestion against async results using `areResultsDuplicate()` (simpler URL comparison).

---

## 6. Arcify Enrichment

### 6.1 enrichWithArcifyInfo() Flow

**Location:** `base-data-provider.js`, lines 565-601

```
1. Lazy-load arcifyProvider via dynamic import
2. await arcifyProvider.ensureCacheBuilt()
3. if (!arcifyProvider.hasData()) return results  // early exit
4. For each result:
   a. Skip if no URL
   b. Skip if already has spaceName (pinned tabs already enriched)
   c. O(1) Map.get() lookup via getSpaceForUrl(url)
   d. If found: inject isArcify, spaceName, spaceId, bookmarkId, bookmarkTitle, spaceColor
```

### 6.2 Cache Building

**Location:** `arcify-provider.js`

The cache is a `Map<normalizedUrl, SpaceInfo>` where SpaceInfo contains `{ spaceName, spaceId, spaceColor, bookmarkId, bookmarkTitle }`.

**Build process:**
1. Try to restore from `chrome.storage.local` (key: `arcifyUrlCache`)
2. If not in storage, rebuild fresh:
   a. `BookmarkUtils.findArcifyFolder()` - 3-method fallback
   b. `chrome.bookmarks.getSubTree(arcifyFolder.id)` - single API call gets entire tree
   c. `chrome.storage.local.get('spaces')` - fetch space colors
   d. Walk subtree in-memory: first-level children are space folders, recurse into each
   e. For each bookmark: normalize URL, store in Map with space metadata
   f. Persist to `chrome.storage.local` for restart recovery

**Normalization:** Reuses `BaseDataProvider.normalizeUrlForDeduplication()` for consistency. Same URL normalized the same way in dedup and enrichment.

### 6.3 Cache Invalidation

**Events that invalidate:**
- `chrome.bookmarks.onCreated`
- `chrome.bookmarks.onRemoved`
- `chrome.bookmarks.onMoved`
- `chrome.bookmarks.onChanged`
- `spotlightOpened` message (forces fresh data on each spotlight open)

**Import batching:**
- `onImportBegan` sets `isImporting = true`, deferring invalidation
- `onImportEnded` clears the flag and processes any pending invalidation
- Prevents cache rebuilds during bulk bookmark operations

**Invalidation is aggressive:** Any bookmark change anywhere (not just in the Arcify folder) triggers invalidation. The cache is nullified and the storage entry removed. The next `ensureCacheBuilt()` call will rebuild from scratch.

---

## 7. Strengths Analysis

### 7.1 Instant Feedback via Two-Phase Model
The two-phase suggestion model ensures the UI is never empty after a keystroke. The instant suggestion (score 1000) provides immediate feedback while async results load. This is the single most important UX feature of the search system.

### 7.2 Fuzzy Matching for Common Abbreviations
The character-order fuzzy match handles common abbreviations well:
- `"ghub"` -> GitHub
- `"yt"` -> YouTube
- `"gml"` -> Gmail
- `"tw"` -> Twitter

These are high-value shortcuts that significantly speed up navigation for power users.

### 7.3 Comprehensive Deduplication
The URL normalization strategy (strip protocol, www, fragments, trailing slashes, preserve query params) effectively deduplicates the same page appearing as an open tab, bookmark, and history entry. The priority system correctly keeps the highest-value result type.

### 7.4 Score Hierarchy Matches User Intent
The priority ordering (open-tab > pinned-tab > bookmark > history > top-site > autocomplete) correctly reflects that:
- Switching to an already-open tab is more valuable than opening a new one
- User's own bookmarks are more relevant than algorithmically-suggested sites
- Local data is more relevant than external autocomplete suggestions

### 7.5 O(1) Arcify Enrichment
The ArcifyProvider's Map-based cache provides constant-time lookups per result URL. Combined with lazy initialization and persistent storage recovery, this adds minimal overhead to the search pipeline.

### 7.6 Multi-Layer Caching
Three independent caches (SearchEngine 30s, AutocompleteProvider 30s, ArcifyProvider persistent) prevent redundant work at different levels. The SearchEngine cache is particularly effective for users who type, pause, and retype similar queries.

### 7.7 Graceful Degradation
Every data source has its own try/catch block. If bookmarks fail, tabs still work. If the Google API times out (3s), other results are unaffected. The `generateFallbackResult()` ensures the user always gets at least a search or URL suggestion even if everything fails.

### 7.8 Dormant Content Script Architecture
Pre-injecting the spotlight as a dormant content script eliminates 1-2s injection delays on slow pages. Activation is instant via lightweight message passing.

---

## 8. Weaknesses and UX Issues

### 8.1 Scoring Gaps: Autocomplete Buried Under Everything

**Problem:** `AUTOCOMPLETE_SUGGESTION` has a base score of 30, while even the lowest local source (`TOP_SITE`) has 60. With bonuses, a history item with an exact title match scores 95, while the best autocomplete scores 30. Google suggestions are almost never visible in the top 8 results when ANY local match exists.

**Example:** User types `"react hooks"`. They have one history item titled "React documentation" (score: 70 + 10 title_contains = 80). Google autocomplete returns "react hooks tutorial" (score: 30). The tutorial never appears because 5+ local results outscore it, despite being exactly what the user wants.

**Impact:** High. Autocomplete suggestions are essentially invisible for any query that matches local data.

### 8.2 No Recency Signal in History Scoring

**Problem:** All history items receive the same base score of 70 regardless of when they were last visited. A page visited 5 minutes ago scores identically to one visited 6 days ago. The `lastVisitTime` metadata IS collected (`background-data-provider.js` line 269: `metadata: { visitCount: item.visitCount, lastVisitTime: item.lastVisitTime }`) but NEVER used in `calculateRelevanceScore()`.

**Example:** User types `"jira"`. They have two history items: "Jira - Sprint Board" (visited 2 minutes ago, 50 times) and "Jira - Old Project" (visited 5 days ago, once). Both get score 70 + 10 (title contains) = 80. The frequently-visited sprint board should obviously rank higher.

**Impact:** High. Violates user expectation that recent/frequent pages rank higher.

### 8.3 No Frequency Signal in History Scoring

**Problem:** `visitCount` from history is stored in metadata but never factored into scoring. A page visited 200 times scores the same as one visited once.

**Example:** User types `"slack"`. History has "Slack - Messages" (visited 200 times) and "Slack pricing page" (visited once from a Google search). Both get score 70 + 10 = 80. The user almost certainly wants the messages page.

**Impact:** High. Combined with no recency signal, history results are effectively random-ordered within their score tier.

### 8.4 Fuzzy Match False Positives

**Problem:** The character-order fuzzy match has no distance constraint. Characters can be arbitrarily far apart, leading to false positives on long strings.

**Example:** Query `"ct"` matches ANY URL containing a `c` followed by a `t` (which is nearly every URL, since most contain `https://`). Query `"me"` matches anything with `m` before `e`. Query `"st"` matches `"https://www.google.com/settings"` because of `s` in `https` and `t` in `settings`.

**Impact:** Medium. Users notice irrelevant results appearing, especially with 2-character queries. The effect is mitigated by the scoring system pushing these lower, but they still consume result slots.

### 8.5 No Match Quality Scoring for Tabs

**Problem:** Once a tab passes the fuzzy match filter, its score depends only on its type (90) and title/URL bonuses. A tab that matches with characters scattered across 50 characters scores the same as one with an exact title match (same bonuses).

**Example:** Query `"gh"` matches both "GitHub - Dashboard" (high quality match: `gh` at start of `github`) and "Google Chrome Help" (low quality match: `g` in Google, `h` in Help). Both get OPEN_TAB base score 90. The "Google Chrome Help" tab might even score higher if it has a URL containing "gh".

**Impact:** Medium. Relevant open tabs are not reliably surfaced above irrelevant ones for short queries.

### 8.6 Top Sites vs Popular Sites Overlap

**Problem:** `findMatchingTopSites()` and `getFuzzyDomainMatches()` operate independently and both produce `TOP_SITE` type results. If the user frequently visits `github.com`, it appears in both Chrome's top sites AND the popular-sites list. While deduplication catches URL-level duplicates, the processing work is redundant.

**Example:** Query `"git"` causes `findMatchingTopSites()` to return `github.com` (from Chrome top sites) AND `getFuzzyDomainMatches()` to return `github.com`, `gitlab.com` (from popular sites). The `github.com` duplicate is caught by dedup, but processing both sources for the same result is wasteful.

**Impact:** Low. Deduplication handles correctness. The inefficiency is minor but adds unnecessary work.

### 8.7 History Limited to 7 Days

**Problem:** `chrome.history.search` is called with `startTime: Date.now() - (7 * 24 * 60 * 60 * 1000)`. Users who revisit pages on a weekly or monthly cycle lose those results.

**Example:** A developer who visits their company's quarterly report page every 3 months can't find it via spotlight once it's older than 7 days. They must use bookmarks or type the full URL.

**Impact:** Medium. Power users with longer-term workflows are affected. The 7-day window was likely chosen to limit result count, but the `maxResults: 10` parameter already handles that.

### 8.8 No Personalization/Learning

**Problem:** The system has no memory of which results users actually select. Every search is treated as if it's the first time. There is no feedback loop to improve relevance over time.

**Example:** User searches `"sl"` every day and always selects "Slack". The system never learns this preference. "Slack" still competes with "Slides", "Sleep Timer", etc. on equal footing each time.

**Impact:** Medium-High for power users. The value compounds over time - a learning system would progressively improve relevance for each user's common queries.

### 8.9 Max 8 Results Sometimes Too Few

**Problem:** `scoreAndSortResults()` caps at 8 results via `.slice(0, 8)`. Combined with the instant suggestion, the user sees at most 9 results. For broad queries, the desired result may be at position 10+.

**Example:** User has 15 open tabs related to different GitHub repos. They type `"github"` hoping to find a specific one. Only the top 8 by score appear. If the desired tab has no exact-match bonuses, it's invisible.

**Impact:** Medium. Most queries find the right result in the top 8, but tab-heavy users with many similar URLs are frustrated.

### 8.10 Bookmark Search Delegates Entirely to Chrome

**Problem:** `chrome.bookmarks.search()` does substring matching only. Unlike tabs and pinned tabs (which use `fuzzyMatch()`), bookmarks have no fuzzy matching at all.

**Example:** A user has bookmarked "GitHub - Where the world builds software". Typing `"ghub"` finds it as an open tab (fuzzy match) but NOT as a bookmark (Chrome's search only does substrings). If the tab is closed, the bookmark becomes invisible to the same query.

**Impact:** Medium. Creates inconsistent behavior - the same shorthand works for tabs but fails for bookmarks. Users learn shortcuts for tabs that don't transfer to bookmarks.

### 8.11 Sequential Data Fetching

**Problem:** In `getSpotlightSuggestions()`, data sources are fetched sequentially with individual try/catch blocks:
```javascript
openTabs = await this.getOpenTabs(query);
pinnedTabs = await this.getPinnedTabSuggestions(query);
bookmarks = await this.getBookmarkSuggestions(query);
history = await this.getHistorySuggestions(query);
topSites = await this.getTopSites();
autocomplete = await this.getAutocompleteSuggestions(query);
```

Each `await` waits for the previous to complete. If tabs take 20ms, pinned tabs 30ms, bookmarks 15ms, history 10ms, top sites 5ms, and autocomplete 200ms (network), total time is ~280ms. With `Promise.all()`, it would be ~200ms (limited by the slowest: autocomplete).

**Example:** The Google autocomplete API sometimes takes 500ms-3000ms. During this time, all local results are already available but waiting to be delivered because the sequential chain hasn't completed.

**Impact:** High. This is the single biggest performance improvement opportunity. Parallelizing would reduce perceived latency by the sum of all non-bottleneck fetch times.

### 8.12 Double Debouncing

**Problem:** There are TWO independent debounce layers:
1. `SharedSpotlightLogic.createInputHandler()` in overlay.js: 150ms debounce on `handleAsyncSearch`
2. `SearchEngine.getSpotlightSuggestionsUsingCache()`: 150ms debounce (`this.DEBOUNCE_DELAY = 150`)

When the user types a character, the overlay debounces for 150ms, THEN sends a message to background, THEN SearchEngine debounces for another 150ms before executing. Effective delay: ~300ms for async results.

**Example:** User types "g-i-t-h-u-b" at normal speed (~50ms between keys). After the final "b", they wait 150ms (overlay debounce) + message transit + 150ms (SearchEngine debounce) = ~320ms before the search even starts executing.

**Impact:** High. Users experience a noticeable lag between finishing typing and seeing results. Removing one debounce layer would halve the delay.

---

## 9. Proposed Improvements (Ranked by Impact)

### High Impact

#### 1. Parallelize Data Source Fetching
**Current:** Sequential `await` for each source in `getSpotlightSuggestions()`
**Proposed:** Replace with `Promise.all()`:
```javascript
const [openTabs, pinnedTabs, bookmarks, history, topSites, autocomplete] =
    await Promise.all([
        this.getOpenTabs(query).catch(() => []),
        this.getPinnedTabSuggestions(query).catch(() => []),
        this.getBookmarkSuggestions(query).catch(() => []),
        this.getHistorySuggestions(query).catch(() => []),
        this.getTopSites().catch(() => []),
        this.getAutocompleteSuggestions(query).catch(() => [])
    ]);
```
**Expected improvement:** 2-3x faster suggestion latency. Total time becomes max(individual times) instead of sum(individual times). With autocomplete as the bottleneck (200-3000ms), local results no longer wait for the network.
**Risk:** Low. Each source already has independent error handling. The `.catch(() => [])` preserves the existing fallback behavior.
**Effort:** Low (single code change in `getSpotlightSuggestions()`).

#### 2. Incorporate Recency and Frequency into History Scoring
**Current:** All history items get base score 70 + title/URL bonuses
**Proposed:** Modify `calculateRelevanceScore()` to use `visitCount` and `lastVisitTime` from metadata:
```javascript
if (result.type === ResultType.HISTORY && result.metadata) {
    const frequencyBonus = Math.min((result.metadata.visitCount || 0) * 2, 20);
    const hoursSinceVisit = (Date.now() - (result.metadata.lastVisitTime || 0)) / 3600000;
    const recencyBonus = Math.max(0, 15 - Math.floor(hoursSinceVisit / 12));
    baseScore += frequencyBonus + recencyBonus;
}
```
**Expected improvement:** History results with 10+ visits score up to 20 points higher. Recent visits (last 12 hours) get up to 15 extra points. A frequently-visited, recently-accessed page could score 70 + 20 + 15 + bonuses = 115+, competing with open tabs.
**Risk:** Low. Purely additive - existing behavior preserved for single-visit old pages.
**Effort:** Low (modify `calculateRelevanceScore()` in base-data-provider.js).

#### 3. Fix Double Debouncing
**Current:** 150ms overlay debounce + 150ms SearchEngine debounce = ~300ms effective delay
**Proposed:** Remove the SearchEngine debounce when called from the background message handler. The overlay already debounces, so the SearchEngine should execute immediately:
- In `background.js`, use `getSpotlightSuggestionsImmediate()` for non-empty queries instead of `getSpotlightSuggestionsUsingCache()`
- OR reduce SearchEngine debounce to 0ms when the request has already been debounced upstream
**Expected improvement:** 150ms faster async results. Users see suggestions appear noticeably sooner after typing stops.
**Risk:** Low. The overlay debounce already prevents rapid-fire API calls. The SearchEngine cache (30s TTL) still prevents redundant computation for repeated queries.
**Effort:** Low (change one method call in background.js or add a flag).

#### 4. Improve Fuzzy Match Quality Scoring
**Current:** `fuzzyMatch()` returns boolean only. No match quality signal.
**Proposed:** Return a match quality score (0-1) based on:
- **Consecutive character bonus:** Characters matching consecutively score higher than scattered
- **Position bonus:** Matches at the start of the string score higher
- **Density:** Ratio of matched characters to total span
```javascript
fuzzyMatchScore(query, text) {
    // Returns { matched: boolean, score: 0.0-1.0 }
    // score = (consecutiveRuns * 0.3 + startBonus * 0.3 + density * 0.4)
}
```
Then use this score as a multiplier on the base score:
```javascript
const matchQuality = this.fuzzyMatchScore(query, text);
if (matchQuality.matched) {
    result.score = baseScore * (0.5 + 0.5 * matchQuality.score);
}
```
**Expected improvement:** High-quality matches (prefix, substring, consecutive) rank significantly above scattered character matches. Eliminates the "why is this irrelevant result showing?" UX issue.
**Risk:** Medium. Requires tuning the quality formula. Could change existing result ordering.
**Effort:** Medium (new function + integration into scoring pipeline).

### Medium Impact

#### 5. Raise Autocomplete Suggestion Scores
**Current:** Base score 30 (below everything)
**Proposed:** Raise to 50-55 for non-local-match queries. Logic: if fewer than 3 local results match, boost autocomplete scores to fill the gap.
```javascript
const localResultCount = allResults.filter(r => r.type !== ResultType.AUTOCOMPLETE_SUGGESTION).length;
if (localResultCount < 3) {
    autocompleteResults.forEach(r => r.score += 25);
}
```
**Expected improvement:** Google suggestions become visible when local data is sparse. For queries with no local matches (e.g., "react hooks tutorial"), autocomplete results fill the spotlight instead of showing only the instant suggestion.
**Risk:** Low. Only affects queries with few local matches, where autocomplete is most valuable.
**Effort:** Low (conditional score adjustment in `getSpotlightSuggestions()`).

#### 6. Apply Fuzzy Matching to Bookmarks Client-Side
**Current:** Only `chrome.bookmarks.search()` substring matching
**Proposed:** After getting Chrome's results, also search a local bookmark cache with `fuzzyMatch()`:
```javascript
async getBookmarkSuggestions(query) {
    const chromeResults = await this.getBookmarksData(query);
    // Also check local bookmark titles with fuzzy matching
    const allBookmarks = await this.getAllBookmarksCache();
    const fuzzyResults = allBookmarks.filter(b =>
        this.fuzzyMatch(query, b.title) || this.fuzzyMatch(query, b.url)
    );
    // Merge and dedup
    return this.mergeBookmarkResults(chromeResults, fuzzyResults);
}
```
**Expected improvement:** `"ghub"` now finds GitHub bookmarks just like it finds GitHub tabs. Consistent matching behavior across all result types.
**Risk:** Medium. Requires maintaining a bookmark cache. Performance impact if user has thousands of bookmarks.
**Effort:** Medium (new cache + fuzzy search + merge logic).

#### 7. Add Match Quality Multiplier for Tabs
**Current:** All fuzzy-matched tabs get the same base score
**Proposed:** Use fuzzy match quality (from improvement #4) to scale the tab score:
```javascript
const quality = this.fuzzyMatchScore(query, tab.title);
const tabScore = BASE_SCORES.OPEN_TAB * (0.6 + 0.4 * quality.score);
```
**Expected improvement:** For query `"gh"`, "GitHub - Dashboard" (quality 0.95) scores 90 * 0.98 = 88, while "Google Chrome Help" (quality 0.3) scores 90 * 0.72 = 65. The relevant tab surfaces above irrelevant ones.
**Risk:** Low (depends on improvement #4 being implemented first).
**Effort:** Low (integration of quality score into tab scoring).

#### 8. Extend History Window
**Current:** Last 7 days only
**Proposed:** Extend to 30 days with stronger recency decay in scoring:
```javascript
startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)
```
Combined with improvement #2 (recency/frequency scoring), older history items naturally rank lower due to recency decay, but remain discoverable.
**Expected improvement:** Users can find pages visited weekly or biweekly. The recency decay prevents old results from cluttering the top.
**Risk:** Low. Chrome's `maxResults: 10` already limits the result count regardless of time window.
**Effort:** Very low (change one constant).

### Lower Impact / Future

#### 9. Learn from Selections
**Current:** No selection tracking
**Proposed:** Track `{ query, selectedUrl, timestamp }` tuples in `chrome.storage.local`. When scoring results, add a boost for URLs previously selected for similar queries:
```javascript
const selectionHistory = await getSelectionHistory(query);
if (selectionHistory[result.url]) {
    baseScore += Math.min(selectionHistory[result.url].count * 5, 25);
}
```
**Expected improvement:** Over time, the user's preferred results for common queries float to the top. After selecting "Slack - Messages" for query "sl" three times, it gets +15 boost.
**Risk:** Medium. Storage growth needs management (prune old entries). Privacy considerations for storing query-URL pairs.
**Effort:** High (new storage schema, selection tracking, scoring integration, pruning).

#### 10. Dynamic Result Count
**Current:** Fixed cap of 8
**Proposed:** Show more results for longer queries where the user is more specific:
```javascript
const maxResults = query.length >= 5 ? 12 : query.length >= 3 ? 10 : 8;
```
**Expected improvement:** Longer queries (more specific intent) show more options. Short queries (browsing) keep the compact view.
**Risk:** Low. UI already supports scrolling.
**Effort:** Very low (parameterize the slice limit).

#### 11. Deduplicate Top Sites vs Popular Sites
**Current:** Both `findMatchingTopSites()` and `getFuzzyDomainMatches()` can return the same domain
**Proposed:** Run popular-sites matching only for domains NOT already matched by top sites:
```javascript
const topSiteUrls = new Set(matchingTopSites.map(s => new URL(s.url).hostname));
const fuzzyDomainMatches = this.getFuzzyDomainMatches(query)
    .filter(m => !topSiteUrls.has(m.domain));
```
**Expected improvement:** Eliminates duplicate processing and potential dedup collisions.
**Risk:** Very low.
**Effort:** Very low (add filter after top sites processing).

#### 12. Consider Fuse.js or Similar Library
**Current:** Hand-rolled `fuzzyMatch()` with no quality scoring
**Proposed:** Replace with Fuse.js which provides:
- Weighted fuzzy matching with configurable thresholds
- Match scoring (0-1) built-in
- Multi-key search (search title AND URL simultaneously)
- Configurable match distance and threshold
**Expected improvement:** Battle-tested matching quality, built-in scoring, less custom code.
**Risk:** Medium. Bundle size increase (~10KB minified). Different matching behavior users may notice. Index maintenance overhead.
**Effort:** High (replace matching layer, rebuild scoring, test thoroughly).

---

## 10. Potential Architecture Alternatives

### Option A: Weighted Multi-Signal Scoring (Recommended)

Keep the current architecture but replace the simple `base + bonus` scoring with a weighted multi-signal formula:

```
score = w1 * typeScore + w2 * matchQuality + w3 * recency + w4 * frequency + w5 * personalBoost
```

Where:
- `typeScore` = normalized base score by type (0-1)
- `matchQuality` = fuzzy match density/quality (0-1)
- `recency` = time decay function on lastVisitTime (0-1)
- `frequency` = log-scaled visitCount (0-1)
- `personalBoost` = selection history signal (0-1)

Default weights: `w1=0.35, w2=0.30, w3=0.15, w4=0.10, w5=0.10`

**Pros:**
- Incremental improvement over current system
- Minimal refactoring - extends existing scoring
- Each signal can be tuned independently
- Backward compatible (set w2-w5 to 0 for current behavior)
- Easy to A/B test different weight configurations

**Cons:**
- Requires tuning weights (though defaults can be reasonable)
- More complex debugging when results seem wrong
- Each new signal adds computation (minor)

### Option B: Fuse.js Integration

Replace all matching and scoring with the Fuse.js fuzzy search library. Build a unified search index containing all data sources, query it once.

```javascript
const fuse = new Fuse(allItems, {
    keys: [
        { name: 'title', weight: 0.7 },
        { name: 'url', weight: 0.3 }
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true
});
const results = fuse.search(query);
```

**Pros:**
- Battle-tested matching algorithm (Bitap algorithm with modifications)
- Built-in scoring that considers match quality
- Configurable thresholds prevent false positives
- Reduces custom matching/scoring code
- Active community and documentation

**Cons:**
- Bundle size increase (~10KB minified, ~4KB gzipped)
- Different matching behavior users may notice (could be better or worse)
- Need to maintain a unified index (build on spotlight open or on data changes)
- Loses the type-based priority system (would need to re-add as a post-processing step)
- Cold start: first search requires index build

### Option C: Pre-built Search Index

Build a unified search index when the spotlight opens (or maintain it incrementally via Chrome events). Contains all sources: tabs, pinned tabs, bookmarks, history, top sites. Query the index instead of hitting individual APIs.

```javascript
class SpotlightIndex {
    constructor() {
        this.items = new Map(); // normalizedUrl -> { title, url, type, metadata }
    }

    async rebuild() {
        const [tabs, bookmarks, history, topSites] = await Promise.all([...]);
        // Merge all into unified index with type priorities
    }

    search(query) {
        // Single pass over index with fuzzy matching + scoring
        return Array.from(this.items.values())
            .filter(item => this.matches(item, query))
            .map(item => this.score(item, query))
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }
}
```

**Pros:**
- Single search pass instead of 6 separate API calls
- Consistent matching across all sources
- Deduplication happens at index build time (not search time)
- Faster subsequent searches (no API calls)
- Can add incremental updates via Chrome events

**Cons:**
- Higher memory usage (maintaining all data in memory)
- Index maintenance complexity (tab opens/closes, bookmark changes, history updates)
- Cold start on first spotlight open (must build index)
- Loses real-time tab state (tabs opened after index build are invisible until rebuild)
- More complex architecture to maintain

### Recommendation

**Start with Option A (Weighted Multi-Signal Scoring)** as it has the best effort-to-impact ratio:
1. It works within the existing architecture (no rewrites)
2. It's fully backward compatible (current behavior is a special case)
3. It addresses the highest-impact weaknesses (#2 recency, #3 frequency, #4 match quality, #5 autocomplete scores)
4. It can be implemented incrementally (add one signal at a time)
5. It doesn't require external dependencies (no bundle size increase)

Option B (Fuse.js) is a good follow-up if match quality is still insufficient after Option A. Option C is best reserved for a major performance overhaul when the number of data sources grows beyond 6-7.

---

## Appendix: File Reference

| File | Role |
|---|---|
| `shared/search-engine.js` | Search orchestration, caching (30s), debouncing (150ms), action handling |
| `shared/data-providers/base-data-provider.js` | Core logic: getSpotlightSuggestions(), fuzzyMatch(), scoring, dedup, enrichment |
| `shared/data-providers/background-data-provider.js` | Chrome API integration: tabs, bookmarks, history, top sites, pinned tabs |
| `shared/scoring-constants.js` | BASE_SCORES, SCORE_BONUSES, getFuzzyMatchScore(), getAutocompleteScore() |
| `shared/search-types.js` | ResultType enum, SearchResult class, SpotlightTabMode |
| `shared/popular-sites.js` | POPULAR_SITES mapping (~130 domains), findMatchingDomains() |
| `shared/data-providers/autocomplete-provider.js` | Google autocomplete API, 30s cache, 3s timeout, request dedup |
| `shared/data-providers/arcify-provider.js` | URL-to-space cache, getSubTree() build, storage persistence |
| `shared/ui-utilities.js` | isURL(), generateInstantSuggestion(), formatResult(), chip rendering |
| `shared/shared-component-logic.js` | combineResults(), createInputHandler() (150ms debounce), generateResultsHTML() |
| `overlay.js` | Content script UI: two-phase model, handleInstantInput(), handleAsyncSearch() |
| `bookmark-utils.js` | findArcifyFolder(), getBookmarksData() with Arcify exclusion |
| `background.js` | Message routing, SearchEngine instance, Arcify cache event listeners |
