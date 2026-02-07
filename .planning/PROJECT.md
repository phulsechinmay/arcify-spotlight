# Arcify Spotlight

## What This Is

A Chrome extension that brings Arc Browser's spotlight search experience to Chrome. Provides an overlay search bar for quick tab/URL navigation via keyboard shortcuts, with autocomplete suggestions from open tabs, history, and bookmarks. Used daily as the primary new tab and current tab navigation workflow.

## Core Value

Fast, keyboard-driven tab and URL navigation that feels native to Chrome, eliminating the need to click through UI to find or open tabs.

## Requirements

### Validated

- ✓ Spotlight overlay appears on new/current tab hotkeys — existing
- ✓ Autocomplete and suggestions from open tabs, history, bookmarks — existing
- ✓ New tab page override for pages that don't allow script injection — existing
- ✓ Chrome storage integration for settings and state — existing
- ✓ Keyboard navigation through suggestions — existing

### Completed (v1.0)

- [x] Fix: Eliminate duplicate items in suggestions (same item from history + open tabs)
- [x] Fix: Correctly show open tabs in suggestions when input matches tab name/URL
- [x] UX: Update spotlight URL bar to reflect selected suggestion when scrolling with keyboard
- [x] UX: Reduce padding on suggestion items for better screen density
- [x] UX: Dynamic color highlight matching active tab group color (purple fallback if no group)

### Completed (v1.01)

- [x] Testing: Unit tests for pure logic (URL utils, scoring, fuzzy matching)
- [x] Testing: Unit tests with Chrome API mocks (caching, debouncing, action routing)
- [x] Testing: Integration tests for message passing
- [x] Testing: E2E tests for critical user flows

### Completed (v1.5)

- [x] Detection: Identify tabs bookmarked in Arcify folder structure
- [x] Wording: Change "Switch to tab" to "Open pinned/favorite tab" for Arcify tabs
- [x] Performance: Cache Arcify bookmarks with refresh on changes

### Active (v2.0)

- [ ] Replace fuzzyMatch() with Fuse.js fuzzy search library
- [ ] Implement weighted multi-signal scoring (match quality + source priority + recency + frequency)
- [ ] Parallelize data source fetching with Promise.all()
- [ ] Fix double debouncing (overlay 150ms + SearchEngine 150ms)
- [ ] Incorporate recency and frequency signals into history scoring
- [ ] Consistent fuzzy matching across all data sources (tabs, bookmarks, history)

### Deferred

- Space chip UI (CHIP-01 to CHIP-05) — deferred from v1.5, revisit after v2.0

### Out of Scope

- Mobile browser support — Chrome desktop extension only
- Voice search — keyboard-driven workflow is core
- Tab group creation from spotlight — use Arcify extension for that

## Context

**Technical Environment:**
- Chrome Extension Manifest V3
- Built with Vite v6.0.0
- JavaScript (ES6 modules), no TypeScript
- Uses Chrome APIs: tabs, storage, bookmarks, history, search

**Existing Codebase:**
- Two related extensions: arcify (sidebar) and arcify-spotlight (this project)
- Spotlight uses overlay.js for content script injection
- Message passing between background service worker and overlay
- Data providers for tabs, bookmarks, history queries

**User Context:**
- Personal productivity tool, used daily
- Works alongside Arcify extension for Arc-like sidebar experience
- Primary method for tab navigation in Chrome

**Known Technical Debt:**
- Large monolithic components (sidebar.js is 3986 lines)
- Some race conditions in message handlers
- ~~No automated tests~~ (Addressed in v1.01 — 240 tests)

## Constraints

- **Chrome API**: Manifest V3 required — backward compatibility not needed
- **Performance**: Suggestion filtering must be sub-100ms — used on every keystroke
- **Compatibility**: Chrome 88+ only (Manifest V3 requirement)
- **Existing Architecture**: Work within current message-passing and data provider patterns

## Current Milestone: v2.0 Fuse.js Search

**Goal:** Replace the entire matching and scoring system with Fuse.js-based architecture for dramatically better search relevancy and performance.

**Target features:**
- Replace hand-rolled fuzzyMatch() with Fuse.js fuzzy search library
- Implement weighted multi-signal scoring (match quality + source priority + recency + frequency)
- Parallelize data source fetching (Promise.all instead of sequential awaits)
- Fix double debouncing (300ms → 150ms effective delay)
- Incorporate history recency and frequency into scoring
- Consistent fuzzy matching across all data sources

## Future Milestones

### v2.1 (Planned)

**Goal:** TBD — potential features:
- Space chip UI (deferred from v1.5)
- Selection learning (boost previously selected results)
- Cross-extension messaging with Arcify
- Accessibility improvements (axe-core audit)

## Completed Milestones

See [MILESTONES.md](MILESTONES.md) for full history.

- **v1.5 Arcify Integration** (2026-02-06): Arcify bookmark detection, cache, enrichment pipeline, action text wording (7/12 req; CHIP UI deferred)
- **v1.01 Testing** (2026-02-04): 240 tests — unit, integration, E2E with Vitest + Puppeteer
- **v1.0 Polish** (2026-02-04): Bug fixes (deduplication, fuzzy matching) and UX improvements (URL preview, tab group colors)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-phase approach (bugs → UX) for v1.0 | Address stability first, then polish. Integration deferred to v1.5 | ✓ Completed |
| URL fragments stripped during deduplication | page#section1 = page#section2, but query params preserved | ✓ Implemented |
| Direct Tab Groups API usage | chrome.tabGroups.get() instead of chrome.storage.local lookup | ✓ Implemented |
| URL preview in input.value | Allows user to edit URL, flag prevents search re-trigger | ✓ Implemented |

---
*Last updated: 2026-02-06 — v2.0 Fuse.js Search milestone started*
