# Roadmap: Arcify Spotlight v1.5 Arcify Integration

**Milestone:** v1.5 Arcify Integration
**Created:** 2026-02-05
**Phases:** 3 (Phases 6-8, continuing from v1.01)
**Depth:** Standard

## Overview

This milestone integrates Arcify bookmark detection into Spotlight search. The extension detects tabs bookmarked in Arcify's folder structure, caches URL-to-space mappings for fast lookup, updates suggestion wording to distinguish pinned/favorite tabs, and displays colored space chips below Arcify suggestions. The implementation follows the existing data provider pattern, adding an ArcifyProvider component that enriches search results with space metadata.

## Milestones

- v1.0 MVP - Phases 1-4 (shipped 2026-02-04, archived)
- v1.01 Testing - Phases 1-5 (shipped 2026-02-04)
- **v1.5 Arcify Integration** - Phases 6-8 (in progress)

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

### v1.5 Arcify Integration (In Progress)

**Milestone Goal:** Detect Arcify-managed tabs and surface their status in Spotlight suggestions

---

### Phase 6: Detection & Cache

**Goal:** Arcify bookmarks are detected and cached with O(1) lookup performance

**Dependencies:** None (foundation for v1.5)

**Requirements:**
- DET-01: Extension detects Arcify folder in Chrome bookmarks on startup
- DET-02: Extension caches URL-to-space mapping with O(1) lookup performance
- DET-03: Cache refreshes automatically when bookmarks change
- DET-04: URL normalization ensures reliable matching

**Success Criteria:**
1. Extension finds Arcify folder regardless of Chrome locale or folder location
2. URL lookup returns space info in constant time (no recursive traversal per query)
3. Adding/removing/moving a bookmark triggers cache refresh within 1 second
4. URLs with trailing slashes, www prefix, or protocol variations match correctly

**Plans:** 1 plan

Plans:
- [ ] 06-01-PLAN.md — ArcifyProvider with folder detection, O(1) cache, and event listeners

---

### Phase 7: Result Enrichment

**Goal:** Search results include Arcify metadata with correct action wording

**Dependencies:** Phase 6 (requires cache for lookups)

**Requirements:**
- WORD-01: Action text shows "Open pinned tab" for Arcify-bookmarked tabs
- WORD-02: Action text shows "Open favorite tab" for Chrome-pinned Arcify tabs
- WORD-03: Non-Arcify tabs keep existing "Switch to tab" wording unchanged

**Success Criteria:**
1. Arcify-bookmarked tab shows "Open pinned tab" instead of "Switch to tab"
2. Chrome-pinned Arcify tab shows "Open favorite tab" (Chrome pin + Arcify bookmark)
3. Regular tabs (not in Arcify folder) still show "Switch to tab"

**Plans:** TBD

Plans:
- [ ] 07-01: Enrich results with space metadata and update action text

---

### Phase 8: Space Chip UI

**Goal:** Space chips appear below Arcify suggestions with proper styling and accessibility

**Dependencies:** Phase 7 (requires enriched results with space metadata)

**Requirements:**
- CHIP-01: Space name chip appears below Arcify suggestion items
- CHIP-02: Chip color matches tab group color
- CHIP-03: Chip is static/non-interactive (keyboard navigation unchanged)
- CHIP-04: Chip has WCAG 3:1 contrast ratio
- CHIP-05: Feature degrades gracefully when Arcify folder not found

**Success Criteria:**
1. Space chip appears below URL line for Arcify suggestions (not for regular tabs)
2. Chip background color matches the space's tab group color
3. Arrow keys skip over chips (focus stays on suggestion items)
4. Chip text is readable against its background color (3:1 contrast minimum)
5. Spotlight works normally when Arcify folder is missing (no chips, no errors)

**Plans:** TBD

Plans:
- [ ] 08-01: Space chip rendering with color palette and accessibility

---

## Progress

| Phase | Milestone | Status | Requirements | Completed |
|-------|-----------|--------|--------------|-----------|
| 1-5 | v1.01 | Complete | 19/19 | 2026-02-04 |
| 6 - Detection & Cache | v1.5 | Planned | DET-01, DET-02, DET-03, DET-04 | - |
| 7 - Result Enrichment | v1.5 | Not started | WORD-01, WORD-02, WORD-03 | - |
| 8 - Space Chip UI | v1.5 | Not started | CHIP-01, CHIP-02, CHIP-03, CHIP-04, CHIP-05 | - |

**v1.5 Progress:** 0/12 requirements complete

## Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| DET-01 | 6 | Arcify folder detection on startup |
| DET-02 | 6 | O(1) URL-to-space lookup cache |
| DET-03 | 6 | Automatic cache refresh on bookmark changes |
| DET-04 | 6 | URL normalization for reliable matching |
| WORD-01 | 7 | "Open pinned tab" wording for Arcify tabs |
| WORD-02 | 7 | "Open favorite tab" for Chrome-pinned Arcify tabs |
| WORD-03 | 7 | Unchanged wording for non-Arcify tabs |
| CHIP-01 | 8 | Space name chip below Arcify suggestions |
| CHIP-02 | 8 | Chip color matches tab group |
| CHIP-03 | 8 | Static chip (non-interactive) |
| CHIP-04 | 8 | WCAG 3:1 contrast ratio |
| CHIP-05 | 8 | Graceful degradation when folder missing |

**Coverage:** 12/12 v1.5 requirements mapped

---

*Roadmap created: 2026-02-05*
*Phase 6 planned: 2026-02-05*
