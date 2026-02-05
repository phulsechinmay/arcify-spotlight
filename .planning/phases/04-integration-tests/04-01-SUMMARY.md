---
phase: 4
plan: 1
subsystem: testing-infrastructure
tags: [vitest, chrome-mock, integration-tests]

dependency-graph:
  requires: [phase-3-chrome-api-mocks]
  provides: [callListeners-mock, integration-test-setup]
  affects: [04-02-search-flow-tests, 04-03-cache-invalidation-tests]

tech-stack:
  added: []
  patterns: [message-listener-simulation, module-reset-pattern]

key-files:
  created:
    - test/integration/setup.js
  modified:
    - test/mocks/chrome.js

decisions: []

metrics:
  duration: "~2 minutes"
  completed: 2026-02-05
---

# Phase 4 Plan 1: Integration Test Setup Summary

**One-liner:** Extended chrome mock with callListeners() for message simulation and created integration test setup with real timers.

## What Was Built

### 1. Chrome Mock Message Listener Infrastructure

Extended `test/mocks/chrome.js` to support runtime message listener simulation:

- **Private listener storage:** `runtimeMessageListeners` array tracks registered callbacks
- **addListener implementation:** Pushes callbacks to storage array
- **removeListener implementation:** Removes callbacks from storage array
- **hasListener/hasListeners:** Query methods for listener state
- **callListeners(message, sender, sendResponse):** Dispatches message to all registered listeners, returns `{ asyncResponse, sendResponse }`
- **clearListeners():** Resets listener storage for test isolation
- **resetChromeMocks() updated:** Clears listeners and new mock methods

### 2. Integration Test Setup File

Created `test/integration/setup.js`:

- **Real timers:** Explicitly does NOT call `vi.useFakeTimers()` (integration tests need realistic timing)
- **Chrome mock global:** Sets `globalThis.chrome = chromeMock`
- **beforeEach:** Resets chrome mocks AND module cache (`vi.resetModules()`)
- **afterEach:** Clears message listeners for isolation

## Technical Decisions

None - followed plan exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

All 197 existing unit tests pass (no regressions).

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 70b8415 | feat | Extend chrome mock with callListeners support |
| 7dda89a | feat | Create integration test setup file |

## Files Changed

- `test/mocks/chrome.js` - Added listener storage, extended onMessage mock, updated reset function
- `test/integration/setup.js` - New file with real timers and module reset

## Next Phase Readiness

**Ready for 04-02:** Search flow integration tests can now:
- Register message listeners via `chrome.runtime.onMessage.addListener()`
- Simulate background script receiving messages via `callListeners()`
- Reset module state between tests for fresh SearchEngine instances
- Use real timers for realistic debounce/cache behavior
