---
phase: quick-003
plan: 01
subsystem: ui
tags: [space-chip, tab-groups, bug-fix]
dependency-graph:
  requires: [08-01, 08-02]
  provides: [correct chip name/color selection based on actual tab group]
  affects: []
tech-stack:
  added: []
  patterns: [group-first chip gating]
key-files:
  created: []
  modified:
    - shared/ui-utilities.js
    - test/unit/space-chip-ui.test.js
decisions:
  - id: "groupName-gate"
    choice: "No tab group = no chip, even if Arcify space exists"
    rationale: "Prevents confusing chip that contradicts the visual tab group state"
  - id: "groupColor-only"
    choice: "Use groupColor only, drop spaceColor fallback"
    rationale: "Chip always derives from the actual Chrome tab group, so spaceColor is irrelevant"
  - id: "match-shows-arcify"
    choice: "When spaceName === groupName, display spaceName (canonical)"
    rationale: "Arcify names are the canonical version; matching confirms the tab is in the expected group"
metrics:
  duration: ~3 minutes
  completed: 2026-02-06
---

# Quick Task 003: Fix Chip Tab Group Mismatch

**One-liner:** Gate space chip on groupName, show actual tab group name/color when it differs from Arcify space

## What Changed

### generateSpaceChipHTML logic (shared/ui-utilities.js)

**Before:** `chipName = spaceName || groupName` -- spaceName took priority, so a tab bookmarked in "Work" space but currently in a "Personal" tab group would incorrectly show "Work".

**After:**
1. Gate on `groupName` -- no tab group means no chip at all (even with Arcify metadata)
2. If `spaceName === groupName`, use spaceName (canonical Arcify name)
3. If they differ (or no spaceName), use actual groupName
4. Color always comes from `groupColor` (not spaceColor fallback)

### Test updates (test/unit/space-chip-ui.test.js)

- Updated 8 existing tests to include `groupName` in metadata (matching the new gate requirement)
- Added 3 new tests:
  - Mismatch scenario: spaceName=Work, groupName=Personal -> shows "Personal" with green color
  - No-group scenario: spaceName=Work, no groupName -> returns empty string
  - Match scenario: spaceName=Work, groupName=Work -> shows "Work"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 pre-existing stale test expectations in formatResult tests**

- **Found during:** Task 1 (npm test revealed failures)
- **Issue:** Three tests in the "formatResult - Arcify action text" describe block had expectations that didn't match the current formatResult implementation. The implementation was updated in a prior commit (e560d14) but the tests weren't updated to match.
- **Fix:**
  - "OPEN_TAB in CURRENT_TAB mode shows Open Pinned Tab when isArcify is true" -> added `groupName: 'Work'` to metadata (formatResult gates on groupName, not isArcify)
  - "PINNED_TAB with isActive true shows Switch to Tab" -> changed expectation to "Open Favorite Tab" (PINNED_TAB always returns "Open Favorite Tab")
  - "PINNED_TAB with isActive false and no isArcify shows Open Pinned Tab" -> changed expectation to "Open Favorite Tab"
- **Files modified:** test/unit/space-chip-ui.test.js
- **Commit:** 54f64bf

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 54f64bf | fix(quick-003): chip shows actual tab group instead of Arcify space on mismatch |

## Verification

- All 297 tests pass (0 failures)
- `if (!groupName) return ''` confirmed in ui-utilities.js
- `spaceName === groupName` comparison confirmed in ui-utilities.js
- All 3 new mismatch scenario tests present and passing
