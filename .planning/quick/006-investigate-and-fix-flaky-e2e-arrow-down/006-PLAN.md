---
phase: quick-006
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - test/e2e/tests/spotlight.e2e.test.js
autonomous: true

must_haves:
  truths:
    - "Arrow down E2E test passes reliably (no intermittent failures)"
    - "Arrow up E2E test passes reliably (same fix applied)"
    - "All other E2E tests continue to pass unchanged"
  artifacts:
    - path: "test/e2e/tests/spotlight.e2e.test.js"
      provides: "Fixed keyboard navigation E2E tests"
  key_links: []
---

<objective>
Fix the flaky E2E test "arrow down moves selection to next result" by eliminating the race condition where async search results re-render the DOM and invalidate captured element references.

Purpose: The test fails intermittently because it captures DOM element references BEFORE the debounced async search completes. When async results arrive (150ms debounce), `updateDisplay()` calls `resultsContainer.innerHTML = html`, replacing all DOM nodes. The test's stale references then read `selected` class from detached nodes. Additionally, `updateResults()` resets `selectedIndex` to 0, undoing the ArrowDown navigation.

Output: Reliable E2E keyboard navigation tests that wait for DOM stability before interacting.
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@test/e2e/tests/spotlight.e2e.test.js
@shared/selection-manager.js
@shared/shared-component-logic.js

Root cause analysis:

1. Test types "google.com" into the input (line 175)
2. `waitForSelector` finds the first result (instant suggestion appears immediately)
3. Test waits 500ms — but the 150ms debounce fires during this wait, AND the async search response can arrive at any time
4. Test captures `results = page.$$('[data-testid="spotlight-result"]')` — element refs are now held
5. Test presses ArrowDown, waits 100ms
6. RACE: If async results arrive between steps 4-6 (or even after step 6), `updateDisplay()` does `resultsContainer.innerHTML = html` which:
   a. Destroys all existing DOM nodes (captured refs become stale/detached)
   b. Calls `selectionManager.updateResults()` which resets `selectedIndex = 0`
7. Test evaluates `classList.contains('selected')` on DETACHED nodes — reads stale state

Fix strategy: Replace static element capture + static delay with `page.waitForFunction()` polling that reads LIVE DOM state. This is immune to re-renders because each poll reads current DOM, not cached references.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix arrow-down and arrow-up tests to use waitForFunction polling</name>
  <files>test/e2e/tests/spotlight.e2e.test.js</files>
  <action>
Fix both the "arrow down moves selection to next result" test (line 165) and the "arrow up moves selection to previous result" test (line 220) using the same approach:

**For the arrow-down test (line 165-218):**

Replace the section after typing "google.com" with this approach:
1. After typing, use `page.waitForFunction()` to wait until at least 2 results exist AND results have been stable (no DOM changes) for at least 300ms. This ensures async search has completed and no more re-renders are pending. The stability check should work by polling: each poll checks the current result count and compares to a previous count stored via `window._arcifyTestResultCount`. If the count hasn't changed for 300ms, results are stable.
2. INSTEAD of the two-step "capture elements then evaluate" pattern, use a SINGLE `page.waitForFunction()` after pressing ArrowDown that checks LIVE DOM: query all `[data-testid="spotlight-result"]` elements inside the function, check that `results[0]` does NOT have class `selected` AND `results[1]` DOES have class `selected`. Give this a timeout of 3000ms with polling interval of 50ms.
3. Remove the stale `const results = await page.$$()` capture and the `results[0].evaluate()` / `results[1].evaluate()` calls entirely.
4. Keep the single-result fallback branch but apply the same live-DOM pattern.

Concrete replacement for the >=2 results branch:
```javascript
// Wait for results to stabilize (async search complete, no more re-renders)
await page.waitForFunction(() => {
  const results = document.querySelectorAll('[data-testid="spotlight-result"]');
  return results.length >= 2;
}, { timeout: 5000 });

// Additional wait for any final async results to settle
await new Promise(resolve => setTimeout(resolve, 500));

// Verify we still have 2+ results after settling
const resultCount = await page.$$eval('[data-testid="spotlight-result"]', els => els.length);

if (resultCount >= 2) {
  // Press arrow down
  await page.keyboard.press('ArrowDown');

  // Wait for selection to update in LIVE DOM (immune to re-renders)
  await page.waitForFunction(() => {
    const results = document.querySelectorAll('[data-testid="spotlight-result"]');
    if (results.length < 2) return false;
    return !results[0].classList.contains('selected') && results[1].classList.contains('selected');
  }, { timeout: 3000, polling: 50 });

  // If waitForFunction resolves, the assertion is inherently satisfied
  // But add explicit assert for clarity
  const selectionState = await page.evaluate(() => {
    const results = document.querySelectorAll('[data-testid="spotlight-result"]');
    return {
      firstSelected: results[0]?.classList.contains('selected'),
      secondSelected: results[1]?.classList.contains('selected')
    };
  });
  assert.ok(!selectionState.firstSelected && selectionState.secondSelected,
    'Arrow down should move selection to second result');
} else {
  // Single result fallback
  await page.keyboard.press('ArrowDown');
  await new Promise(resolve => setTimeout(resolve, 200));
  const isSelected = await page.$eval('[data-testid="spotlight-result"]',
    el => el.classList.contains('selected'));
  assert.ok(isSelected, 'With single result, selection should stay on first');
}
```

**For the arrow-up test (line 220-269):**

Apply the identical pattern:
1. Wait for 2+ results to appear and stabilize using `page.waitForFunction()` + settling delay.
2. Press ArrowDown, then use `page.waitForFunction()` to confirm second item selected (live DOM check).
3. Press ArrowUp, then use `page.waitForFunction()` to confirm first item is selected again (live DOM check).
4. Remove all `results[N].evaluate()` calls on captured element references.

Do NOT change any other tests in the file. The fix is isolated to these two test cases.
  </action>
  <verify>
Run the E2E tests multiple times to verify reliability:
```bash
cd /Users/phulsechinmay/Desktop/Projects/arcify-spotlight
npm run build && npm run test:e2e 2>&1 | tail -30
```
Run at least 3 times to check for flakiness. All E2E tests must pass each time.
  </verify>
  <done>
Both "arrow down moves selection to next result" and "arrow up moves selection to previous result" tests pass reliably across multiple runs. No other test is affected.
  </done>
</task>

</tasks>

<verification>
- Run `npm run test:e2e` at least 3 times in succession
- All 9 E2E tests pass each run
- No new flaky behavior introduced
- Arrow navigation tests specifically pass every time
</verification>

<success_criteria>
- The "arrow down moves selection to next result" test passes reliably (0 failures across 3+ runs)
- The "arrow up moves selection to previous result" test passes reliably (0 failures across 3+ runs)
- All other E2E tests remain passing
- No hardcoded sleeps longer than 500ms added (use polling-based waits instead)
</success_criteria>

<output>
After completion, create `.planning/quick/006-investigate-and-fix-flaky-e2e-arrow-down/006-SUMMARY.md`
</output>
