# Phase 8: Space Chip UI - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Render colored space name badges (chips) below Arcify suggestion items in Spotlight. Chips are static, non-interactive, and styled for accessibility. Feature degrades gracefully when Arcify folder is not found.

</domain>

<decisions>
## Implementation Decisions

### Color Mapping
- Use tab group color from the space (grey, blue, red, yellow, etc.)
- Grey fallback if no tab group color is available
- Solid background only (no border or shadow)

### Chip Visual Design
- Pill shape (rounded ends like a capsule)
- Small size relative to suggestion text (compact, doesn't dominate)
- Text only (no icons)
- Truncate long space names with ellipsis

### Chip Positioning
- Inline with URL (same row as subtitle/URL)
- Tight spacing (4-8px) between URL and chip
- Vertically centered relative to URL line

### Edge Cases
- No chips, no errors when Arcify folder not found (feature silently disabled)
- Max 15-20 characters before truncation
- First space found wins if URL appears in multiple spaces
- Show chips in both overlay and new-tab Spotlight (consistent experience)

### Claude's Discretion
- Contrast handling (light tint vs dynamic text color)
- Chip alignment (left after URL vs right edge)
- Exact typography (font size, weight)
- Specific pixel values for spacing and sizing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The chip should feel like a natural part of the existing suggestion UI, not a bolted-on element.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-space-chip-ui*
*Context gathered: 2026-02-06*
