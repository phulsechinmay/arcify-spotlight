---
phase: quick-8
plan: 01
subsystem: build
tags: [vite, define, debug, build-time-constants]

# Dependency graph
requires: []
provides:
  - Build-time __DEBUG_ENABLED__ constant injected via Vite define
  - Automatic debug/prod flag based on isDev build mode
affects: [shared/ui-utilities.js, vite-plugin-spotlight-extension, vitest.config]

# Tech tracking
tech-stack:
  added: []
  patterns: [Vite define for build-time constants, dead-code elimination via constant folding]

key-files:
  created: []
  modified:
    - shared/ui-utilities.js
    - vite-plugins/vite-plugin-spotlight-extension.js
    - vitest.config.js

key-decisions:
  - "Use JSON.stringify(isDev) for Vite define to produce literal true/false replacement"
  - "Set __DEBUG_ENABLED__ to false in vitest.config.js since tests mock formatDebugInfo anyway"

patterns-established:
  - "Build-time constants via Vite define: use JSON.stringify() for boolean globals"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Quick Task 8: Automate DEBUG_ENABLED via Build Mode Summary

**Build-time __DEBUG_ENABLED__ constant via Vite define across all 5 entry points, eliminating manual debug flag toggling**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T00:04:36Z
- **Completed:** 2026-02-16T00:06:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Eliminated risk of shipping prod builds with debug info visible (the original bug)
- All 5 build entry points (main, overlay, newtab, onboarding, vitest) define __DEBUG_ENABLED__
- Prod build dead-code eliminates entire debug branch (formatDebugInfo compiles to `return ""`)
- Dev builds automatically show debug info (score, type, fuzzy match) without any manual toggling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add __DEBUG_ENABLED__ define to all Vite sub-builds and vitest** - `063c5c0` (feat)
2. **Task 2: Replace hardcoded DEBUG_ENABLED with build-time __DEBUG_ENABLED__ global** - `cfbef51` (feat)

## Files Created/Modified
- `vite-plugins/vite-plugin-spotlight-extension.js` - Added `define: { '__DEBUG_ENABLED__': JSON.stringify(isDev) }` to createSpotlightConfig and all 3 sub-builds (overlay, newtab, onboarding)
- `vitest.config.js` - Added `define: { '__DEBUG_ENABLED__': JSON.stringify(false) }` so tests resolve the global
- `shared/ui-utilities.js` - Replaced `const DEBUG_ENABLED = false` with `const DEBUG_ENABLED = __DEBUG_ENABLED__`

## Decisions Made
- Used `JSON.stringify(isDev)` (not bare `isDev`) because Vite define does direct text replacement and needs literal `true`/`false`
- Set `__DEBUG_ENABLED__` to `false` in vitest.config.js because existing tests already mock `formatDebugInfo` to return `''`, so the flag value is irrelevant to test behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Verification Results
- `npm run build` succeeds -- prod output dead-code eliminates debug branch (`formatDebugInfo` compiles to `return ""`)
- `npm test` -- all 696 tests pass (no regressions)
- Source file contains `__DEBUG_ENABLED__` (not hardcoded boolean)
- All 5 entry points (main config + overlay + newtab + onboarding + vitest) define the constant

## Self-Check: PASSED

- All 4 files verified present on disk
- Both commits (063c5c0, cfbef51) verified in git log

---
*Quick Task: 8-automate-debug-enabled-via-build-mode-so*
*Completed: 2026-02-15*
