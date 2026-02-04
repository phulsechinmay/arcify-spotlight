# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- Kebab-case for HTML and CSS files: `installation-onboarding.html`, `styles.css`, `sidebar.html`
- camelCase for JavaScript files: `background.js`, `domManager.js`, `localstorage.js`, `bookmark-utils.js`
- Utility files use descriptive names: `utils.js`, `constants.js`, `logger.js`, `chromeHelper.js`
- Shared modules in subdirectory: `shared/message-client.js`, `shared/selection-manager.js`, `shared/search-engine.js`

**Functions:**
- camelCase for all function names: `getFaviconUrl()`, `processBookmarkFolder()`, `activateSpotlight()`
- Private/helper functions prefixed with underscore: `_mergeFolderContentsRecursive()`
- Descriptive function names that indicate action: `getOrCreateArcifyFolder()`, `findBookmarkByUrl()`, `updateVisualSelection()`
- Async functions clearly named: `initializeSpotlight()`, `handleAsyncMessage()`, `getSuggestions()`

**Variables:**
- camelCase for local and module-level variables: `activeChromeTabId`, `defaultSpaceName`, `isDraggingTab`, `isCreatingSpace`
- Constants in UPPER_SNAKE_CASE: `AUTO_ARCHIVE_ALARM_NAME`, `MAX_ARCHIVED_TABS`, `ARCHIVED_TABS_KEY`, `TAB_ACTIVITY_STORAGE_KEY`
- Boolean variables prefixed with `is` or `show`: `isInitialized`, `isDraggingTab`, `showAllOpenTabsInCollapsedFolders`, `shouldLog()`
- State collections use plural names: `spaces`, `results`, `bookmarks`, `tabs`
- HTML element cache variables match element ID: `spacesList`, `spaceSwitcher`, `addSpaceBtn`, `newTabBtn`

**Types:**
- No TypeScript in use - pure JavaScript
- JSDoc type annotations used in comments for clarity: `@param {Object}`, `@returns {Promise<Object|null>}`
- Object properties use camelCase: `{ tabId, url, title, color, groupId }`

## Code Style

**Formatting:**
- No formatter configured (no `.prettierrc` or `.eslintrc` found)
- 4-space indentation observed throughout codebase
- Line length varies (no strict limit enforced)
- Single quotes used in most JavaScript code
- Template literals used for string interpolation: `` `${variable}` ``

**Linting:**
- No formal linting setup detected
- Code follows consistent patterns organically rather than via linter enforcement

## Import Organization

**Order:**
1. Chrome API imports (implicit - built-in)
2. Relative imports from same directory: `import { Utils } from './utils.js'`
3. Relative imports from subdirectories: `import { SpotlightUtils } from './shared/ui-utilities.js'`
4. Icon/constant imports: `import { FOLDER_CLOSED_ICON } from './icons.js'`
5. Utility/helper imports: `import { Logger } from './logger.js'`

**Path Aliases:**
- No path aliases configured
- All imports use relative paths: `./`, `../`, or relative with directory names

**Module System:**
- ES6 modules: `import` and `export` statements
- `type: "module"` set in package.json
- Named exports preferred: `export { Logger }`, `export class SelectionManager`, `export const BookmarkUtils`
- Mixed export styles: named exports and default-like patterns (e.g., `const Logger = { ... }; export { Logger }`)

## Error Handling

**Patterns:**
- Try-catch blocks wrap async operations and API calls
- Errors logged via `Logger.error()` which respects debug flag
- Common pattern for fallback behavior:
  ```javascript
  try {
      const result = await someAsyncOperation();
  } catch (error) {
      Logger.error('Context:', error);
      // Fallback or default return
      return defaultValue;
  }
  ```
- Promise-based error handling: `.catch(error => Logger.error(error))`
- Chrome runtime errors checked explicitly: `if (chrome.runtime.lastError) { reject(...) }`
- Error messages include context prefix: `'[Background] Error ...'`, `'[SpotlightMessageClient] ...'`, `'[BookmarkUtils] ...'`

**Async Message Pattern:**
- Centralized async message handler in background.js: `handleAsyncMessage(handler, sendResponse, errorContext, defaultErrorData)`
- Returns `true` to indicate async response will be sent

## Logging

**Framework:** Console-based with custom `Logger` module

**Patterns:**
- Debug logging controlled by `debugLoggingEnabled` setting in `chrome.storage.sync`
- Logger caches debug setting to avoid storage reads on every call
- All logging methods check cached value: `Logger.log()`, `Logger.error()`, `Logger.warn()`, `Logger.info()`, `Logger.debug()`
- Context-prefixed log messages: `Logger.log("Context message", variable)`
- Error logs include full error object for debugging: `Logger.error('Error message:', error)`

**Initialization:**
- Logger auto-initializes if chrome.storage available
- Can be explicitly initialized: `Logger.initialize()`
- Listens for storage changes to update debug flag dynamically

## Comments

**When to Comment:**
- JSDoc-style header comments for each JavaScript file explaining purpose, key functions, and critical notes
- Inline comments for complex logic, especially around Chrome API usage
- Comments explaining "why" rather than "what": "// Fallback: search by pinned URL (not tab.url!) and only update title."
- Comments for non-obvious workarounds: "// intentionally ignore query params + hash to avoid treating benign changes..."

**JSDoc/TSDoc:**
- File headers use block comment style with purpose, key functions, and critical notes:
  ```javascript
  /**
   * Background Service Worker - Core extension orchestrator
   *
   * Purpose: Manages extension lifecycle, message passing, and system integrations
   * Key Functions: Auto-archive system, tab activity tracking, Chrome API access
   * Architecture: Service worker that handles all Chrome API calls
   */
  ```
- Function parameters and return types documented in comments when clarity needed
- Storage key documentation: `// Key to store timestamps`

## Function Design

**Size:**
- Small, focused functions (most functions 15-40 lines)
- Complex operations broken into helper functions
- Longest functions typically handle message routing or DOM manipulation

**Parameters:**
- Minimal parameters, typically 1-3 parameters per function
- Complex data passed as single object: `{ tabId, url, title }`
- Optional parameters documented in comments

**Return Values:**
- Async functions return Promises
- Utility functions return data directly or null on failure
- Storage operations return Promise with result object: `{ success: true, ...result }` or `{ success: false, error: '...' }`
- Message handlers use consistent response format: `{ success: true/false, error: '...' }`

## Module Design

**Exports:**
- Modules export either:
  1. Object with methods: `const Utils = { method1: ..., method2: ... }; export { Utils };`
  2. Classes: `export class SelectionManager { ... }`
  3. Named constants: `export const CSS_CLASSES = { ... }`
- No default exports observed
- All exports explicit and named

**Barrel Files:**
- Not extensively used; each module exports directly
- Some shared utilities grouped in `shared/` directory for spotlight components
- Constants centralized in `constants.js` for state classes, selectors, timing values

**Patterns in Singleton Objects:**
- Utility modules use object pattern with static methods: `Logger = { log: ..., error: ..., warn: ... }`
- Classes used for stateful components: `SelectionManager`, `SpotlightMessageClient` (though message client uses static methods)

## Special Patterns

**Chrome API Abstraction:**
- `ChromeHelper` wraps callback-based Chrome APIs in Promises
- Example: `createNewTab()` returns Promise-wrapped chrome.tabs.create()
- Message passing uses consistent pattern with action field: `{ action: 'actionName', data: ... }`

**Storage Pattern:**
- Dual storage: `chrome.storage.sync` for settings, `chrome.storage.local` for data
- Settings have defaults: `getSettings()` returns object with all defaults
- Cache pattern: Logger caches debug setting to avoid repeated storage reads

**DOM Element Caching:**
- Frequently accessed elements cached as module-level variables: `const spacesList = document.getElementById('...)`
- Template elements cached for cloning: `const spaceTemplate = document.getElementById('spaceTemplate')`

---

*Convention analysis: 2026-02-03*
