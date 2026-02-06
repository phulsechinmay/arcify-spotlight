---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - test/e2e/tests/spotlight.e2e.test.js
autonomous: true

must_haves:
  truths:
    - "A tab in a Chrome tab group shows a space chip with the group name in Spotlight results"
    - "The space chip has the correct tab group color applied as inline styles"
    - "A non-grouped tab does NOT show a space chip"
  artifacts:
    - path: "test/e2e/tests/spotlight.e2e.test.js"
      provides: "E2E test for tab group space chip display"
      contains: "arcify-space-chip"
  key_links:
    - from: "test/e2e/tests/spotlight.e2e.test.js"
      to: "chrome.tabs.group / chrome.tabGroups.update"
      via: "Service worker evaluate to create tab group"
      pattern: "tabs\\.group|tabGroups\\.update"
---

<objective>
Add an E2E test that verifies the space chip (tab group name badge) appears on Spotlight suggestions for tabs that belong to a Chrome tab group.

Purpose: Validates the full pipeline from Chrome tab group detection through to visible chip rendering -- the key user-facing feature of Phase 8.

Output: One new E2E test in the existing test file that creates a tab group, triggers Spotlight from a non-grouped tab, and asserts the chip is visible with correct content/color.
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@test/e2e/tests/spotlight.e2e.test.js
@test/e2e/setup.js
@shared/shared-component-logic.js (lines 50-83: generateResultsHTML with chip rendering)
@shared/ui-utilities.js (lines 337-349: generateSpaceChipHTML)
@shared/data-providers/background-data-provider.js (lines 20-53: tab group enrichment)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add E2E test for tab group space chip display</name>
  <files>test/e2e/tests/spotlight.e2e.test.js</files>
  <action>
Add a new `describe` block at the end of the existing `Spotlight E2E Tests` suite (before the closing `});`):

```javascript
describe('E2E-05: Tab Group Space Chip', () => {
  it('shows space chip with group name for a grouped tab suggestion', async () => {
    const ext = await waitForExtension(browser);
    const worker = ext.worker;

    // 1. Open a target page that will be put into a tab group
    const targetPage = await browser.newPage();
    await targetPage.goto('https://example.com', {
      waitUntil: 'domcontentloaded'
    });
    await wait();

    // 2. Create a tab group via the service worker using Chrome APIs
    //    Put the example.com tab into a group named "Research" with color "blue"
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const exampleTab = tabs.find(t => t.url && t.url.includes('example.com'));
      if (!exampleTab) throw new Error('Could not find example.com tab');

      const groupId = await chrome.tabs.group({ tabIds: [exampleTab.id] });
      await chrome.tabGroups.update(groupId, {
        title: 'Research',
        color: 'blue'
      });
    });
    await wait();

    // 3. Open Spotlight from the new tab page (a non-grouped tab)
    const spotlightPage = await openNewTabPage(browser, extensionId);
    await wait();

    await spotlightPage.waitForSelector('[data-testid="spotlight-input"]', {
      timeout: 5000
    });
    await wait();

    // 4. Search for the grouped tab by its URL
    await spotlightPage.type('[data-testid="spotlight-input"]', 'example.com');

    // Wait for results to appear
    await spotlightPage.waitForSelector('[data-testid="spotlight-result"]', {
      timeout: 5000
    });

    // Give extra time for async results (tab results come from background)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Find the result that matches example.com and verify chip
    const chipData = await spotlightPage.evaluate(() => {
      const results = document.querySelectorAll('[data-testid="spotlight-result"]');
      for (const result of results) {
        const chip = result.querySelector('.arcify-space-chip');
        if (chip) {
          return {
            found: true,
            text: chip.textContent.trim(),
            title: chip.getAttribute('title'),
            bgStyle: chip.style.background,
            colorStyle: chip.style.color
          };
        }
      }
      return { found: false };
    });

    assert.ok(
      chipData.found,
      'A space chip should be visible on the grouped tab suggestion'
    );

    assert.strictEqual(
      chipData.text,
      'Research',
      'Chip text should show the tab group name "Research"'
    );

    assert.strictEqual(
      chipData.title,
      'Research',
      'Chip title attribute should show full group name'
    );

    // Verify blue color is applied (the chip uses blue color mapping)
    assert.ok(
      chipData.colorStyle.includes('139') && chipData.colorStyle.includes('179') && chipData.colorStyle.includes('243'),
      `Chip text color should be blue (rgb(139, 179, 243)), got: ${chipData.colorStyle}`
    );

    assert.ok(
      chipData.bgStyle.includes('139') && chipData.bgStyle.includes('179') && chipData.bgStyle.includes('243'),
      `Chip background should use blue tint, got: ${chipData.bgStyle}`
    );

    await targetPage.close();
    await spotlightPage.close();
  });

  it('does NOT show space chip for a non-grouped tab suggestion', async () => {
    // Open a non-grouped tab
    const targetPage = await browser.newPage();
    await targetPage.goto('https://example.com', {
      waitUntil: 'domcontentloaded'
    });
    await wait();

    // Open Spotlight from the new tab page
    const spotlightPage = await openNewTabPage(browser, extensionId);
    await wait();

    await spotlightPage.waitForSelector('[data-testid="spotlight-input"]', {
      timeout: 5000
    });
    await wait();

    // Search for the non-grouped tab
    await spotlightPage.type('[data-testid="spotlight-input"]', 'example.com');

    await spotlightPage.waitForSelector('[data-testid="spotlight-result"]', {
      timeout: 5000
    });

    // Give time for async results
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify NO chip is present on results for this non-grouped tab
    const hasChip = await spotlightPage.evaluate(() => {
      const results = document.querySelectorAll('[data-testid="spotlight-result"]');
      for (const result of results) {
        if (result.querySelector('.arcify-space-chip')) {
          return true;
        }
      }
      return false;
    });

    assert.ok(
      !hasChip,
      'Non-grouped tab suggestions should NOT have a space chip'
    );

    await targetPage.close();
    await spotlightPage.close();
  });
});
```

Key implementation details:
- Uses `worker.evaluate()` to call `chrome.tabs.group()` and `chrome.tabGroups.update()` via the service worker, since these APIs are only available in the extension context.
- First test creates a tab group named "Research" with color "blue", then verifies the chip appears with correct text and blue color values (rgb(139, 179, 243) from the `getChipColors` mapping in ui-utilities.js).
- Second test opens a plain (non-grouped) tab and verifies NO chip appears, confirming the graceful degradation path.
- Both tests follow the existing pattern: open target page, open spotlight on new tab page, type query, assert on results.
- The `500ms` wait after results appear ensures the async tab search results (which come from the background data provider's `chrome.tabGroups.query()`) have arrived.
  </action>
  <verify>
1. `npm run build && node --test test/e2e/**/*.e2e.test.js` -- all tests pass including the two new ones.
2. Run with `DEBUG=true npm run test:e2e` to visually confirm the chip is visible in the browser during the test.
3. Grep test file for `arcify-space-chip` -- class name referenced in assertions.
4. Grep test file for `E2E-05` -- new describe block exists.
  </verify>
  <done>
- Two new E2E tests added to spotlight.e2e.test.js under "E2E-05: Tab Group Space Chip"
- First test: Creates a tab group via Chrome APIs, searches for the grouped tab in Spotlight, verifies space chip appears with correct group name ("Research") and correct blue color styling
- Second test: Opens a non-grouped tab, searches for it in Spotlight, verifies NO space chip is present
- All existing E2E tests continue to pass
  </done>
</task>

</tasks>

<verification>
1. `npm run test:e2e` passes with 11 total tests (9 existing + 2 new).
2. The grouped-tab test verifies the full pipeline: Chrome tab group API -> background-data-provider enrichment -> generateSpaceChipHTML rendering -> visible chip in DOM.
3. The non-grouped-tab test confirms chips only appear when group data exists.
</verification>

<success_criteria>
- Two new E2E tests pass: grouped tab shows chip, non-grouped tab does not
- Chip text matches the tab group name ("Research")
- Chip color matches the blue color mapping from getChipColors()
- All 9 existing E2E tests continue to pass
- No modifications to source code -- tests only
</success_criteria>

<output>
After completion, create `.planning/quick/002-e2e-tab-group-space-chip/002-SUMMARY.md`
</output>
