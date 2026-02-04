# State: Arcify Spotlight

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome
**Current focus:** Milestone v1.0 Polish

## Current Position

```
Phase: 1 - Bug Fixes
Plan: Not started
Status: Ready for planning
Progress: [..........] 0%
```

Last activity: 2026-02-03 - Roadmap created

## Phase Summary

| Phase | Goal | Status |
|-------|------|--------|
| 1 - Bug Fixes | Eliminate duplicates, fix tab matching | Ready |
| 2 - UX Improvements | URL preview, density, theming | Blocked by Phase 1 |

## Accumulated Context

### Key Decisions
- Two-phase approach: bugs first, UX second
- Deduplication logic stays in background data provider layer
- UI/theming changes in overlay only
- Arcify bookmark detection deferred to v1.5

### Implementation Notes
- `BaseDataProvider.normalizeUrlForDeduplication()` needs enhancement for URL normalization
- `BackgroundDataProvider.getOpenTabsData()` handles tab filtering
- `SelectionManager` needs callback for selection changes (UX-01)
- Tab Groups API (`chrome.tabGroups.get()`) for color (UX-03)

### Blockers
(none)

### Open Questions
(none)

### Technical Debt Noted
- Large monolithic components (sidebar.js is 3986 lines)
- Some race conditions in message handlers
- No automated tests

---

*Last updated: 2026-02-03 - Roadmap created*
