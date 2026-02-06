# Feature Landscape: Arcify Integration

**Domain:** Spotlight search with contextual metadata (space chips)
**Researched:** 2026-02-05
**Confidence:** HIGH (based on existing codebase analysis + UX research)

## Executive Summary

This research addresses UX patterns for showing contextual metadata (space chips) in the Arcify Spotlight search interface. The goal is to display Arcify space information (name and color) below tab suggestions, while updating action wording to distinguish "pinned" vs "favorite" tabs.

Key findings:
- Space chips should be static badges (non-interactive) for source indication
- Color contrast must meet WCAG 3:1 minimum for UI components
- Wording should use browser-standard terminology ("pinned tab") over custom terms
- Empty/ungrouped states need explicit handling

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Space name chip** | Users expect to see which space a tab belongs to | Low | Static badge below suggestion URL line |
| **Space color indicator** | Matches Arcify's core value prop of visual space organization | Low | Color dot or chip background matching space theme |
| **Distinguish pinned vs favorite** | Users need to understand tab state before acting | Low | Update action text based on Chrome pinned state |
| **Consistent with existing UI** | Suggestion items should feel cohesive | Low | Same font family, sizing, spacing as current design |
| **Keyboard navigation unchanged** | Must not break existing keyboard UX | Low | Chips are static, not focusable |

### Table Stakes Details

#### 1. Space Name Chip

**What:** A small labeled badge showing the Arcify space name (e.g., "Work", "Personal", "Side Project") below the suggestion URL.

**Why expected:** Users who use Arcify organize their tabs by space. When searching, they need context about which space a result belongs to for disambiguation (e.g., two "GitHub" tabs in different spaces).

**UX Pattern:** Based on [Baymard Institute research](https://baymard.com/blog/autocomplete-design), category scope suggestions should be styled differently from query suggestions. This provides visual scannability and helps users distinguish information at a glance.

**Placement:** Below the existing URL line (`.arcify-spotlight-result-url`) to maintain visual hierarchy:
```
[favicon] Title
          domain.com
          [Space: Work]     [action]
```

Alternative placement (inline with URL):
```
[favicon] Title
          domain.com [Work]     [action]
```

**Recommendation:** Below URL on separate line. This:
- Maintains existing URL readability
- Provides clear visual separation
- Matches the "distinct styling" pattern from Baymard research
- Accommodates longer space names without truncation issues

#### 2. Space Color Indicator

**What:** Visual color cue matching the Arcify space theme color.

**Options evaluated:**

| Approach | Pros | Cons |
|----------|------|------|
| Colored chip background | High visibility, matches Arc browser | May conflict with dark theme |
| Color dot before text | Minimal, non-intrusive | Less discoverable |
| Colored left border | Subtle, elegant | May be confused with selection state |
| Colored text | Simple | Accessibility concerns (contrast) |

**Recommendation:** Colored chip background with dark text. This:
- Provides clear visual association with space colors
- Matches Arc browser's approach (validated mental model)
- Works well in dark theme (existing spotlight uses dark background)

**Accessibility requirement:** WCAG 1.4.11 requires 3:1 contrast ratio for UI components. Per [W3C guidance](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html), the chip background color must have sufficient contrast against the container background (#2D2D2D).

Existing color palette from `ui-utilities.js`:
```javascript
const defaultColorMap = {
    grey: '204, 204, 204',    // Light - needs dark text
    blue: '139, 179, 243',    // Light - needs dark text
    red: '255, 158, 151',     // Light - needs dark text
    yellow: '255, 226, 159',  // Light - needs dark text
    green: '139, 218, 153',   // Light - needs dark text
    pink: '251, 170, 215',    // Light - needs dark text
    purple: '214, 166, 255',  // Light - needs dark text
    cyan: '165, 226, 234',    // Light - needs dark text
    orange: '255, 176, 103'   // Light - needs dark text
};
```

All existing colors are light enough to require dark text (e.g., `#1a1a1a`) for contrast compliance.

#### 3. Pinned vs Favorite Wording

**Current state:** The existing code uses:
- `ResultType.OPEN_TAB`: "Switch to Tab" (new-tab mode) or arrow (current-tab)
- `ResultType.PINNED_TAB`: "Open Pinned Tab" or "Switch to Tab" (if active)

**Arcify context:**
- "Pinned" tabs = Chrome's native pinned tabs (locked to left of tab bar)
- "Favorite" tabs = Arcify-specific concept (bookmarked in Arcify folder, but not Chrome-pinned)

**Browser standard terminology:** Per [Mozilla documentation](https://support.mozilla.org/en-US/kb/pinned-tabs-keep-favorite-websites-open), "pinned tab" is the standardized term across browsers. "Favorite" is ambiguous (could mean bookmarks).

**Recommendation:** Use precise, consistent wording:

| State | Action Text | Rationale |
|-------|-------------|-----------|
| Chrome pinned + Arcify | "Open pinned tab" | Chrome terminology takes precedence |
| Arcify only (not Chrome pinned) | "Open favorite" | Distinguishes from Chrome pinned |
| Open tab (not pinned/favorite) | "Switch to tab" | Existing behavior, no change |
| Inactive Arcify tab | "Open favorite" | Opens the bookmarked URL |

**Alternative considered:** "Open saved tab" - rejected because less specific than "favorite" and may confuse with "recently closed" restoration.

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Space-aware scoring** | Prioritize results from active space | Medium | Boost scores for tabs in current space |
| **Space filter chip** | Pre-filter suggestions by space | High | Adds filter UI to search input |
| **Multi-space indicator** | Show when URL exists in multiple spaces | Medium | Badge count or stacked chips |
| **Keyboard space switching** | Modifier key to limit search to one space | Medium | e.g., Cmd+1 for first space |

### Differentiator Details

#### Space-Aware Scoring (Recommended for v1.5)

**What:** When searching, prioritize tabs from the user's currently active space.

**Why valuable:** If user is in "Work" space and searches for "GitHub", they likely want their Work GitHub, not Personal GitHub.

**Implementation approach:** Add scoring boost in `scoring-constants.js`:
```javascript
ACTIVE_SPACE_BOOST: 50  // Add to score if tab is in active space
```

**Complexity:** Medium - requires detecting active space and passing to scoring logic.

**Recommendation:** Include in v1.5 as a polish item if time permits. Not blocking for MVP.

#### Space Filter Chip (Defer to v2.0)

**What:** Add interactive filter chips below search input to limit results to specific space.

**Why valuable:** Power users with many tabs benefit from quick filtering.

**Pattern reference:** Per [Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/autocomplete-ux/), tap-ahead chips beneath the search box allow users to "gradually construct a more sophisticated search query."

**Why defer:**
- Increases UI complexity significantly
- Requires new interaction patterns (chip selection)
- Current search is already fast; filtering is premature optimization
- Focus v1.5 on core integration, not power features

#### Multi-Space Indicator (Defer to v2.0)

**What:** When a URL exists in multiple Arcify spaces (e.g., same docs page bookmarked in Work and Personal), show indicator.

**Why valuable:** Prevents confusion about which space's version will be opened.

**Why defer:**
- Edge case (most URLs are in one space)
- Adds visual complexity
- Requires cross-referencing all spaces during search (performance concern)

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Interactive space chips** | Violates static badge pattern; causes focus confusion | Use static badges; filtering via separate mechanism if needed |
| **Chip animations on appear** | Distracting; slows perceived performance | Chips appear instantly with parent suggestion |
| **Color-only space indication** | WCAG violation (1.4.1 Use of Color) | Always include text label with color |
| **Truncating space names** | Removes critical context | Use full name; design chip to accommodate typical lengths |
| **Space chip on every result type** | Irrelevant for URL/search suggestions | Only show for OPEN_TAB, PINNED_TAB with Arcify metadata |
| **Custom tooltip on chip hover** | Adds interaction complexity; unnecessary | Space name is already visible |
| **Chip removes on click** | Would suggest filtering behavior | Static display only |

### Anti-Feature Rationale

#### Why Chips Must Be Static (Not Interactive)

Per [Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/):
> "Confusion comes when static and interactive components share the same or similar visual style. Don't design non-interactive components to appear like buttons."

The space chip is a **status indicator**, not a **filter control**. Making it interactive would:
1. Add unexpected focus targets during keyboard navigation
2. Create ambiguity ("Does clicking this filter or navigate?")
3. Conflict with the existing result item click behavior

#### Why Color Alone Is Insufficient

WCAG 1.4.1 requires that color is not the only visual means of conveying information. Per [Section508.gov](https://www.section508.gov/create/making-color-usage-accessible/):
> "Use other visual cues like patterns, shapes, or labels in addition to color."

The space chip MUST include the text label. Color provides quick recognition; text provides accessibility.

---

## Edge Cases

Scenarios requiring explicit design decisions.

| Edge Case | Scenario | Handling |
|-----------|----------|----------|
| **No Arcify space** | Tab is open but not bookmarked in any Arcify folder | No chip displayed; standard suggestion appearance |
| **Ungrouped Arcify folder** | Tab is in Arcify bookmarks but outside a space folder | Chip with "Ungrouped" or no chip (prefer no chip) |
| **Very long space name** | User created "My Super Long Project Space Name" | Chip expands; no truncation. Max-width constraint on chip container |
| **Space deleted but tab open** | Space folder removed while tabs still open | Fall back to no chip; treat as regular open tab |
| **Multiple Arcify profiles** | User has multiple Arcify bookmark roots (edge case) | Use first matched; log warning |
| **Arcify not installed** | User doesn't have Arcify extension | Feature dormant; no chip ever shown; no errors |

### Edge Case: Graceful Degradation

**Principle:** The space chip is an enhancement. Its absence should never break the core spotlight experience.

**Detection logic:**
```javascript
// Pseudocode for chip display decision
function shouldShowSpaceChip(result) {
    if (result.type !== 'open-tab' && result.type !== 'pinned-tab') {
        return false; // Only tab results can have space chips
    }
    if (!result.metadata?.arcifySpace) {
        return false; // No Arcify metadata
    }
    if (!result.metadata.arcifySpace.name) {
        return false; // Malformed metadata
    }
    return true;
}
```

---

## Accessibility Considerations

### WCAG Compliance Checklist

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| Color contrast | 1.4.11 Non-text Contrast (3:1) | Chip background vs container background |
| Color not sole indicator | 1.4.1 Use of Color | Text label always present |
| Keyboard navigation | 2.1.1 Keyboard | Chips are not focusable (static) |
| Screen reader support | 4.1.2 Name, Role, Value | Aria-label on chip or include in parent accessible name |

### Screen Reader Implementation

Per [PatternFly Chip accessibility](https://www.patternfly.org/components/chip/accessibility/):
> "If a chip group does not have a visible category name, it has an aria-label instead."

For Arcify space chips:

**Option A: Visible label is sufficient**
The chip text ("Work", "Personal") serves as the accessible name. No additional ARIA needed if text is visible.

**Option B: Include in parent result accessible name**
Modify the result item's accessible name to include space information:
```html
<button aria-label="GitHub - domain: github.com - Space: Work">
```

**Recommendation:** Option A. The chip text is visible and descriptive. Adding redundant ARIA creates maintenance burden.

### Keyboard Navigation

**Current behavior:** Arrow keys navigate between suggestion items. Enter activates.

**With chips:** No change. Chips are static visual indicators, not interactive elements. They should not appear in tab order or receive focus.

**Implementation:** Use `tabindex="-1"` or no tabindex (default not focusable) for chip element.

---

## Visual Design Specifications

### Chip Component CSS

Based on existing spotlight styles and research findings:

```css
.arcify-spotlight-result-space {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #1a1a1a; /* Dark text for contrast */
    margin-top: 4px;
    /* Background color set dynamically based on space color */
}

/* Space color backgrounds (using existing color palette) */
.arcify-spotlight-result-space[data-color="grey"] { background: rgba(204, 204, 204, 0.9); }
.arcify-spotlight-result-space[data-color="blue"] { background: rgba(139, 179, 243, 0.9); }
.arcify-spotlight-result-space[data-color="red"] { background: rgba(255, 158, 151, 0.9); }
.arcify-spotlight-result-space[data-color="yellow"] { background: rgba(255, 226, 159, 0.9); }
.arcify-spotlight-result-space[data-color="green"] { background: rgba(139, 218, 153, 0.9); }
.arcify-spotlight-result-space[data-color="pink"] { background: rgba(251, 170, 215, 0.9); }
.arcify-spotlight-result-space[data-color="purple"] { background: rgba(214, 166, 255, 0.9); }
.arcify-spotlight-result-space[data-color="cyan"] { background: rgba(165, 226, 234, 0.9); }
.arcify-spotlight-result-space[data-color="orange"] { background: rgba(255, 176, 103, 0.9); }
```

### Result Item Structure

Updated HTML structure for suggestion items:

```html
<button class="arcify-spotlight-result-item">
    <img class="arcify-spotlight-result-favicon" src="..." alt="favicon">
    <div class="arcify-spotlight-result-content">
        <div class="arcify-spotlight-result-title">GitHub - myrepo</div>
        <div class="arcify-spotlight-result-url">github.com</div>
        <span class="arcify-spotlight-result-space" data-color="blue">Work</span>
    </div>
    <div class="arcify-spotlight-result-action">Open favorite</div>
</button>
```

### Sizing Considerations

| Element | Current | With Chip |
|---------|---------|-----------|
| Result item min-height | 44px | 54px (accommodate chip line) |
| Chip font size | - | 11px (smaller than URL 12px) |
| Chip padding | - | 2px 8px |
| Chip border-radius | - | 4px (matches favicon radius) |

---

## Feature Dependencies

```
Detection (INT-01) ────┬────► Wording Change (INT-02)
                       │
                       └────► Space Chip Display (INT-03)
                                    │
                                    ▼
                              Color Theming (uses existing palette)
```

**Dependency explanation:**
1. **Detection** must work first - need to identify which tabs are Arcify-managed
2. **Wording** and **Space Chip** can be implemented in parallel once detection works
3. **Color theming** already exists in codebase (`ui-utilities.js` color map)

---

## MVP Recommendation

For v1.5 MVP, prioritize:

1. **Space name chip** - Core value proposition for Arcify integration
2. **Space color indicator** - Visual consistency with Arcify extension
3. **Pinned vs favorite wording** - Correct user expectations

Defer to v2.0:
- **Space-aware scoring** - Nice-to-have, not blocking
- **Space filter chips** - Power feature, increases complexity
- **Multi-space indicators** - Edge case handling

---

## Sources

### Primary Research (HIGH confidence)
- [Baymard Institute: Autocomplete Design](https://baymard.com/blog/autocomplete-design) - 9 UX best practices
- [Smart Interface Design Patterns: Badges vs Chips vs Tags](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/) - Static vs interactive components
- [Smart Interface Design Patterns: Autocomplete UX](https://smart-interface-design-patterns.com/articles/autocomplete-ux/) - 5 steps for better autocomplete
- [W3C WCAG 2.1: Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) - 3:1 contrast requirement
- [W3C WCAG 2.1: Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) - Color not sole indicator

### Secondary Research (MEDIUM confidence)
- [PatternFly Chip Accessibility](https://www.patternfly.org/components/chip/accessibility/) - ARIA patterns
- [Mozilla: Pinned Tabs](https://support.mozilla.org/en-US/kb/pinned-tabs-keep-favorite-websites-open) - Browser terminology
- [Arc Browser Spaces](https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas) - Reference implementation
- [Section508.gov: Color Usage](https://www.section508.gov/create/making-color-usage-accessible/) - Accessibility guidance

### Codebase Analysis (HIGH confidence)
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/ui-utilities.js` - Existing color map, formatResult function
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/shared-component-logic.js` - Result rendering pattern
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/search-types.js` - ResultType constants
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/overlay.js` - Current suggestion CSS structure

---

*Feature landscape analysis: 2026-02-05*
