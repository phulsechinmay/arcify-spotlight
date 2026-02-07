# Milestones: Arcify Spotlight

## Completed Milestones

### v2.0 Fuse.js Search

**Completed:** 2026-02-07
**Timeline:** 2026-02-06 to 2026-02-07 (1 day)

**Goal:** Replace the entire matching and scoring system with Fuse.js-based architecture for better search relevancy and performance.

**Phases completed:** 9-12 (10 plans total)

**Key accomplishments:**
- Migrated all 7 data sources from hand-rolled fuzzyMatch() to Fuse.js with configurable thresholds and field weights (title:2, url:1)
- Replaced flat scoring with 4-signal weighted formula (TYPE 0.40 + MATCH 0.35 + RECENCY 0.15 + FREQUENCY 0.10)
- Parallelized data fetching with Promise.allSettled (6 sources concurrent) and eliminated double debounce (300ms -> 150ms)
- Implemented two-phase progressive rendering: local results in ~10-50ms, autocomplete appends at ~200-500ms
- Added conditional autocomplete boost (+40 max) that surfaces suggestions when few local matches exist
- 337 tests pass with zero failures, all behavioral contracts verified

**Stats:**
- 13 code files modified
- +1,584 / -515 lines changed (net +1,069)
- 4 phases, 10 plans
- 1 day from start to ship
- 337 tests (326 existing + 11 new regression)

**Git range:** `ed06237` (docs: start milestone v2.0) -> `3993cf6` (docs: milestone audit passed)

**What's next:** v2.1+ — Space chip UI, selection learning, accessibility improvements

---

### v1.5 Arcify Integration

**Completed:** 2026-02-06
**Timeline:** 2026-02-05 to 2026-02-06

**Goal:** Detect Arcify-managed tabs and surface their status in Spotlight suggestions.

**Accomplishments:**

Phase 6 - Detection & Cache:
- ArcifyProvider with O(1) URL-to-space cache via chrome.storage.local
- Folder detection using getSubTree() single API call
- Event-driven cache invalidation (onCreated, onRemoved, onMoved, onChanged)
- URL normalization for reliable matching

Phase 7 - Result Enrichment:
- Enrichment pipeline with spaceName, spaceColor, isArcify metadata
- "Open pinned tab" wording for Arcify-bookmarked tabs
- "Open favorite tab" for Chrome-pinned Arcify tabs
- Dynamic import pattern for arcifyProvider to avoid circular deps

**Requirements Satisfied:**
- DET-01: Extension detects Arcify folder in Chrome bookmarks on startup
- DET-02: Extension caches URL-to-space mapping with O(1) lookup performance
- DET-03: Cache refreshes automatically when bookmarks change
- DET-04: URL normalization ensures reliable matching
- WORD-01: Action text shows "Open pinned tab" for Arcify-bookmarked tabs
- WORD-02: Action text shows "Open favorite tab" for Chrome-pinned Arcify tabs
- WORD-03: Non-Arcify tabs keep existing "Switch to tab" wording unchanged

**Score:** 7/12 requirements (Phase 8 Space Chip UI deferred)

**Deferred to future:**
- CHIP-01 to CHIP-05: Space chip UI rendering (5 requirements)

**Quick Tasks Completed:** 5 (62 new tests, E2E tab group chips, chip fix, bookmark action text, search algorithm research)

**Key Decisions:**
- chrome.storage.local for cache (session doesn't survive restarts)
- getSubTree() for single-call tree traversal
- Lazy cache invalidation on any bookmark change
- Dynamic import for arcifyProvider (avoids circular deps)
- Enrichment after dedup, before scoring

---

### v1.01 Testing

**Completed:** 2026-02-04
**Stats:** 240 tests (unit, integration, E2E)

**Goal:** Establish comprehensive testing infrastructure with Vitest + Puppeteer.

**Accomplishments:**

- Phase 1: Test infrastructure setup (Vitest, Chrome API mocks, Puppeteer E2E)
- Phase 2: Unit tests for pure logic (URL utils, scoring, fuzzy matching)
- Phase 3: Unit tests with Chrome API mocks (caching, debouncing, action routing)
- Phase 4: Integration tests for message passing
- Phase 5: E2E tests for critical user flows

**Score:** 19/19 requirements, 240 tests

---

### v1.0 Polish

**Completed:** 2026-02-04
**Timeline:** 2026-01-24 to 2026-02-04 (11 days)
**Stats:** 25 commits, 4917 LOC

**Goal:** Fix suggestion bugs and improve UX density and visual feedback.

**Accomplishments:**

Phase 1 - Bug Fixes:
- URL deduplication: fragments, trailing slashes, www prefix, protocol normalization
- Fuzzy matching for open tab title/URL search with characters-in-sequence algorithm
- Priority-based deduplication ensuring open tabs rank higher than history entries
- Minimum 2-character query enforcement to reduce noise

Phase 2 - UX Improvements:
- URL preview updates input value on keyboard navigation (not just placeholder)
- SelectionManager callback pattern for selection-driven UI updates
- Tab group color theming via chrome.tabGroups.get() API
- Complete Chrome tab group color map: grey, blue, red, yellow, green, pink, purple, cyan, orange
- Purple fallback for ungrouped tabs

**Requirements Satisfied:**
- BUG-01: No duplicate suggestions when same URL exists in history and open tabs
- BUG-02: Open tabs appear in suggestions when input matches tab title or URL
- UX-01: URL bar updates to show selected suggestion URL on keyboard navigation
- UX-02: Denser suggestion list with reduced padding
- UX-03: Highlight color matches active tab group color (purple fallback)

**Score:** 5/5 requirements, 16/16 must-haves, 3/3 E2E flows verified

**Key Decisions:**
- Two-phase approach: bugs first, UX second
- Deduplication logic in background data provider layer
- URL fragments stripped during deduplication (page#section1 = page#section2)
- Query parameters preserved (page?id=1 != page?id=2)
- Direct Tab Groups API usage instead of chrome.storage.local lookup
- URL preview uses input.value with flag to prevent search re-trigger
- Autocomplete suggestions prioritize metadata.query over URL/title

**Deferred to v1.5:**
- INT-01: Detect when tab is in Arcify bookmark folder

**Archived:** .planning/archive/v1.0/

---

*Last updated: 2026-02-07 — v2.0 Fuse.js Search shipped*
