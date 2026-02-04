# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Chrome Extension with Manifest V3 using event-driven message passing and modular layer separation

**Key Characteristics:**
- Service Worker-based background orchestration (Chrome Extension pattern)
- Side panel UI synced with Chrome Tab Groups API
- Modular utility-based architecture with clear separation of concerns
- Asynchronous message passing between service worker and content scripts
- Persistent state managed via Chrome Storage APIs (sync and local)
- Bookmark-based persistence layer for space metadata

## Layers

**Background Service Worker (Orchestration):**
- Purpose: Core extension lifecycle management, Chrome API access, message routing, auto-archive coordination
- Location: `background.js`
- Contains: Extension lifecycle hooks, alarm management, message listeners, tab activity tracking
- Depends on: Utils, Logger, ChromeHelper
- Used by: Sidebar (content script), Options page, Command handlers

**UI Layer - Sidebar (Content Panel):**
- Purpose: Primary user interface for tab/space management, real-time tab syncing, drag-and-drop interactions
- Location: `sidebar.js`, `sidebar.html`
- Contains: Space lifecycle, tab organization logic, event handlers for user interactions, DOM state management
- Depends on: DOMManager, ChromeHelper, Utils, LocalStorage, BookmarkUtils, Logger, Constants
- Used by: User direct interaction, background service worker (message-based)

**DOM Management Layer:**
- Purpose: Separate DOM manipulation logic from business logic to reduce coupling
- Location: `domManager.js`
- Contains: DOM creation/updates, UI component rendering, context menus, modal dialogs, drag-and-drop visual feedback
- Depends on: Utils, Logger
- Used by: Sidebar

**Settings & Options Layer:**
- Purpose: Extension preferences UI and cross-device settings synchronization
- Location: `options.js`, `options.html`
- Contains: Setting forms, color overrides, auto-archive configuration, user preference management
- Depends on: Utils, LocalStorage, Logger
- Used by: Background (reads settings), Sidebar (reads/listens to settings)

**Onboarding Layer:**
- Purpose: First-run experience and update notifications
- Location: `installation-onboarding.js`, `installation-onboarding.html`, `onboarding.js`, `onboarding.html`
- Contains: Step-based UI flow, keyboard shortcut setup, feature discovery
- Depends on: Logger
- Used by: Background (trigged on install/update)

**Storage & Persistence Layer:**
- Purpose: Unified data access abstraction for Chrome Storage and Bookmark APIs
- Location: `utils.js`, `localstorage.js`, `bookmark-utils.js`
- Contains: Settings CRUD, archived tabs management, space bookmark operations, tab metadata overrides
- Depends on: Logger
- Used by: All other layers

**Utilities Layer:**
- Purpose: Shared helper functions and constants
- Location: `utils.js`, `chromeHelper.js`, `constants.js`, `logger.js`, `icons.js`
- Contains: Common operations, Chrome API wrappers, centralized constants, consistent logging
- Depends on: (No dependencies - bottom layer)
- Used by: All layers

## Data Flow

**User Opens Sidebar:**

1. Background service worker detects action click or keyboard shortcut
2. Background opens side panel via `chrome.sidePanel.open()`
3. Sidebar loads and calls `fetchSpaces()` to query Chrome Tab Groups
4. Tab groups mapped to space objects with color, title, collapsed state
5. DOM renders spaces and their tabs via `renderAllSpaces()`
6. Sidebar displays pinned tabs section, space switcher, new tab button

**User Creates Tab:**

1. User clicks "New Tab" or space header
2. Sidebar calls `chrome.tabs.create()` via ChromeHelper
3. Background receives tab update event from Chrome API
4. Sidebar listens to `chrome.tabs.onCreated` and `chrome.tabs.onUpdated`
5. Tab synced into active space's tab group
6. Sidebar DOM updates with new tab element

**User Drags Tab Between Spaces:**

1. User initiates drag on tab element
2. DOMManager calculates drop position relative to target
3. On drop, sidebar extracts tab ID and target group ID
4. Calls `chrome.tabs.group()` to move tab to target tab group
5. Background receives `chrome.tabs.onUpdated` event
6. Sidebar re-syncs space contents to reflect change
7. DOM updates tab position in visual tree

**Settings Change (Color Override):**

1. User updates color picker in options.html
2. Options.js saves to `chrome.storage.sync` via `Utils.setSetting()`
3. Storage change event fires in all contexts (background, sidebar, options)
4. Logger updates cached `debugLoggingEnabled` setting
5. Sidebar listener applies color CSS variables via `applyColorOverrides()`
6. Active space re-renders with new colors

**Auto-Archive Timer Fires:**

1. Background service worker sets alarm via `chrome.alarms.create()`
2. On alarm trigger, background queries `chrome.tabs.query()`
3. Compares tab last-activity timestamp from `chrome.storage.local`
4. Moves idle tabs to archived state via `Utils.archiveTab()`
5. Sidebar receives storage change event
6. Archived tabs visible in "Archived Tabs" popup menu

**State Management:**

- **Spaces:** Mapped from Chrome Tab Groups (chrome.tabGroups.query). Source of truth is Chrome's native API
- **Tabs:** Mapped from Chrome Tabs (chrome.tabs.query). Each tab's group ID determines space membership
- **Pinned Tabs:** Queried via `chrome.tabs.query({ pinned: true })`. Persists across spaces
- **Space Metadata (colors, names, collapsed state):** Stored in `chrome.storage.local` with space ID as key
- **Settings:** Stored in `chrome.storage.sync` (cross-device sync enabled by Chrome)
- **Archived Tabs:** Array stored in `chrome.storage.local` under 'archivedTabs' key
- **Tab Name Overrides:** Stored in `chrome.storage.local` keyed by tabId, maps to custom display names

## Key Abstractions

**Space Object:**
- Purpose: Represents a Chrome Tab Group with UI metadata
- Examples: `background.js` (line 82: space.id, space.title), `sidebar.js` (line 224: activeSpace.color)
- Pattern: Plain object with properties: `{ id, title, color, collapsed, tabCount, pinned }`
- Synced with Chrome Tab Group via group ID matching

**Tab Object:**
- Purpose: Wraps Chrome Tab API with extension-specific metadata
- Examples: `sidebar.js` (line 288: tab.id, tab.url), `utils.js` (line 35: tab.title override)
- Pattern: Chrome API tab object enhanced with `nameOverride` via separate storage map
- Metadata stored separately to avoid modification conflicts with Chrome API

**Message Protocol:**
- Purpose: Asynchronous communication between service worker and content scripts
- Examples: `background.js` (line 72-75: toggleSpacePin), `sidebar.js` (event listeners)
- Pattern: `{ command: string, payload?: any }` with `sendResponse()` callback or Promise
- Used for: Pin toggling, quick tab navigation, URL copying, keyboard shortcuts

**Storage Layers:**
- **chrome.storage.sync:** Settings, debug flags (cross-device)
- **chrome.storage.local:** Spaces metadata, archived tabs, tab overrides (device-local)
- **chrome.bookmarks:** Space bookmarks (browser-native persistence, alternative view)

## Entry Points

**Background Service Worker:**
- Location: `background.js`
- Triggers: Browser start, extension install/update, user action, keyboard shortcut, alarm
- Responsibilities: Extension lifecycle, message routing, Chrome API coordination, auto-archive scheduling

**Sidebar Panel:**
- Location: `sidebar.html` / `sidebar.js`
- Triggers: User clicks extension icon or Alt+S shortcut, background opens panel
- Responsibilities: Tab display, space management, user interaction handling, drag-and-drop

**Options Page:**
- Location: `options.html` / `options.js`
- Triggers: User clicks "Options" in extension menu
- Responsibilities: Settings UI, preference persistence, color customization

**Installation Onboarding:**
- Location: `installation-onboarding.html` / `installation-onboarding.js`
- Triggers: Background detects extension install or version update
- Responsibilities: Feature discovery, keyboard shortcut display, initial setup

## Error Handling

**Strategy:** Layered error handling with logging at each boundary

**Patterns:**
- Chrome API errors caught in `ChromeHelper` and propagated as Promise rejections
- Message handlers wrap async operations in try-catch, return `{ success: false, error: message }`
- Storage operations default to sensible defaults if missing (e.g., `Utils.getSettings()` provides defaults)
- Logger centralizes all error output with respect to `debugLoggingEnabled` setting
- Failed operations logged but do not crash extension (graceful degradation)

**Examples:**
- `background.js` (line 20-32): `handleAsyncMessage()` wrapper catches errors and reports via sendResponse
- `localstorage.js` (line 74): Folder merge errors logged, operation continues
- `utils.js` (line 88): Storage defaults provided if keys missing
- `bookmarkutils.js` (line 73-76): 3-method fallback for finding Arcify folder

## Cross-Cutting Concerns

**Logging:** Centralized Logger with `debugLoggingEnabled` setting from chrome.storage.sync. All modules import Logger and call Logger.log(), Logger.error(), etc. Logger caches setting and listens to storage changes (logger.js lines 25-52)

**Validation:** Input validation on tab operations (verify tab.id exists), storage keys validated in getters, URL normalization via `Utils.getPinnedUrlKey()` to ignore query params and hashes

**Authentication:** Not applicable - extension runs in user's browser context with manifest permissions

**Aria/Accessibility:** Limited accessibility implementation - basic title attributes on interactive elements, keyboard support for onboarding navigation

---

*Architecture analysis: 2026-02-03*
