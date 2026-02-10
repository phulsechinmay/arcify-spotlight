# Arcify Spotlight

## What This Is

A Chrome extension that brings Arc Browser's spotlight search experience to Chrome. Provides an overlay search bar for quick tab/URL navigation via keyboard shortcuts, with Fuse.js-powered fuzzy search across open tabs, history, and bookmarks, ranked by a weighted multi-signal scoring formula.

## Core Value

Fast, keyboard-driven tab and URL navigation that feels native to Chrome, eliminating the need to click through UI to find or open tabs.

## Requirements

### Validated

- ✓ Spotlight overlay appears on new/current tab hotkeys — existing
- ✓ Autocomplete and suggestions from open tabs, history, bookmarks — existing
- ✓ New tab page override for pages that don't allow script injection — existing
- ✓ Chrome storage integration for settings and state — existing
- ✓ Keyboard navigation through suggestions — existing
- ✓ Fix: Eliminate duplicate items in suggestions — v1.0
- ✓ Fix: Correctly show open tabs in suggestions when input matches tab name/URL — v1.0
- ✓ UX: URL bar reflects selected suggestion on keyboard scroll — v1.0
- ✓ UX: Reduced padding on suggestion items — v1.0
- ✓ UX: Dynamic color highlight matching active tab group color — v1.0
- ✓ Testing: Comprehensive test suite (unit, integration, E2E) — v1.01
- ✓ Detection: Identify tabs bookmarked in Arcify folder structure — v1.5
- ✓ Wording: "Open pinned/favorite tab" for Arcify tabs — v1.5
- ✓ Performance: Cache Arcify bookmarks with refresh on changes — v1.5
- ✓ All data sources use Fuse.js fuzzy matching — v2.0
- ✓ Weighted multi-signal scoring (type + match + recency + frequency) — v2.0
- ✓ Parallel data source fetching (Promise.allSettled) — v2.0
- ✓ Single debounce layer (eliminated double debounce) — v2.0
- ✓ History recency and frequency signals in scoring — v2.0
- ✓ Progressive rendering (local first, autocomplete appends) — v2.0

### Deferred

- Space chip UI (CHIP-01 to CHIP-05) — deferred from v1.5, revisit in v2.1+
- Selection learning (LEARN-01, LEARN-02) — deferred to v2.1+

### Out of Scope

- Mobile browser support — Chrome desktop extension only
- Voice search — keyboard-driven workflow is core
- Tab group creation from spotlight — use Arcify extension for that
- Pre-built unified search index — over-engineering for current data volume
- Offline mode — real-time data is core value

## Context

**Technical Environment:**
- Chrome Extension Manifest V3
- Built with Vite v6.0.0
- JavaScript (ES6 modules), no TypeScript
- Uses Chrome APIs: tabs, storage, bookmarks, history, search
- Fuse.js v7.1.0 for fuzzy matching
- Vitest for testing (337 tests)

**Existing Codebase:**
- Two related extensions: arcify (sidebar) and arcify-spotlight (this project)
- Spotlight uses overlay.js for content script injection
- Message passing between background service worker and overlay
- Data providers for tabs, bookmarks, history queries
- ~8,400 lines of JavaScript (shared/ + test/)

**User Context:**
- Personal productivity tool, used daily
- Works alongside Arcify extension for Arc-like sidebar experience
- Primary method for tab navigation in Chrome

**Known Technical Debt:**
- Large monolithic components (sidebar.js is 3986 lines)
- Some race conditions in message handlers
- Phase 9 missing VERIFICATION.md and 2 plan summaries (documentation only)

## Constraints

- **Chrome API**: Manifest V3 required — backward compatibility not needed
- **Performance**: Suggestion filtering must be sub-100ms — used on every keystroke
- **Compatibility**: Chrome 88+ only (Manifest V3 requirement)
- **Existing Architecture**: Work within current message-passing and data provider patterns

## Completed Milestones

See [MILESTONES.md](MILESTONES.md) for full history.

- **v2.0 Fuse.js Search** (2026-02-07): Fuse.js matching, weighted scoring, parallel fetch, progressive rendering (15/15 req, 337 tests)
- **v1.5 Arcify Integration** (2026-02-06): Arcify bookmark detection, cache, enrichment pipeline, action text wording (7/12 req; CHIP UI deferred)
- **v1.01 Testing** (2026-02-04): 240 tests — unit, integration, E2E with Vitest + Puppeteer
- **v1.0 Polish** (2026-02-04): Bug fixes (deduplication, fuzzy matching) and UX improvements (URL preview, tab group colors)

## Current Milestone: v2.1 Test Coverage Audit

**Goal:** Comprehensive blind audit of test coverage across all layers, identify gaps, and fill them with user-approved tests.

**Target features:**
- Audit existing test coverage across unit, integration, and E2E layers
- Identify untested flows, especially from v2.0 Fuse.js and v1.5 Arcify changes
- Produce coverage report with prioritized gap list
- Implement approved tests to build a solid safety net for future feature work

## Future Milestones

### v2.2+ (Planned)

**Goal:** TBD — potential features:
- Space chip UI (deferred from v1.5)
- Selection learning (boost previously selected results)
- Cross-extension messaging with Arcify
- Accessibility improvements (axe-core audit)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-phase approach (bugs → UX) for v1.0 | Address stability first, then polish | ✓ Completed |
| URL fragments stripped during deduplication | page#section1 = page#section2, but query params preserved | ✓ Implemented |
| Direct Tab Groups API usage | chrome.tabGroups.get() instead of chrome.storage.local lookup | ✓ Implemented |
| URL preview in input.value | Allows user to edit URL, flag prevents search re-trigger | ✓ Implemented |
| FuseSearchService with centralized config | Shared threshold/ignoreLocation across all sources | ✓ v2.0 |
| Score inversion inside FuseSearchService | Consumers get 1=perfect without manual conversion | ✓ v2.0 |
| 4-signal weighted formula | TYPE(0.40)+MATCH(0.35)+RECENCY(0.15)+FREQUENCY(0.10) | ✓ v2.0 |
| Promise.allSettled for parallel fetching | Failed sources return [] without blocking others | ✓ v2.0 |
| Two-phase progressive rendering | Local first, autocomplete appends, stale query guard | ✓ v2.0 |
| Bookmark cache + Fuse.js pattern | Chrome API retrieval + Fuse.js re-scoring for quality | ✓ v2.0 |

---
*Last updated: 2026-02-09 after v2.1 milestone started*
