# Phase 1: Bug Fixes - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix suggestion deduplication and open tab matching. Users should see no duplicate suggestions when the same URL exists across sources, and open tabs should appear correctly when input matches tab title or URL.

</domain>

<decisions>
## Implementation Decisions

### URL Normalization
- Ignore trailing slashes when comparing URLs (example.com/ = example.com)
- Ignore URL fragments/anchors (#section removed before comparison)
- Keep query parameters (different params = different pages)
- Ignore www prefix (www.example.com = example.com)

### Source Priority
- Open tab wins over history (deduplicate, show tab version)
- Open tab wins over bookmark (deduplicate, show tab version)
- Bookmark wins over history (deduplicate, show bookmark version)
- Pinned tabs rank higher than regular open tabs

### Matching Behavior
- Search both title AND URL fields for matches
- Use fuzzy matching (e.g., "ghub" can match "GitHub")
- Case insensitive matching
- Minimum 2 characters before matching tabs (avoid noise)

### Claude's Discretion
- Exact fuzzy matching algorithm/library choice
- URL normalization edge cases not covered above
- Performance optimization approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for fuzzy matching and URL normalization.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-bug-fixes*
*Context gathered: 2026-02-03*
