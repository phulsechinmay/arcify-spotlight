---
phase: quick-005
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/005-research-search-suggestion-algorithm-and/SEARCH-ALGORITHM-RESEARCH.md
autonomous: true

must_haves:
  truths:
    - "Research document fully explains the current search pipeline end-to-end"
    - "Research document identifies concrete UX weaknesses with real examples"
    - "Research document proposes actionable improvements ranked by impact"
  artifacts:
    - path: ".planning/quick/005-research-search-suggestion-algorithm-and/SEARCH-ALGORITHM-RESEARCH.md"
      provides: "Comprehensive analysis of search suggestion algorithm with improvement proposals"
      min_lines: 200
  key_links: []
---

<objective>
Research and document how the Arcify Spotlight search suggestion algorithm works (matching, ranking, scoring, relevancy), analyze its strengths and weaknesses, and propose concrete improvements for better UX.

Purpose: Create a comprehensive reference document that serves as both documentation of the current system and a roadmap for search quality improvements.
Output: A single research document covering architecture, analysis, and proposals.
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md

The search suggestion system spans these files (read ALL of them thoroughly before writing):

Core algorithm files:
@shared/search-engine.js - SearchEngine class: caching, debouncing, action handling
@shared/data-providers/base-data-provider.js - BaseDataProvider: the main orchestration logic including getSpotlightSuggestions(), fuzzyMatch(), scoreAndSortResults(), calculateRelevanceScore(), deduplicateResults(), enrichWithArcifyInfo()
@shared/data-providers/background-data-provider.js - BackgroundDataProvider: Chrome API integration, tab/bookmark/history data fetching
@shared/scoring-constants.js - BASE_SCORES, SCORE_BONUSES, getFuzzyMatchScore(), getAutocompleteScore()
@shared/search-types.js - ResultType enum, SearchResult class
@shared/popular-sites.js - POPULAR_SITES mapping, findMatchingDomains() fuzzy domain matching
@shared/data-providers/autocomplete-provider.js - Google autocomplete API integration
@shared/data-providers/arcify-provider.js - Arcify URL-to-space cache for enrichment
@shared/ui-utilities.js - SpotlightUtils: isURL(), generateInstantSuggestion(), formatResult()
@shared/shared-component-logic.js - combineResults(), createInputHandler() debouncing
@overlay.js - Content script UI: handleInstantInput(), handleAsyncSearch(), two-phase suggestion model
@bookmark-utils.js - BookmarkUtils: getBookmarksData() with Arcify folder exclusion
@background.js - Message listener routing for all search actions
</context>

<tasks>

<task type="auto">
  <name>Task 1: Deep-read all search algorithm files and produce comprehensive research document</name>
  <files>.planning/quick/005-research-search-suggestion-algorithm-and/SEARCH-ALGORITHM-RESEARCH.md</files>
  <action>
Read every file listed in the context section above. Trace the complete search flow from keystroke to rendered suggestion. Then write a comprehensive research document with these sections:

## 1. Architecture Overview
- Diagram the full pipeline: keystroke -> overlay.js input handler -> instant suggestion (sync) + debounced async search -> background message -> SearchEngine -> BaseDataProvider.getSpotlightSuggestions() -> parallel data fetching -> deduplication -> Arcify enrichment -> scoring -> sort -> return -> combineResults() -> render
- Explain the two-phase suggestion model (instant + async) and why it exists
- Document the message passing flow between content script and background service worker
- Explain how caching works at each layer (SearchEngine 30s cache, AutocompleteProvider 30s cache, ArcifyProvider persistent storage cache)

## 2. Data Sources
For each source, document: what Chrome API is called, what filtering happens, what data is returned, what score it gets.
- Open tabs (chrome.tabs.query + fuzzy match filter)
- Pinned tabs (Arcify bookmarks + space storage + tab matching)
- Bookmarks (chrome.bookmarks.search with Arcify exclusion)
- History (chrome.history.search, last 7 days, max 10)
- Top sites (chrome.topSites.get + domain fuzzy matching)
- Popular sites fuzzy matches (POPULAR_SITES static list + findMatchingDomains)
- Google autocomplete (external API with 30s cache, 3s timeout)
- Instant suggestions (URL detection or search query, score 1000)

## 3. Matching Algorithm
- Document the fuzzyMatch() implementation: substring check first, then character-order matching
- Document how tabs are filtered (fuzzy match on title AND URL)
- Document how bookmarks are filtered (chrome.bookmarks.search does its own matching)
- Document how history is filtered (chrome.history.search does its own matching)
- Document popular sites fuzzy matching (start, contains, name match types)
- Document top sites matching (title/URL contains + domain start match)
- Analyze: Is fuzzyMatch too permissive? Does "abc" match "a_x_b_y_c_z"? (Yes - characters just need to be in order)

## 4. Scoring System
- Document the full BASE_SCORES hierarchy (1000, 100, 95, 90, 85, 80, 70, 65, 63, 62, 60, 30)
- Document SCORE_BONUSES (exact title: +20, starts with: +15, contains: +10, URL contains: +5)
- Document calculateRelevanceScore(): base score by type + bonuses for query match
- Document getFuzzyMatchScore(): domain length penalty for start matches, minimum floor
- Document getAutocompleteScore(): decreasing by position (30, 29, 28...)
- Note: fuzzy match results bypass calculateRelevanceScore() entirely (use pre-calculated score)
- Note: final results capped at 8 items via .slice(0, 8)

## 5. Deduplication
- Document normalizeUrlForDeduplication(): lowercase, strip fragments, strip trailing slashes, strip protocol, strip www
- Document priority system for keeping higher-priority duplicates (open-tab > pinned-tab > bookmark > history > top-site)
- Note: query params are preserved (intentional - different params = different pages)

## 6. Arcify Enrichment
- Document the enrichWithArcifyInfo() flow: lazy-load provider -> ensureCacheBuilt() -> O(1) Map lookup per result
- Document how cache is built from bookmark tree (getSubTree single API call)
- Document cache invalidation (bookmark CRUD events + import batching)

## 7. Strengths Analysis
Identify what works well:
- Two-phase model gives instant feedback
- Fuzzy matching catches abbreviations (ghub -> GitHub)
- Deduplication prevents clutter from same URL in tabs/bookmarks/history
- Score hierarchy correctly prioritizes open tabs over bookmarks over history
- Arcify enrichment is O(1) per lookup
- Caching at multiple layers prevents redundant API calls

## 8. Weaknesses and UX Issues
Be specific and provide examples for each issue:
- **Scoring gaps**: The gap between OPEN_TAB (90) and BOOKMARK (80) is small, but AUTOCOMPLETE_SUGGESTION (30) is far too low -- Google suggestions rarely appear because they're buried under everything
- **No recency signal**: History items all get the same base score (70) regardless of visitCount or lastVisitTime metadata that IS available but NEVER used
- **No frequency signal**: visitCount from history is stored in metadata but never factored into scoring
- **Fuzzy match false positives**: The character-order fuzzy match is too permissive ("abc" matches any string containing a, b, c in order, even with hundreds of characters between them)
- **No match quality scoring for tabs**: Tabs that fuzzy-match weakly get the same score as exact matches (base score only varies by title/URL bonuses, not match quality)
- **Top sites fetched but poorly integrated**: getTopSites() fetches all top sites, then findMatchingTopSites() filters -- but these compete with the popular-sites fuzzy matches, potentially creating duplicates
- **History limited to 7 days**: Users with longer-term workflows lose older frequently-visited sites
- **No personalization/learning**: The system doesn't learn from user selections
- **Max 8 results is sometimes too few**: Complex queries might have the desired result at position 9+
- **Bookmark search delegates entirely to Chrome API**: chrome.bookmarks.search() does substring matching, no fuzzy matching -- so "ghub" won't find a bookmark titled "GitHub"
- **Sequential data fetching**: Open tabs, pinned tabs, bookmarks, history, top sites, autocomplete are fetched sequentially with individual try/catch -- could be parallelized with Promise.all()
- **Double debouncing**: SearchEngine has 150ms debounce AND overlay.js createInputHandler has 150ms debounce -- effectively 300ms delay for async results

## 9. Proposed Improvements (Ranked by Impact)

### High Impact
1. **Parallelize data source fetching** - Replace sequential awaits with Promise.all() in getSpotlightSuggestions(). Expected improvement: 2-3x faster suggestion latency.
2. **Incorporate recency and frequency into history scoring** - Use visitCount and lastVisitTime from metadata. Proposed formula: `base + Math.min(visitCount * 2, 20) + recencyBonus(lastVisitTime)`.
3. **Fix double debouncing** - Remove one layer of debouncing (either SearchEngine or overlay input handler, not both). Expected improvement: 150ms faster async results.
4. **Improve fuzzy match quality scoring** - Score fuzzy matches by match density (consecutive characters score higher than spread-out characters). Consider Levenshtein distance or a scoring fuzzy match algorithm.

### Medium Impact
5. **Raise autocomplete suggestion scores** - Bump from 30 to 50-55 so Google suggestions compete with history/top sites when no local matches exist.
6. **Apply fuzzy matching to bookmarks client-side** - After chrome.bookmarks.search(), also run fuzzyMatch() against all bookmarks for queries that return few results.
7. **Add match quality multiplier for tabs** - Scale the tab base score by match quality (exact > starts-with > contains > fuzzy), not just bonuses.
8. **Extend history window** - Increase from 7 days to 30 days, but apply stronger recency decay.

### Lower Impact / Future
9. **Learn from selections** - Track which results users pick and boost those URLs for similar queries (stored in chrome.storage.local).
10. **Dynamic result count** - Show up to 12 results for longer queries, fewer for short ones.
11. **Deduplicate top sites vs popular sites matches** - Add dedup between findMatchingTopSites() and getFuzzyDomainMatches() outputs before merging.
12. **Consider Fuse.js or similar** - Replace hand-rolled fuzzy matching with a battle-tested library that provides match scores.

## 10. Potential Architecture Alternatives

### Option A: Weighted Multi-Signal Scoring (Recommended)
Keep current architecture but replace simple base+bonus scoring with a weighted multi-signal formula:
```
score = w1*typeScore + w2*matchQuality + w3*recency + w4*frequency + w5*personalBoost
```
Where matchQuality considers: exact match, prefix match, substring, fuzzy density.
Pros: Incremental improvement, minimal refactoring. Cons: Requires tuning weights.

### Option B: Fuse.js Integration
Replace all matching/scoring with Fuse.js fuzzy search library.
Pros: Battle-tested matching, built-in scoring, configurable thresholds. Cons: Bundle size increase (~10KB), need to maintain index, different matching behavior users may notice.

### Option C: Pre-built Search Index
Build a unified search index on spotlight open (or on bookmark/history change) containing all sources. Query the index instead of hitting individual APIs.
Pros: Single search pass, consistent matching across all sources, faster queries. Cons: Higher memory usage, index maintenance complexity, cold start on first open.

Recommendation: Start with Option A (weighted scoring) as it has the best effort-to-impact ratio and is fully backward compatible.
  </action>
  <verify>
- File exists at .planning/quick/005-research-search-suggestion-algorithm-and/SEARCH-ALGORITHM-RESEARCH.md
- Document has all 10 sections listed above
- Document is at least 200 lines
- All code references are accurate (file paths, function names, constant values)
- Each weakness includes a concrete example
- Each improvement includes expected impact
  </verify>
  <done>Comprehensive research document covers the full search pipeline, identifies at least 8 specific weaknesses with examples, and proposes at least 10 ranked improvements with 3 architecture alternatives.</done>
</task>

</tasks>

<verification>
- Research document exists and is comprehensive (200+ lines)
- All 10 sections are present with substantive content
- Code references are verifiable against actual source files
- Weaknesses are specific (not vague) and improvements are actionable
</verification>

<success_criteria>
- Complete research document covering current algorithm architecture, scoring, matching, and deduplication
- At least 8 identified weaknesses with concrete examples
- At least 10 proposed improvements ranked by impact
- At least 2-3 architecture alternatives evaluated with pros/cons
- Document is self-contained and useful as a reference for future implementation work
</success_criteria>

<output>
After completion, create `.planning/quick/005-research-search-suggestion-algorithm-and/005-SUMMARY.md`
</output>
