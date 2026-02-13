---
phase: quick-007
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - test/mocks/chrome.js
autonomous: true
must_haves:
  truths:
    - "All 35 currently failing integration tests pass"
    - "All 456 currently passing tests continue to pass"
    - "npm run test exits with 0 failures"
  artifacts:
    - path: "test/mocks/chrome.js"
      provides: "Complete Chrome API mock including runtime.onInstalled"
      contains: "onInstalled"
  key_links:
    - from: "test/mocks/chrome.js"
      to: "background.js"
      via: "globalThis.chrome mock provides runtime.onInstalled used at background.js:485"
      pattern: "onInstalled.*addListener"
---

<objective>
Fix 35 failing integration tests in activation-flow.test.js (12 tests) and message-passing.test.js (23 tests).

Purpose: Both test files fail with the identical error: `TypeError: Cannot read properties of undefined (reading 'addListener')` at background.js:485 -- `chrome.runtime.onInstalled.addListener(...)`. The chrome mock in test/mocks/chrome.js is missing the `runtime.onInstalled` event mock. When tests do `await import('../../background.js')`, the module-level code at line 485 crashes because `chrome.runtime.onInstalled` is undefined.

Output: All 491 tests passing (0 failures).
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@test/mocks/chrome.js
@test/integration/activation-flow.test.js
@test/integration/message-passing.test.js
@test/integration/setup.js
@background.js (lines 485-489 -- the crash site)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add missing chrome.runtime.onInstalled mock to chrome mock scaffolding</name>
  <files>test/mocks/chrome.js</files>
  <action>
Add `onInstalled` to the `runtime` section of `chromeMock` in test/mocks/chrome.js, following the exact same pattern used for other event mocks (e.g., `tabs.onActivated`, `bookmarks.onCreated`):

```js
onInstalled: {
  addListener: vi.fn(),
  removeListener: vi.fn()
}
```

Place it in the `runtime` object alongside the existing `onMessage` and other runtime properties.

Also add the corresponding `mockClear()` calls in the `resetChromeMocks()` function:

```js
chromeMock.runtime.onInstalled.addListener.mockClear();
chromeMock.runtime.onInstalled.removeListener.mockClear();
```

This is the ONLY change needed. The root cause is straightforward: background.js line 485 calls `chrome.runtime.onInstalled.addListener(...)` at module load time, and the mock does not define `runtime.onInstalled`, so it is `undefined`, causing the TypeError on `.addListener`.

Do NOT modify background.js, the test files, or any other mock properties -- only add the missing `onInstalled` mock.
  </action>
  <verify>
Run `npm run test` and confirm:
- 0 test failures
- 491 tests passing (456 previously passing + 35 previously failing)
- Both test/integration/activation-flow.test.js and test/integration/message-passing.test.js show all green
  </verify>
  <done>All 491 tests pass. The 35 integration test failures are resolved by the single missing mock property.</done>
</task>

</tasks>

<verification>
Run full test suite: `npm run test`
- Expected: 0 failed, 491 passed, 19 test files all green
- No regressions in any unit or integration test
</verification>

<success_criteria>
- `npm run test` exits cleanly with 0 failures
- All 35 previously-failing tests now pass
- All 456 previously-passing tests still pass
</success_criteria>

<output>
After completion, confirm test results in terminal output.
</output>
