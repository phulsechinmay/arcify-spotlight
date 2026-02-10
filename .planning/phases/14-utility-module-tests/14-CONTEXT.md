# Phase 14: Utility Module Tests - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add thorough unit test coverage for the four utility modules identified in the Phase 13 coverage audit: bookmark-utils.js, website-name-extractor.js, popular-sites.js, and utils.js. No new features, no refactoring beyond what's needed for testability.

</domain>

<decisions>
## Implementation Decisions

### Coverage depth
- Aim for exhaustive coverage (90%+ target generally, 80%+ for bookmark-utils specifically)
- Test all exported functions, not just critical paths
- Chrome APIs (chrome.bookmarks.getTree, chrome.bookmarks.search) must be thoroughly mocked — not skipped
- Use simple, representative test fixtures (5-10 bookmarks per test case), not large-scale real-world data
- ASCII-only URLs are sufficient for website-name-extractor — no IDN/punycode needed

### Refactoring tolerance
- Light refactoring only — minor helper extractions are fine, no major restructuring or file splitting
- If refactoring is needed, it gets its own separate commit (refactor type) before the test commit
- If a function is untestable without major restructuring, test at integration level rather than skipping
- Follow existing test patterns strictly — vitest, test/ directory structure, current assertion style. No new patterns.

### Test boundary for bookmark-utils
- Test ALL exported functions exhaustively — this is the #1 risk priority (577 lines, 9% coverage)
- Include Arcify-specific folder structure tests (realistic Arcify folder hierarchy with exact folder names)
- Use synthetic test data (programmatic bookmark objects), not Chrome bookmark export files
- Target: 80%+ line coverage for this module

### Claude's Discretion
- Module grouping into plans (how to split the 4 modules across plans)
- Test file naming within existing conventions
- Specific mock implementation approach for Chrome APIs
- Which helper functions in bookmark-utils warrant their own describe blocks

</decisions>

<specifics>
## Specific Ideas

- bookmark-utils must validate Arcify-specific bookmark tree structures (the exact folder names and nesting the extension creates)
- Chrome API mocks should be thorough enough to simulate real bookmark tree responses, errors, and edge cases
- Untestable functions should be tested at integration level rather than documented and skipped

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-utility-module-tests*
*Context gathered: 2026-02-10*
