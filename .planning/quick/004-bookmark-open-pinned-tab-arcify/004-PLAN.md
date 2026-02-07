---
phase: quick
plan: 004
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/ui-utilities.js
  - test/unit/space-chip-ui.test.js
autonomous: true

must_haves:
  truths:
    - "BOOKMARK results with isArcify metadata show 'Open Pinned Tab' action text"
    - "BOOKMARK results without isArcify metadata still show enter arrow"
    - "Existing OPEN_TAB, PINNED_TAB, and other result type action text unchanged"
  artifacts:
    - path: "shared/ui-utilities.js"
      provides: "BOOKMARK formatter with Arcify-aware action text"
      contains: "isArcify"
    - path: "test/unit/space-chip-ui.test.js"
      provides: "Tests for BOOKMARK Arcify action text"
  key_links:
    - from: "shared/ui-utilities.js"
      to: "result.metadata.isArcify"
      via: "BOOKMARK formatter conditional"
      pattern: "BOOKMARK.*isArcify"
---

<objective>
Fix BOOKMARK result type action text to show "Open Pinned Tab" when the bookmark belongs to an Arcify space.

Purpose: Bookmarks in Arcify spaces are semantically "pinned tabs" managed by Arcify. Currently they show the generic enter arrow, which is inconsistent with how OPEN_TAB results in Arcify tab groups show "Open Pinned Tab". Users see Arcify space chips on these bookmarks but the action text doesn't reflect their Arcify nature.

Output: Updated BOOKMARK formatter in ui-utilities.js and corresponding tests.
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@shared/ui-utilities.js
@test/unit/space-chip-ui.test.js
@shared/data-providers/base-data-provider.js (lines 565-601 - enrichWithArcifyInfo)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update BOOKMARK formatter to show "Open Pinned Tab" for Arcify bookmarks</name>
  <files>shared/ui-utilities.js</files>
  <action>
In `shared/ui-utilities.js`, modify the BOOKMARK entry in the `formatters` object inside `formatResult()` (around line 199-203).

Current code:
```js
[ResultType.BOOKMARK]: {
    title: result.title,
    subtitle: result.domain,
    action: '↵'
},
```

Change to:
```js
[ResultType.BOOKMARK]: {
    title: result.title,
    subtitle: result.domain,
    action: result.metadata?.isArcify ? 'Open Pinned Tab' : '↵'
},
```

Rationale: The `enrichWithArcifyInfo()` method in base-data-provider.js (line 591) sets `isArcify = true` on any result whose URL is found in the Arcify bookmark folder cache. BOOKMARK results that have `isArcify` are Arcify-managed bookmarks (i.e., pinned tabs in Arcify's model), so "Open Pinned Tab" is the correct action text. Non-Arcify bookmarks continue to show the enter arrow.

Do NOT modify the OPEN_TAB, PINNED_TAB, HISTORY, or any other result type formatters. Only touch the BOOKMARK entry.
  </action>
  <verify>
Run `npx vitest run test/unit/space-chip-ui.test.js` -- existing tests must still pass (no regressions in OPEN_TAB, PINNED_TAB action text tests).
  </verify>
  <done>BOOKMARK formatter conditionally returns "Open Pinned Tab" when `metadata.isArcify` is truthy, and enter arrow otherwise.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for BOOKMARK Arcify action text</name>
  <files>test/unit/space-chip-ui.test.js</files>
  <action>
In `test/unit/space-chip-ui.test.js`, within the existing `describe('SpotlightUtils.formatResult - Arcify action text', ...)` block (starts around line 294), add these test cases:

1. **BOOKMARK with isArcify shows "Open Pinned Tab":**
```js
it('BOOKMARK with isArcify shows "Open Pinned Tab"', () => {
    const result = new SearchResult({
        type: ResultType.BOOKMARK,
        title: 'GitHub',
        url: 'https://github.com',
        metadata: { bookmarkId: 'b1', isArcify: true, spaceName: 'Work', spaceColor: 'blue' }
    });

    const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
    expect(formatted.action).toBe('Open Pinned Tab');
});
```

2. **BOOKMARK without isArcify shows enter arrow:**
```js
it('BOOKMARK without isArcify shows enter arrow', () => {
    const result = new SearchResult({
        type: ResultType.BOOKMARK,
        title: 'Example',
        url: 'https://example.com',
        metadata: { bookmarkId: 'b2' }
    });

    const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.CURRENT_TAB);
    expect(formatted.action).toBe('\u21b5');
});
```

3. **BOOKMARK with isArcify shows "Open Pinned Tab" in NEW_TAB mode too:**
```js
it('BOOKMARK with isArcify shows "Open Pinned Tab" in NEW_TAB mode', () => {
    const result = new SearchResult({
        type: ResultType.BOOKMARK,
        title: 'GitHub',
        url: 'https://github.com',
        metadata: { bookmarkId: 'b1', isArcify: true, spaceName: 'Work', spaceColor: 'blue' }
    });

    const formatted = SpotlightUtils.formatResult(result, SpotlightTabMode.NEW_TAB);
    expect(formatted.action).toBe('Open Pinned Tab');
});
```

These tests follow the same pattern as the existing OPEN_TAB and PINNED_TAB action text tests in the same describe block.
  </action>
  <verify>
Run `npx vitest run test/unit/space-chip-ui.test.js` -- all tests pass including the 3 new ones. Verify total test count increased by 3.
  </verify>
  <done>Three new tests cover: BOOKMARK+isArcify shows "Open Pinned Tab" in both modes, BOOKMARK without isArcify shows enter arrow.</done>
</task>

</tasks>

<verification>
1. `npx vitest run test/unit/space-chip-ui.test.js` -- all tests pass (0 failures)
2. `npx vitest run` -- full test suite passes (no regressions)
</verification>

<success_criteria>
- BOOKMARK results enriched with `isArcify: true` display "Open Pinned Tab" as action text
- BOOKMARK results without Arcify enrichment display enter arrow (unchanged behavior)
- All existing tests pass with no modifications
- 3 new tests added covering the BOOKMARK action text behavior
</success_criteria>

<output>
After completion, create `.planning/quick/004-bookmark-open-pinned-tab-arcify/004-SUMMARY.md`
</output>
