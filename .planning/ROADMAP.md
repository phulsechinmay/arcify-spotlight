# Roadmap: Arcify Spotlight

**Current Milestone:** v2.0 Fuse.js Search
**Created:** 2026-02-06
**Phases:** 4 (Phases 9-12, continuing from v1.5)
**Depth:** Standard

## Overview

This milestone replaces the hand-rolled matching and scoring system with Fuse.js-based architecture. Fuse.js integration comes first (matching foundation), then scoring is rebuilt on top of Fuse.js match quality signals, then performance bottlenecks are eliminated (parallel fetching, debounce, progressive rendering), and finally regression safety is verified end-to-end.

## Milestones

- v1.0 MVP - Phases 1-4 (shipped 2026-02-04, archived)
- v1.01 Testing - Phases 1-5 (shipped 2026-02-04)
- v1.5 Arcify Integration - Phases 6-8 (shipped 2026-02-06, CHIP UI deferred)
- **v2.0 Fuse.js Search** - Phases 9-12 (in progress)

## Phases

<details>
<summary>v1.01 Testing Infrastructure (Phases 1-5) - COMPLETE</summary>

See previous roadmap revision for v1.01 phase details.
- Phase 1: Test Infrastructure Setup (4/4 requirements)
- Phase 2: Unit Tests - Pure Logic (6/6 requirements)
- Phase 3: Unit Tests - Chrome API Mocks (3/3 requirements)
- Phase 4: Integration Tests (3/3 requirements)
- Phase 5: E2E Tests (3/3 requirements)

**Total:** 19/19 requirements, 240 tests

</details>

<details>
<summary>v1.5 Arcify Integration (Phases 6-8) - COMPLETE (CHIP UI deferred)</summary>

- Phase 6: Detection & Cache (DET-01 to DET-04) - Complete
- Phase 7: Result Enrichment (WORD-01 to WORD-03) - Complete
- Phase 8: Space Chip UI (CHIP-01 to CHIP-05) - Deferred to v2.1+

**Total:** 7/12 requirements complete, 5 deferred

</details>

### v2.0 Fuse.js Search (In Progress)

**Milestone Goal:** Replace the entire matching and scoring system with Fuse.js-based architecture for better search relevancy and performance.

---

### Phase 9: Fuse.js Matching Engine

**Goal:** All data sources use Fuse.js for fuzzy matching with configurable thresholds and field weights

**Dependencies:** None (foundation for v2.0)

**Requirements:** MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05

**Success Criteria** (what must be TRUE):
1. Typing a query returns fuzzy-matched results from tabs, bookmarks, and history using Fuse.js (not the old fuzzyMatch function)
2. A title match ranks higher than a URL-only match for the same query (e.g., searching "git" ranks a tab titled "GitHub" above a tab with "git" only in the URL)
3. Short queries (2-3 characters) do not produce obviously wrong matches (e.g., "ab" does not match "xyz123")
4. Each search result carries a numeric match quality score between 0 and 1
5. Bookmark results use Fuse.js fuzzy matching (not Chrome's substring-only search)

**Plans:** TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

---

### Phase 10: Weighted Scoring System

**Goal:** Results are ranked by a multi-signal formula combining match quality, source type, recency, and frequency

**Dependencies:** Phase 9 (requires Fuse.js match quality scores)

**Requirements:** SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05

**Success Criteria** (what must be TRUE):
1. Results are ordered by a combined score that visibly weighs match quality, source type, recency, and visit frequency (not just flat per-type scores)
2. Open tabs still appear above bookmarks and history for equally strong matches (source priority preserved)
3. A page visited 5 minutes ago ranks higher than the same page visited 3 weeks ago for the same query
4. A page visited 50 times ranks higher than a page visited twice for the same query
5. When a query has zero or few local matches, Google autocomplete suggestions appear in results (not buried below empty slots)

**Plans:** TBD

Plans:
- [ ] 10-01: TBD

---

### Phase 11: Performance

**Goal:** Search results appear faster through parallel data fetching, single debounce, and progressive rendering

**Dependencies:** None (independent of Phases 9-10, can execute in parallel or after)

**Requirements:** PERF-01, PERF-02, PERF-03

**Success Criteria** (what must be TRUE):
1. All data sources (tabs, bookmarks, history, top sites, autocomplete) are fetched in parallel via Promise.all, not sequentially
2. Only one debounce layer exists between keystroke and search execution (not the current overlay 150ms + SearchEngine 150ms stack)
3. Local results (tabs, bookmarks, history) render immediately, and autocomplete suggestions append into the list when they arrive (no waiting for slowest source)

**Plans:** TBD

Plans:
- [ ] 11-01: TBD

---

### Phase 12: Regression Validation

**Goal:** All existing functionality works correctly after the v2.0 migration

**Dependencies:** Phases 9, 10, 11 (validates everything together)

**Requirements:** REG-01, REG-02

**Success Criteria** (what must be TRUE):
1. All 300+ existing tests pass with zero failures after the full migration
2. Duplicate results are still deduplicated (same URL from history + open tabs shows once)
3. Arcify enrichment still works (Arcify-bookmarked tabs show "Open pinned tab" wording)
4. Action routing unchanged (selecting a tab switches to it, selecting a URL navigates to it, selecting a bookmark opens it)

**Plans:** TBD

Plans:
- [ ] 12-01: TBD

---

## Progress

**Execution Order:** Phase 9 -> Phase 10 -> Phase 11 -> Phase 12

Note: Phase 11 (Performance) is technically independent of Phases 9-10 but is sequenced after them to avoid concurrent refactoring of the same search pipeline. Phase 12 runs last as final validation.

| Phase | Milestone | Status | Requirements | Completed |
|-------|-----------|--------|--------------|-----------|
| 1-5 | v1.01 | Complete | 19/19 | 2026-02-04 |
| 6-7 | v1.5 | Complete | 7/7 | 2026-02-06 |
| 8 | v1.5 | Deferred | CHIP UI (5 req) | - |
| 9 - Fuse.js Matching Engine | v2.0 | Not started | MATCH-01 to MATCH-05 | - |
| 10 - Weighted Scoring System | v2.0 | Not started | SCORE-01 to SCORE-05 | - |
| 11 - Performance | v2.0 | Not started | PERF-01 to PERF-03 | - |
| 12 - Regression Validation | v2.0 | Not started | REG-01, REG-02 | - |

**v2.0 Progress:** 0/15 requirements complete

## Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| MATCH-01 | 9 | All data sources use Fuse.js for fuzzy matching |
| MATCH-02 | 9 | Title matches weighted higher than URL matches |
| MATCH-03 | 9 | Threshold configured to eliminate false positives |
| MATCH-04 | 9 | Each result includes match quality score (0-1) |
| MATCH-05 | 9 | Bookmarks use Fuse.js matching |
| SCORE-01 | 10 | Weighted multi-signal scoring formula |
| SCORE-02 | 10 | Source type priority preserved |
| SCORE-03 | 10 | History recency signal |
| SCORE-04 | 10 | History frequency signal |
| SCORE-05 | 10 | Autocomplete scores competitively when few local matches |
| PERF-01 | 11 | Parallel data source fetching |
| PERF-02 | 11 | Single debounce layer |
| PERF-03 | 11 | Progressive rendering |
| REG-01 | 12 | All existing tests pass |
| REG-02 | 12 | Deduplication, enrichment, routing unchanged |

**Coverage:** 15/15 v2.0 requirements mapped

---

*Roadmap created: 2026-02-06 (v2.0 Fuse.js Search)*
