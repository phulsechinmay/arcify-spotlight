# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- JavaScript (ES6 Modules) - All core extension code, scripting, and build tools
- HTML - UI pages: `sidebar.html`, `options.html`, `onboarding.html`, `newtab.html`
- CSS - Styling: `styles.css` (arcify), `newtab.css` (spotlight), `shared/spotlight-styles.css`

**Secondary:**
- JSON - Configuration: `manifest.json`, `package.json`, `package-lock.json`

## Runtime

**Environment:**
- Node.js v25.2.1 (development)
- Chrome Extension Manifest V3 (runtime target)
- Content scripts, background service workers (module-based)

**Package Manager:**
- npm v11.6.2
- Lockfile: `package-lock.json` (present in both projects)

## Frameworks

**Core:**
- Chrome Extension API (Manifest V3) - Extension lifecycle, tab management, storage, messaging
- Vite v6.0.0 - Build tool and dev server for bundling extension code

**Build & Dev:**
- vite-plugin-web-extension v4.4.3 - Vite plugin for Chrome extension manifest handling
- vite-plugin-singlefile v2.3.0 - Bundles extension into single files
- archiver v6.0.1 - Creates ZIP archives for distribution

**Utilities:**
- fs-extra v11.2.0 - File system operations with promise support

## Key Dependencies

**Critical:**
- vite v6.0.0 - Core build infrastructure for both arcify and arcify-spotlight extensions
- vite-plugin-web-extension v4.4.3 - Handles manifest.json processing and module resolution
- vite-plugin-singlefile v2.3.0 - Bundles extension code into deployable single files

**Build Distribution:**
- archiver v6.0.1 - Creates distribution-ready ZIP files for Chrome Web Store
- fs-extra v11.2.0 - Cross-platform file operations (build scripts)

**Development:**
- nanoid - Lightweight utility (transitive dependency from other packages)

## Configuration

**Environment:**
- No environment variables detected
- No .env files used
- All configuration through manifest.json and runtime storage

**Build:**
- `vite.config.js` - Production build configuration
- `vite.config.dev.js` - Development build configuration with watch mode
- Both import from `vite-plugins/vite-plugin-arcify-extension.js` for custom extension config

**Manifest Configuration:**
- Manifest V3 format (required for modern Chrome extensions)
- Permissions: tabs, tabGroups, sidePanel, storage, bookmarks, alarms, commands, favicon, scripting, clipboardWrite
- Additional permissions (spotlight): search, topSites, history
- Background service worker: module type
- Content scripts with run_at: "document_start"

## Platform Requirements

**Development:**
- Node.js v25.2.1 or compatible
- npm v11.6.2 or yarn
- Chrome/Chromium-based browser for testing
- macOS/Linux/Windows (no platform-specific code detected)

**Production:**
- Target: Chrome Web Store deployment
- Deployment: Packaged as ZIP archive containing built extension files
- Browser: Chrome 120+ (Manifest V3 support)

## Build Process

**Development:**
```bash
npm run dev          # Vite build with watch mode, outputs to dist-dev/
```

**Production:**
```bash
npm run build        # Vite build, outputs to dist/
npm run build:zip    # Build + creates extension ZIP
npm run zip          # Creates ZIP archive of dist/
```

**Supporting Scripts:**
- `scripts/zip.js` - Archiver-based ZIP creation with maximum compression
- `scripts/build-info.js` - Build metadata generation
- `scripts/release.js` - Release automation

---

*Stack analysis: 2026-02-03*
