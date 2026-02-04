# Codebase Structure

**Analysis Date:** 2026-02-03

## Directory Layout

```
arcify/
├── manifest.json             # Chrome Extension manifest (Manifest V3)
├── package.json              # Node dependencies (Vite, build tools)
├── vite.config.js            # Primary Vite build config
├── vite.config.dev.js        # Development build config with watch
│
├── src/ (not present - all root level)
├── Core Extension Entry Points:
│   ├── background.js         # Service Worker - extension orchestrator
│   ├── sidebar.html          # Side panel UI template
│   ├── sidebar.js            # Side panel controller + logic
│   ├── options.html          # Settings page template
│   ├── options.js            # Settings page controller
│   ├── onboarding.html       # First-run welcome page
│   ├── onboarding.js         # First-run controller
│   ├── installation-onboarding.html  # Install notification page
│   └── installation-onboarding.js    # Install notification controller
│
├── Business Logic Modules:
│   ├── domManager.js         # DOM manipulation and UI component rendering
│   ├── utils.js              # Shared utilities, settings, archived tabs management
│   ├── localstorage.js       # Bookmark-based persistence and storage helpers
│   ├── bookmark-utils.js     # Bookmark API operations
│   ├── chromeHelper.js       # Chrome API wrappers
│   ├── logger.js             # Centralized logging with debug flag
│   └── constants.js          # CSS classes, selectors, timing constants
│
├── UI & Icons:
│   ├── styles.css            # Main stylesheet for sidebar
│   ├── installation-onboarding.css  # Onboarding page styles
│   ├── icons.js              # SVG icon exports for UI
│   └── assets/               # Images, GIFs, icon files
│       ├── icon.png          # Extension icon (128px)
│       ├── default_icon.png  # Fallback favicon
│       ├── intro.png         # Onboarding intro image
│       ├── left.png, right.png  # UI demo screenshots
│       ├── extension.gif     # Feature demonstration GIF
│       ├── spotlight.gif     # Spotlight integration demo
│       └── chrometutorial.gif
│
├── Build & Scripts:
│   ├── vite-plugins/         # Custom Vite plugins
│   │   └── vite-plugin-arcify-extension.js  # Extension build plugin
│   ├── scripts/              # Utility scripts
│   │   ├── build-info.js     # Build information generator
│   │   ├── release.js        # Release automation script
│   │   └── zip.js            # Extension packaging script
│   ├── dist/                 # Production build output (generated)
│   ├── dist-dev/             # Development build output (generated)
│   └── *.zip                 # Packaged extension (generated)
│
├── Configuration:
│   ├── .gitignore            # Git ignore rules
│   ├── LICENSE               # GPL-3.0 license
│   ├── README.md             # Project documentation
│   └── .github/              # GitHub specific files
│
└── Development:
    ├── node_modules/         # npm dependencies (not committed)
    ├── package-lock.json     # Dependency lock file
    └── .cursor, .claude      # Editor configurations
```

## Directory Purposes

**Root Level:**
- Purpose: Extension entry points and core modules - intentionally flat structure for simplicity
- Contains: HTML pages, JavaScript controllers, utility modules
- Rationale: Manifest V3 extensions typically use flat structure for easier manifest configuration and build pipelines

**assets/**
- Purpose: Static media files for UI and documentation
- Contains: PNG icons, GIF animations, demo screenshots
- Key files: `icon.png` (extension icon), `default_icon.png` (tab favicon fallback), GIFs for documentation

**dist/**
- Purpose: Production build output (optimized for Chrome Web Store)
- Generated: Yes (via `npm run build`)
- Committed: No

**dist-dev/**
- Purpose: Development build output with source maps and unminified code
- Generated: Yes (via `npm run dev`)
- Committed: No

**scripts/**
- Purpose: Build and release automation
- Key files:
  - `build-info.js`: Generates build metadata
  - `release.js`: Automates version bumps and release creation
  - `zip.js`: Packages dist/ into extension zip for distribution

**vite-plugins/**
- Purpose: Custom Vite build pipeline configuration
- Key files: `vite-plugin-arcify-extension.js` handles multi-entry bundling, manifest copying, asset optimization

## Key File Locations

**Entry Points:**
- `background.js`: Service Worker - runs persistently, handles all Chrome API operations
- `sidebar.html` / `sidebar.js`: Main UI - side panel opened by Alt+S or extension icon click
- `options.html` / `options.js`: Settings page - accessed via Chrome extension menu
- `installation-onboarding.html` / `installation-onboarding.js`: First-run onboarding flow

**Configuration:**
- `manifest.json`: Extension permissions, entry points, icons, command shortcuts
- `vite.config.js`: Primary build configuration
- `package.json`: Build scripts, dependencies

**Core Logic:**
- `sidebar.js` (3986 lines): Largest file - contains space/tab lifecycle, drag-and-drop, UI event handlers
- `domManager.js` (762 lines): DOM manipulation, UI component rendering, context menus
- `utils.js` (494 lines): Settings, archived tabs, shared helpers
- `bookmark-utils.js` (493 lines): Bookmark API operations, Arcify folder management
- `background.js` (441 lines): Service worker lifecycle, message routing, auto-archive

**Styles:**
- `styles.css`: Consolidated stylesheet for sidebar UI (color variables, layout, responsive design)
- `installation-onboarding.css`: Onboarding page specific styles

**Constants & Utilities:**
- `constants.js`: CSS classes, DOM selectors, timing constants (173 lines) - centralized for maintainability
- `logger.js`: Centralized logging with debug flag support
- `chromeHelper.js`: Chrome API wrapper functions
- `icons.js`: SVG icon exports

## Naming Conventions

**Files:**
- **HTML pages**: kebab-case (e.g., `sidebar.html`, `installation-onboarding.html`)
- **JavaScript modules**: camelCase (e.g., `domManager.js`, `bookmarkUtils.js`)
- **Build output**: Same as source (Vite preserves names)
- **Build artifacts**: dashaboutve pattern in dist (e.g., `assets/chunk-[hash].js`)

**Directories:**
- **Static assets**: `assets/` (lowercase)
- **Plugin code**: `vite-plugins/` (kebab-case for compound directories)
- **Utility scripts**: `scripts/` (standard)
- **Build outputs**: `dist/`, `dist-dev/` (standard)

**Code Identifiers:**
- **Classes/Objects (exported)**: PascalCase (e.g., `ChromeHelper`, `BookmarkUtils`, `Logger`, `LocalStorage`)
- **Functions**: camelCase (e.g., `updatePinnedFavicons()`, `applyColorOverrides()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `AUTO_ARCHIVE_ALARM_NAME`, `MAX_ARCHIVED_TABS`)
- **CSS Classes**: kebab-case (e.g., `pinned-favicon`, `drag-over`, `active`)
- **Data Attributes**: kebab-case (e.g., `data-tab-id`, `data-space-id`, `data-color`)

## Where to Add New Code

**New Feature (Tab Operation):**
- Core logic: `sidebar.js` (add handler function)
- Chrome API wrapper: `utils.js` (add static method to Utils object)
- DOM updates: `domManager.js` (add function to create/update DOM elements)
- Constants: `constants.js` (add CSS classes if needed)
- Test: Create alongside in `__tests__/` (if testing is added)

**New Component/Module (e.g., Bookmark Manager):**
- Implementation: `bookmark-utils.js` (or new file if large enough: `my-feature.js`)
- Import in: `sidebar.js` and/or `background.js` depending on usage
- No special directory needed - add at root level and import

**New Utilities/Helpers:**
- Small utilities: Add to `utils.js`
- Large utilities: Create new file at root level (e.g., `sync-utils.js`)
- Chrome API wrappers: Add to `chromeHelper.js`
- Logging: Use existing `Logger` from `logger.js`

**New Page (Settings Section):**
- HTML: Create new `.html` file at root (e.g., `advanced-options.html`)
- JavaScript: Create new `.js` file at root (e.g., `advanced-options.js`)
- Styles: Add rules to `styles.css` or create new `.css` file (import in HTML)
- Build config: Update `vite.config.js` entry points in `getExtensionInputs()`
- Manifest: Add to `manifest.json` if it's an extension page

**Styling (New UI Element):**
- Add CSS rules to `styles.css` (one stylesheet for sidebar)
- Use CSS custom properties for colors (e.g., `--chrome-blue-color`)
- Follow existing naming: element-state (e.g., `.tab.active`, `.folder.collapsed`)

**Build/Deploy Script:**
- Add to `scripts/` directory as `.js` file
- Add npm script to `package.json` in scripts section
- Use Node modules from devDependencies (fs-extra, archiver, etc.)

## Special Directories

**node_modules/**
- Purpose: npm package dependencies
- Generated: Yes (via `npm install`)
- Committed: No (.gitignore excludes)

**dist/**
- Purpose: Production build output (Manifest V3 compliant, optimized)
- Generated: Yes (via `npm run build`)
- Committed: No
- Contents: All files needed to upload to Chrome Web Store

**dist-dev/**
- Purpose: Development build with watch mode enabled
- Generated: Yes (via `npm run dev`)
- Committed: No
- Contents: Same as dist/ but unminified, includes source maps for debugging

**.git/**
- Purpose: Git repository metadata
- Committed: N/A (version control system directory)

**.github/**
- Purpose: GitHub-specific configuration
- Committed: Yes
- Contains: Workflow files, issue templates

**.claude, .cursor/**
- Purpose: Editor-specific configuration (Claude, Cursor)
- Committed: Yes (for team consistency)

---

*Structure analysis: 2026-02-03*
