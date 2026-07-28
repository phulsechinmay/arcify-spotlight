---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/ui-utilities.js
  - vite-plugins/vite-plugin-spotlight-extension.js
  - vitest.config.js
autonomous: true
must_haves:
  truths:
    - "Production builds (npm run build, npm run build:zip) always have DEBUG_ENABLED=false"
    - "Dev builds (npm run dev) always have DEBUG_ENABLED=true"
    - "All 696 existing tests still pass"
    - "No manual editing of DEBUG_ENABLED is ever needed again"
  artifacts:
    - path: "shared/ui-utilities.js"
      provides: "formatDebugInfo using build-time __DEBUG_ENABLED__ global"
      contains: "__DEBUG_ENABLED__"
    - path: "vite-plugins/vite-plugin-spotlight-extension.js"
      provides: "define config injecting __DEBUG_ENABLED__ into all sub-builds"
      contains: "__DEBUG_ENABLED__"
    - path: "vitest.config.js"
      provides: "define config so tests can resolve __DEBUG_ENABLED__"
      contains: "__DEBUG_ENABLED__"
  key_links:
    - from: "shared/ui-utilities.js"
      to: "vite-plugins/vite-plugin-spotlight-extension.js"
      via: "Vite define replaces __DEBUG_ENABLED__ at build time"
      pattern: "__DEBUG_ENABLED__.*isDev"
---

<objective>
Automate DEBUG_ENABLED via Vite's `define` so it is impossible to accidentally ship a prod build with debug info visible.

Purpose: Prevent the bug where a prod release shipped with DEBUG_ENABLED=true, showing debug score/type info in the UI. By tying the flag to the build mode, dev builds automatically show debug info and prod builds automatically hide it -- no manual toggling needed.

Output: Modified shared/ui-utilities.js, vite plugin config, and vitest config.
</objective>

<execution_context>
@/Users/phulsechinmay/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phulsechinmay/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@shared/ui-utilities.js (line 303-317: formatDebugInfo with hardcoded DEBUG_ENABLED)
@vite-plugins/vite-plugin-spotlight-extension.js (build plugin with isDev flag, sub-builds for overlay/newtab/onboarding)
@vite.config.js (prod config: isDev=false)
@vite.config.dev.js (dev config: isDev=true)
@vitest.config.js (test config, needs define for __DEBUG_ENABLED__)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add __DEBUG_ENABLED__ define to all Vite sub-builds and vitest</name>
  <files>vite-plugins/vite-plugin-spotlight-extension.js, vitest.config.js</files>
  <action>
In `vite-plugins/vite-plugin-spotlight-extension.js`:

1. In the `createSpotlightConfig` function (line ~227), add a top-level `define` property to the returned config object:
   ```js
   define: {
     '__DEBUG_ENABLED__': JSON.stringify(isDev)
   }
   ```
   This covers the main build (background.js).

2. In the overlay sub-build (the `spotlight-extension-overlay` plugin, line ~86), add `define` to the build config:
   ```js
   define: {
     '__DEBUG_ENABLED__': JSON.stringify(isDev)
   }
   ```
   Place it at the same level as `target`, `minify`, `sourcemap` inside the `build()` call options.

3. In the newtab sub-build (the `spotlight-extension-newtab` plugin, line ~128), add the same `define`:
   ```js
   define: {
     '__DEBUG_ENABLED__': JSON.stringify(isDev)
   }
   ```

4. In the onboarding sub-build (line ~208), the `define` block already exists with `__IS_DEV__`. Add `__DEBUG_ENABLED__` alongside it:
   ```js
   define: {
     '__IS_DEV__': isDev,
     '__DEBUG_ENABLED__': JSON.stringify(isDev)
   }
   ```

In `vitest.config.js`:

5. Add a top-level `define` property so tests can resolve the global:
   ```js
   export default defineConfig({
     define: {
       '__DEBUG_ENABLED__': JSON.stringify(false)
     },
     test: { ... }
   });
   ```
   Using `false` for tests because debug info rendering is irrelevant to test behavior and existing test mocks return '' for formatDebugInfo anyway.

IMPORTANT: Use `JSON.stringify(isDev)` (not just `isDev`) so the replacement is the literal `true` or `false`, not a variable reference. Vite's `define` does direct text replacement.
  </action>
  <verify>
Run `npm run build` -- should succeed with no errors.
Run `npm run dev` -- should start watching with no errors (Ctrl+C after confirming).
Run `npm test` -- all 696 tests must pass.
  </verify>
  <done>All Vite sub-builds and vitest config inject __DEBUG_ENABLED__ as a build-time constant.</done>
</task>

<task type="auto">
  <name>Task 2: Replace hardcoded DEBUG_ENABLED with build-time __DEBUG_ENABLED__ global</name>
  <files>shared/ui-utilities.js</files>
  <action>
In `shared/ui-utilities.js`, in the `formatDebugInfo` static method (line ~304-317):

Replace:
```js
const DEBUG_ENABLED = false;
```

With:
```js
const DEBUG_ENABLED = __DEBUG_ENABLED__;
```

Update the comment on the line above (line ~305) to clarify the mechanism:
```js
// Debug mode controlled by build: true for dev builds, false for prod builds
const DEBUG_ENABLED = __DEBUG_ENABLED__;
```

That is the ONLY change needed in this file. The rest of the method stays identical.

Do NOT add any `/* global __DEBUG_ENABLED__ */` comment -- Vite's define performs text replacement before any linting, and this project does not use ESLint.
  </action>
  <verify>
1. Run `npm run build` and then check the prod output to confirm DEBUG_ENABLED is false:
   `grep -n "DEBUG_ENABLED\|formatDebugInfo" dist/overlay.js | head -5`
   In minified prod output, the debug branch should be dead-code eliminated or the constant should be `false`.

2. Run `npm test` -- all 696 tests must still pass.

3. Verify the raw source file has `__DEBUG_ENABLED__` (not hardcoded true/false):
   `grep "DEBUG_ENABLED" shared/ui-utilities.js`
  </verify>
  <done>
- `shared/ui-utilities.js` uses `__DEBUG_ENABLED__` instead of hardcoded boolean
- Prod build (`npm run build`) produces output where debug info is disabled (DEBUG_ENABLED=false or dead-code eliminated)
- Dev build config (`vite.config.dev.js`) would produce output where debug info is enabled (DEBUG_ENABLED=true)
- All 696 tests pass unchanged
  </done>
</task>

</tasks>

<verification>
1. `npm test` -- all 696 tests pass (no regressions)
2. `npm run build` -- prod build succeeds, inspect `dist/overlay.js` to confirm debug code is eliminated or disabled
3. Source file `shared/ui-utilities.js` contains `__DEBUG_ENABLED__`, NOT a hardcoded `true`/`false`
4. All 5 build entry points (main, overlay, newtab, onboarding + vitest) define `__DEBUG_ENABLED__`
</verification>

<success_criteria>
- Production builds ALWAYS have DEBUG_ENABLED=false (impossible to accidentally ship debug UI)
- Dev builds ALWAYS have DEBUG_ENABLED=true (debug info visible during development)
- Zero manual steps required -- the build mode determines the flag automatically
- All 696 existing tests pass without modification
</success_criteria>

<output>
After completion, create `.planning/quick/8-automate-debug-enabled-via-build-mode-so/8-SUMMARY.md`
</output>
