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

### Active (v1.5)

- [ ] Detection: Identify tabs bookmarked in Arcify folder structure
- [ ] Wording: Change "Switch to tab" to "Open pinned/favorite tab" for Arcify tabs
- [ ] UI: Show colored space chip below Arcify tab suggestions
- [ ] Performance: Cache Arcify bookmarks with refresh on changes

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

## Current Milestone: v1.5 Arcify Integration

**Goal:** Detect Arcify-managed tabs and surface their status in Spotlight suggestions.

**Target features:**
- Detect tabs bookmarked in Arcify folder structure
- Distinguish "pinned" vs "favorite" tabs based on Chrome pinned state
- Update suggestion wording ("Open pinned tab" / "Open favorite tab")
- Show colored space chip below suggestion item
- Cache Arcify bookmarks with refresh on changes

## Future Milestones

### v2.0 (Planned)

**Goal:** TBD — potential features:
- Cross-extension messaging with Arcify for richer integration
- Accessibility improvements (axe-core audit)
- Performance optimizations

## Completed Milestones

See [MILESTONES.md](MILESTONES.md) for full history.

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
*Last updated: 2026-02-05 — v1.5 Arcify Integration milestone started*
