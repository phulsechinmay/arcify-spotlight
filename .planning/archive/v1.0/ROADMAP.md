# Roadmap: Arcify Spotlight v1.0 Polish

**Milestone:** v1.0 Polish
**Created:** 2026-02-03
**Phases:** 2
**Depth:** Standard

## Overview

This milestone fixes suggestion bugs and improves UX density and visual feedback. Bug fixes (deduplication, tab matching) are addressed first to ensure stability, followed by UX polish (URL preview, density, theming). All work targets the existing architecture: deduplication in background data providers, UI changes in overlay.

## Phases

### Phase 1: Bug Fixes

**Goal:** Eliminate duplicate suggestions and ensure open tabs appear correctly in search results.

**Dependencies:** None (foundation phase)

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Fix URL deduplication (fragments, trailing slashes, www prefix)
- [x] 01-02-PLAN.md — Add fuzzy matching for open tab title/URL search

**Requirements:**
- BUG-01: User sees no duplicate suggestions when same URL exists in history and open tabs
- BUG-02: User sees open tabs in suggestions when input matches tab title or URL

**Success Criteria:**
1. User searches for a URL that exists in both history and as an open tab; sees exactly one suggestion (the open tab version)
2. User types partial tab title; the open tab appears in suggestions ranked higher than history entries
3. User types partial URL; the open tab appears in suggestions ranked higher than history entries
4. User closes a tab and searches again; the closed tab no longer appears as "open tab" type

**Research Flags:**
- Deduplication logic in `BaseDataProvider.normalizeUrlForDeduplication()` and `deduplicateResults()`
- Tab filtering in `BackgroundDataProvider.getOpenTabsData()`
- URL normalization edge cases: trailing slashes, fragments, query params

---

### Phase 2: UX Improvements

**Goal:** Improve visual feedback during keyboard navigation and increase information density.

**Dependencies:** Phase 1 (stable data layer needed before UI polish)

**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — URL preview on selection + density improvements (UX-01, UX-02)
- [x] 02-02-PLAN.md — Tab group color theming (UX-03)

**Requirements:**
- UX-01: User sees URL bar update to show selected suggestion URL when navigating with keyboard
- UX-02: User sees denser suggestion list with reduced padding between items
- UX-03: User sees highlight color matching their active tab group color (purple if no group)

**Success Criteria:**
1. User opens spotlight and presses Down arrow; the URL/subtitle area updates to show the selected item's URL
2. User navigates through all suggestions with arrow keys; URL preview updates for each selection
3. User sees at least 6 suggestions visible without scrolling (density improvement)
4. User opens spotlight while in a blue tab group; highlight color is blue
5. User opens spotlight while not in any tab group; highlight color is purple (default)

**Research Flags:**
- SelectionManager callback integration for URL preview
- CSS padding/margin adjustments in overlay styles
- Tab Groups API (`chrome.tabGroups.get()`) for color fetching in background.js

---

## Progress

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1 - Bug Fixes | Complete ✓ | BUG-01, BUG-02 | 2/2 |
| 2 - UX Improvements | Complete ✓ | UX-01, UX-02, UX-03 | 3/3 |

**Overall:** 5/5 requirements complete ✓

---

## Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| BUG-01 | 1 | No duplicate suggestions for same URL |
| BUG-02 | 1 | Open tabs appear when matching title/URL |
| UX-01 | 2 | URL bar updates on keyboard navigation |
| UX-02 | 2 | Denser suggestion list |
| UX-03 | 2 | Tab group color matching |

**Coverage:** 5/5 v1.0 requirements mapped

---

*Roadmap created: 2026-02-03*
