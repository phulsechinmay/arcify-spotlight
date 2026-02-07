# State: Arcify Spotlight

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome
**Current focus:** v2.0 Fuse.js Search — defining requirements

## Current Position

```
Milestone: v2.0 Fuse.js Search
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
```

Last activity: 2026-02-06 — Milestone v2.0 started

## Milestone History

| Milestone | Goal | Status |
|-----------|------|--------|
| v1.0 Polish | Bug fixes + UX improvements | Complete (archived) |
| v1.01 Testing | Testing Infrastructure (240 tests) | Complete |
| v1.5 | Arcify Integration (7/12 req, CHIP UI deferred) | Complete |
| v2.0 | Fuse.js Search | Active |

## Accumulated Context

### Search Algorithm Research Findings (quick-005)

Key findings from comprehensive search algorithm research (see quick/005-research-search-suggestion-algorithm-and/SEARCH-ALGORITHM-RESEARCH.md):
- Sequential data fetching is the biggest performance bottleneck (should use Promise.all)
- Double debouncing: overlay 150ms + SearchEngine 150ms = 300ms effective delay
- History visitCount and lastVisitTime collected but never used in scoring
- Autocomplete score (30) too low to compete with any local source (min 60)
- fuzzyMatch() has no distance constraint - causes false positives on short queries
- Bookmarks only use Chrome substring search, not fuzzyMatch (inconsistent with tabs)
- Recommended: Fuse.js for matching + weighted multi-signal scoring on top

### Architecture Decisions (carried forward)

| Decision | Rationale | Source |
|----------|-----------|-------|
| Two-phase suggestion model (instant + async) | Instant phase eliminates perceived latency | v1.0 |
| Deduplication in background data provider | Single place for dedup logic, before scoring | v1.0 |
| URL fragments stripped, query params preserved | Dedup consistency | v1.0 |
| chrome.tabGroups.get() for tab group colors | Direct API, no storage lookup | v1.0 |
| Dynamic import for arcifyProvider | Avoids circular dependencies | v1.5 |
| chrome.storage.local for Arcify cache | session doesn't survive service worker restarts | v1.5 |
| getSubTree() for bookmark tree traversal | Single API call vs O(n) getChildren() | v1.5 |
| Non-async first onMessage listener | Async listeners return Promise (truthy), stealing response channel | quick-002 |

### Technical Debt Noted

- Large monolithic components (sidebar.js is 3986 lines)
- Double debouncing (overlay 150ms + SearchEngine 150ms) — targeted for v2.0 fix
- Sequential data fetching — targeted for v2.0 fix
- History recency/frequency data collected but unused — targeted for v2.0 fix

## Quick Tasks

| Task | Goal | Status | Tests Added |
|------|------|--------|-------------|
| 001 | Arcify test coverage (Phases 6-8) | Complete | 62 (232 -> 294) |
| 002 | E2E tab group space chip | Complete | 2 (9 -> 11 E2E) |
| 003 | Fix chip tab group mismatch | Complete | 3 new (294 -> 297) |
| 004 | Bookmark "Open Pinned Tab" for Arcify | Complete | 3 new (297 -> 300) |
| 005 | Search suggestion algorithm research | Complete | 0 (research only) |

## Session Continuity

Last session: 2026-02-06
Stopped at: Starting v2.0 Fuse.js Search milestone
Next action: Define requirements and create roadmap
Resume file: None

---

*Last updated: 2026-02-06 — v2.0 Fuse.js Search milestone started*
