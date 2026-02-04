# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Status:** No formal testing framework configured

**Analysis:**
- No test files found in codebase (`.test.js`, `.spec.js` patterns not present)
- No testing dependencies in `package.json` (neither `arcify` nor `arcify-spotlight`)
- No Jest, Vitest, Mocha, or other test runner configured
- No `.eslintrc`, `.prettierrc`, or testing configuration files in project roots

**Current State:**
- Projects rely on manual testing
- Build and development workflows do not include automated tests
- No CI/CD test pipeline configured

## Build and Development

**Run Commands:**
```bash
npm run dev              # Watch mode development build
npm run build            # Production build
npm run clean            # Remove dist directories
npm run preview          # Preview build (vite only)
```

**Build Configuration:**
- Vite used as build tool (v6.0.0)
- `vite.config.js` and `vite.config.dev.js` for different build modes
- Plugins: `vite-plugin-web-extension`, `vite-plugin-singlefile`
- ES modules with `"type": "module"` in package.json

## Code Organization for Testability

**Observable Testing Patterns in Code:**
While no formal tests exist, code structure suggests testability considerations:

**Modular Architecture:**
- Utilities separated from UI: `utils.js`, `bookmark-utils.js`, `chromeHelper.js`
- Shared logic extracted to common modules: `shared/` directory in arcify-spotlight
- Pure utility functions suitable for unit testing: `getFaviconUrl()`, `getPinnedUrlKey()`, `generateUUID()`

**Chrome API Abstraction:**
- `ChromeHelper` provides wrapped Chrome APIs in `chromeHelper.js`
- Centralized message handling reduces coupling: `handleAsyncMessage()` in `background.js`
- `SpotlightMessageClient` abstracts message passing in `shared/message-client.js`

**State Management:**
- Settings stored centrally via `Utils.getSettings()` in `utils.js`
- Consistent response format from async operations: `{ success: true/false, error: '...' }`
- Logger can be controlled via settings for test isolation

**Separation of Concerns:**
- DOM manipulation isolated in `domManager.js`
- Business logic in `sidebar.js`, `background.js`, `overlay.js`
- UI utilities in `shared/ui-utilities.js`

## Error Handling for Testing

**Error Patterns Observable:**
- Try-catch blocks throughout: `localstorage.js`, `options.js`, `installation-onboarding.js`
- Errors logged with context: `Logger.error('Context:', error)`
- Fallback patterns for graceful degradation:
  ```javascript
  try {
      // operation
  } catch (error) {
      Logger.error('Error during operation:', error);
      return defaultValue;
  }
  ```

**Error Contexts Observed:**
- Bookmark operations: `findArcifyFolder()`, `processBookmarkFolder()`
- Storage operations: `getSettings()`, `saveTabNameOverrides()`
- Message passing: `SpotlightMessageClient.getSuggestions()`, `handleResult()`
- Chrome API calls: `chrome.tabs.create()`, `chrome.storage.sync.get()`

## What Should Be Tested (Recommendations)

**High Priority for Unit Tests:**
- `utils.js` utility functions (pure functions):
  - `generateUUID()` - string format validation
  - `getFaviconUrl()` - URL construction
  - `getPinnedUrlKey()` - URL normalization
  - `getSettings()` - defaults merging

- `bookmark-utils.js` functions:
  - `findArcifyFolder()` - multi-method fallback logic
  - `findBookmarkByUrl()` - URL matching
  - Recursive traversal functions

- `localstorage.js` storage operations:
  - Folder creation/retrieval
  - Duplicate merging logic

- `constants.js` data:
  - CSS class consistency
  - Selector validity

**High Priority for Integration Tests:**
- Message passing between background script and content scripts
- Storage sync and local operations
- Chrome API interactions (tabs, tabGroups, storage, bookmarks)
- Spotlight activation and result handling

**Should Test Error Cases:**
- Missing Arcify folder fallback
- Storage quota exceeded
- Chrome API permission errors
- Invalid bookmark operations
- Message passing timeouts

## Testing Gaps and Risks

**Critical Testing Gaps:**
1. **Chrome API Integration:** No way to verify Chrome API calls work correctly without manual testing
2. **Message Passing:** Background-to-content communication untested (primary failure risk)
3. **Bookmark Operations:** Complex recursive logic could have edge cases
4. **Storage Sync:** Settings merge and cache invalidation untested
5. **DOM Manipulation:** Drag-and-drop, context menus, visual updates untested

**Observable Fragile Areas Without Tests:**
- `_mergeFolderContentsRecursive()` in `localstorage.js` - complex recursive logic
- `handleAsyncMessage()` pattern - async response coordination
- `SelectionManager` keyboard navigation - state transitions
- Spotlight activation in multiple contexts (overlay vs. new tab)

## Mocking Opportunities

**Chrome APIs Requiring Mocks:**
- `chrome.storage.sync` and `chrome.storage.local`
- `chrome.tabs.create()`, `chrome.tabs.query()`, `chrome.tabs.group()`
- `chrome.tabGroups.update()`
- `chrome.bookmarks` API (search, getChildren, create, move, remove, update)
- `chrome.runtime.sendMessage()` and `chrome.runtime.onMessage`
- `chrome.sidePanel` and `chrome.contextMenus`

**Test Fixtures Needed:**
- Mock Chrome storage with defaults
- Mock tab/tab group data structures
- Mock bookmark hierarchies (with edge cases like missing Arcify folder)
- Mock message responses from background script
- Mock Chrome runtime errors

## Suggested Testing Approach

**Short-term (Manual Testing Checklist):**
- [ ] Core functionality: space creation, tab organization, pinning
- [ ] Bookmark integration: import, sync, override
- [ ] Spotlight search: tabs, bookmarks, history
- [ ] Message passing: all background-to-content communication
- [ ] Error cases: invalid bookmarks, storage errors, permission denials
- [ ] Edge cases: duplicate spaces, renamed bookmarks, navigation away from pinned tabs

**Long-term (Automation Framework):**
1. Set up Jest with `jest-webextension-mock` for Chrome API mocking
2. Write unit tests for utilities (target: 80%+ coverage on pure functions)
3. Add integration tests for message passing (using mocked Chrome APIs)
4. Add E2E tests for critical user workflows (using WebDriver or Puppeteer)
5. Set up pre-commit hooks to run tests before commits

---

*Testing analysis: 2026-02-03*
