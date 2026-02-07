---
phase: quick-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/ui-utilities.js
  - test/unit/space-chip-ui.test.js
autonomous: true

must_haves:
  truths:
    - "Tab in a different group than its Arcify space shows the actual group name and color, not the Arcify space"
    - "Tab in the same-named group as its Arcify space shows the Arcify space name and color"
    - "Tab with no tab group at all shows no chip, even if it has Arcify space metadata"
    - "All existing tests pass after updating test expectations to match new logic"
  artifacts:
    - path: "shared/ui-utilities.js"
      provides: "Updated generateSpaceChipHTML() with group-first chip logic"
      contains: "generateSpaceChipHTML"
    - path: "test/unit/space-chip-ui.test.js"
      provides: "Updated tests matching new chip logic"
      contains: "groupName"
  key_links:
    - from: "shared/ui-utilities.js:generateSpaceChipHTML"
      to: "result.metadata.groupName"
      via: "groupName is the gate -- no groupName means no chip"
      pattern: "if.*!groupName.*return"
---

<objective>
Fix the space chip so it respects the tab's actual Chrome tab group instead of blindly showing the Arcify space name. When a bookmarked tab is open in a different tab group than its Arcify space, the chip should show the actual tab group's name and color.

Purpose: Prevent confusing mismatch where chip says "Work" (from Arcify) but tab is visually in the "Personal" group with a blue dot.

Output: Updated `generateSpaceChipHTML()` logic and corrected unit tests.
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@shared/ui-utilities.js
@shared/shared-component-logic.js
@test/unit/space-chip-ui.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update generateSpaceChipHTML logic and fix tests</name>
  <files>shared/ui-utilities.js, test/unit/space-chip-ui.test.js</files>
  <action>
**1. Update `generateSpaceChipHTML()` in `shared/ui-utilities.js` (lines 335-347).**

Replace the current logic:
```javascript
static generateSpaceChipHTML(result) {
    const spaceName = result.metadata?.spaceName;
    const groupName = result.metadata?.groupName;
    const chipName = spaceName || groupName;
    if (!chipName) return '';

    const chipColor = result.metadata?.groupColor || result.metadata?.spaceColor || 'grey';
    ...
}
```

With this corrected logic:
```javascript
static generateSpaceChipHTML(result) {
    const groupName = result.metadata?.groupName;
    const spaceName = result.metadata?.spaceName;

    // No tab group = no chip (even if Arcify space exists)
    if (!groupName) return '';

    // If tab's group matches Arcify space, use Arcify name (canonical).
    // If different or no Arcify space, use actual tab group name.
    const chipName = (spaceName && spaceName === groupName) ? spaceName : groupName;
    const chipColor = result.metadata?.groupColor || 'grey';
    const chipColors = SpotlightUtils.getChipColors(chipColor);
    const truncatedName = chipName.length > 18 ? chipName.substring(0, 18) + '\u2026' : chipName;

    return `<span class="arcify-space-chip" style="background:${chipColors.bg};color:${chipColors.text}" title="${SpotlightUtils.escapeHtml(chipName)}">${SpotlightUtils.escapeHtml(truncatedName)}</span>`;
}
```

Key changes:
- Gate on `groupName` instead of `spaceName || groupName`. No tab group = no chip.
- Use `groupColor` only (drop `spaceColor` fallback) since we always derive from the actual tab group.
- `chipName` uses Arcify spaceName only when it matches groupName (same group). Otherwise shows actual groupName.

**2. Update `test/unit/space-chip-ui.test.js` to match new logic.**

Several existing tests set `spaceName` without `groupName`. Under new logic, those return empty string (no chip). Update them:

a) Test "generates chip HTML for Arcify result with space info" (~line 80): Add `groupName: 'Work'` to metadata so group matches space. This tests the "match" path.

b) Test "returns empty string for result without spaceName in metadata" (~line 98): Keep as-is. No spaceName AND no groupName -> empty string. Still correct.

c) Test "returns empty string for result with null metadata" (~line 109): Keep as-is. Still correct.

d) Test "returns empty string for result with empty metadata" (~line 120): Keep as-is. Still correct.

e) Test "truncates space names longer than 18 characters" (~line 131): Add `groupName` matching the long spaceName. Or change to use groupName only. The truncation test should use `groupName` since that is now the chip's data source for non-matching cases.

f) Test "does not truncate space names 18 characters or shorter" (~line 147): Add `groupName: 'Short Name'` to match spaceName.

g) Test "escapes HTML special characters in space name" (~line 161): Add `groupName` matching spaceName to test escaping on match path.

h) Test "uses spaceColor from metadata for chip styling" (~line 175): This test sets only `spaceName` and `spaceColor` with no `groupName`. Under new logic: no groupName = no chip = empty string. Change this test to verify that when there IS a groupName matching spaceName, the chip uses `groupColor` (not spaceColor). Set `groupName: 'Work'`, `groupColor: 'purple'`, and verify purple colors.

i) Test "falls back to grey when no spaceColor in metadata" (~line 190): Sets only `spaceName: 'Work'` with no `groupName`. Under new logic returns empty. Rewrite: set `groupName: 'Work'` with NO `groupColor`, verify grey fallback.

j) Test "generates chip from groupName when spaceName is absent" (~line 205): Keep as-is. groupName present, no spaceName -> shows groupName. Still correct.

k) Test "prefers groupColor over spaceColor when both present" (~line 219): Add `groupName: 'Work'` to match spaceName. Under new logic, `groupColor` is the ONLY color source, so this test confirms groupColor is used.

l) Test "sets title attribute to full (untruncated) space name" (~line 234): Add `groupName` matching the long spaceName so chip renders.

**3. Add NEW tests for the mismatch scenario:**

Add these new test cases in the `generateSpaceChipHTML` describe block:

```javascript
it('shows actual group name when tab group differs from Arcify space', () => {
    const result = new SearchResult({
        type: ResultType.OPEN_TAB,
        title: 'Test',
        url: 'https://test.com',
        metadata: { spaceName: 'Work', spaceColor: 'blue', groupName: 'Personal', groupColor: 'green' }
    });

    const html = SpotlightUtils.generateSpaceChipHTML(result);
    const greenColors = SpotlightUtils.getChipColors('green');

    expect(html).toContain('Personal');
    expect(html).not.toContain('Work');
    expect(html).toContain(greenColors.bg);
    expect(html).toContain(greenColors.text);
});

it('returns empty string when tab has Arcify space but no tab group', () => {
    const result = new SearchResult({
        type: ResultType.OPEN_TAB,
        title: 'Test',
        url: 'https://test.com',
        metadata: { spaceName: 'Work', spaceColor: 'blue', isArcify: true }
    });

    expect(SpotlightUtils.generateSpaceChipHTML(result)).toBe('');
});

it('shows Arcify space name when group name matches space name', () => {
    const result = new SearchResult({
        type: ResultType.OPEN_TAB,
        title: 'Test',
        url: 'https://test.com',
        metadata: { spaceName: 'Work', spaceColor: 'blue', groupName: 'Work', groupColor: 'blue' }
    });

    const html = SpotlightUtils.generateSpaceChipHTML(result);

    expect(html).toContain('Work');
    expect(html).toContain('arcify-space-chip');
});
```

**Important:** Do NOT change any CSS files, overlay.js, newtab.js, or shared-component-logic.js. The CSS and rendering integration are already correct from 08-02. Only the chip NAME/COLOR selection logic in `generateSpaceChipHTML` needs fixing.
  </action>
  <verify>
1. `npm test` passes -- all updated and new tests pass.
2. Grep `ui-utilities.js` for `if (!groupName) return ''` -- gate on groupName confirmed.
3. Grep `ui-utilities.js` for `spaceName === groupName` -- match comparison confirmed.
4. Grep test file for "shows actual group name when tab group differs" -- mismatch test exists.
5. Grep test file for "returns empty string when tab has Arcify space but no tab group" -- no-group test exists.
  </verify>
  <done>
- generateSpaceChipHTML returns empty string when no groupName (even with Arcify spaceName)
- Shows actual groupName and groupColor when group differs from Arcify space
- Shows spaceName when group matches Arcify space (canonical name)
- All unit tests updated to match new logic, plus 3 new mismatch-scenario tests
- npm test passes with zero failures
  </done>
</task>

</tasks>

<verification>
1. `npm test` passes with no regressions.
2. The mismatch scenario (spaceName=Work, groupName=Personal) shows "Personal" not "Work".
3. The match scenario (spaceName=Work, groupName=Work) shows "Work".
4. No groupName at all returns empty string (no chip rendered).
</verification>

<success_criteria>
- Chip shows actual tab group name/color when group differs from Arcify space
- Chip shows Arcify space name when group matches
- No chip when tab has no group (regardless of Arcify metadata)
- All tests pass
</success_criteria>

<output>
After completion, no summary file needed (quick task).
</output>
