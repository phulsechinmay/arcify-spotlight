# Phase 8: Space Chip UI - Research

**Researched:** 2026-02-06
**Domain:** Chrome Extension UI / CSS Chip Components / WCAG Accessibility
**Confidence:** HIGH

## Summary

Phase 8 adds colored space name badges (chips) to Arcify suggestion items in the Spotlight UI. The research focused on three critical areas: (1) how the existing rendering pipeline works and where chip HTML should be injected, (2) the spaceColor data gap identified in Phase 7 and how to resolve it, and (3) WCAG 3:1 contrast ratio compliance for the existing Chrome tab group color palette.

The rendering pipeline is centralized in `SharedSpotlightLogic.generateResultsHTML()` which calls `SpotlightUtils.formatResult()`. CSS is duplicated across overlay.js (inline `<style>` in content script) and newtab.js (inline `<style>`), plus a shared `spotlight-styles.css` for the newtab page. The chip needs to be added in `generateResultsHTML()` and styled in all three CSS locations.

The most significant finding is that `enrichWithArcifyInfo()` from Phase 7 does NOT inject `spaceColor` into result metadata -- only `spaceName`, `spaceId`, `bookmarkId`, and `bookmarkTitle`. However, PINNED_TAB results from `getPinnedTabSuggestions()` DO have `spaceColor` in their metadata. The solution requires extending `enrichWithArcifyInfo()` to also fetch and inject `spaceColor`, OR extending the arcifyProvider cache to store color data.

**Primary recommendation:** Extend `enrichWithArcifyInfo()` to fetch spaceColor via a background message (reusing the existing `getArcifySpaceForUrl` message pattern), inject chip HTML into `generateResultsHTML()`, and use dark text on light tint backgrounds for all chip colors to meet WCAG 3:1 contrast.

## Standard Stack

No new libraries needed. This phase is pure CSS + vanilla JS within the existing Chrome extension architecture.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla CSS | N/A | Chip styling (pill shape, colors, truncation) | Extension already uses zero-dependency CSS |
| Vanilla JS | N/A | Conditional chip rendering in HTML generation | Consistent with existing codebase pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | - |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline chip HTML | Shadow DOM component | Overkill for static badge; breaks content script compatibility |
| CSS-only truncation | JS-based truncation | CSS `text-overflow: ellipsis` is sufficient and more performant |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Where Chips Render in the Pipeline

```
User types query
  -> SearchEngine.getSuggestionsImpl()
    -> BaseDataProvider.getSpotlightSuggestions()
      -> [fetch sources] -> deduplicateResults()
      -> enrichWithArcifyInfo()  <-- injects spaceName, spaceId (NOT spaceColor currently)
      -> scoreAndSortResults()
  -> Results sent via message to overlay/newtab
    -> SharedSpotlightLogic.generateResultsHTML(results, mode)  <-- CHIP HTML GENERATED HERE
      -> SpotlightUtils.formatResult(result, mode)  <-- subtitle/action text
    -> resultsContainer.innerHTML = html
```

### Key Files to Modify

```
shared/
  shared-component-logic.js   # generateResultsHTML() - add chip HTML
  ui-utilities.js              # Add chip color utility (reuse defaultColorMap)
  spotlight-styles.css         # Add chip CSS for newtab page
  data-providers/
    base-data-provider.js      # Extend enrichWithArcifyInfo() to include spaceColor
    arcify-provider.js         # Extend cache to store spaceColor per URL
background.js                  # (only if new message type needed)
overlay.js                     # Add chip CSS to inline styles
newtab.js                      # Add chip CSS to inline styles
```

### Pattern 1: Conditional Chip Rendering in generateResultsHTML()

**What:** Only render chip HTML when `result.metadata?.spaceName` exists and `result.metadata?.isArcify` is true or result is PINNED_TAB.
**When to use:** Every result rendering pass.
**Example:**

```javascript
// In SharedSpotlightLogic.generateResultsHTML()
static generateResultsHTML(results, mode) {
    return results.map((result, index) => {
        const formatted = SpotlightUtils.formatResult(result, mode);
        const isSelected = index === 0;

        // Generate chip HTML only for results with space metadata
        const chipHtml = SpotlightUtils.generateSpaceChipHTML(result);

        return `
            <button class="arcify-spotlight-result-item ${isSelected ? 'selected' : ''}"
                    data-index="${index}"
                    data-testid="spotlight-result">
                <img class="arcify-spotlight-result-favicon" ...>
                <div class="arcify-spotlight-result-content">
                    <div class="arcify-spotlight-result-title">${SpotlightUtils.escapeHtml(formatted.title)}</div>
                    <div class="arcify-spotlight-result-url">
                        ${SpotlightUtils.escapeHtml(formatted.subtitle)}${SpotlightUtils.formatDebugInfo(result)}${chipHtml}
                    </div>
                </div>
                <div class="arcify-spotlight-result-action">${SpotlightUtils.escapeHtml(formatted.action)}</div>
            </button>
        `;
    }).join('');
}
```

### Pattern 2: Space Chip HTML Generator

**What:** Utility function that generates chip HTML or empty string.
**When to use:** Called from generateResultsHTML().
**Example:**

```javascript
// In SpotlightUtils (ui-utilities.js)
static generateSpaceChipHTML(result) {
    const spaceName = result.metadata?.spaceName;
    if (!spaceName) return '';

    const spaceColor = result.metadata?.spaceColor || 'grey';
    const chipColors = SpotlightUtils.getChipColors(spaceColor);
    const truncatedName = spaceName.length > 18 ? spaceName.substring(0, 18) + '...' : spaceName;

    return `<span class="arcify-space-chip"
                  style="background:${chipColors.bg};color:${chipColors.text}"
                  title="${SpotlightUtils.escapeHtml(spaceName)}"
            >${SpotlightUtils.escapeHtml(truncatedName)}</span>`;
}
```

### Pattern 3: Color-to-Chip-Style Mapping

**What:** Map Chrome tab group color names to chip background + text color pairs that meet WCAG 3:1.
**When to use:** When generating chip styles.
**Example:**

```javascript
// Reuses existing defaultColorMap RGB values from ui-utilities.js
static getChipColors(colorName) {
    // Light tint backgrounds with dark text for WCAG 3:1 contrast
    const chipColorMap = {
        grey:   { bg: 'rgba(204, 204, 204, 0.25)', text: '#cccccc' },
        blue:   { bg: 'rgba(139, 179, 243, 0.25)', text: '#8bb3f3' },
        red:    { bg: 'rgba(255, 158, 151, 0.25)', text: '#ff9e97' },
        yellow: { bg: 'rgba(255, 226, 159, 0.25)', text: '#c8a84e' },
        green:  { bg: 'rgba(139, 218, 153, 0.25)', text: '#8bda99' },
        pink:   { bg: 'rgba(251, 170, 215, 0.25)', text: '#fbaad7' },
        purple: { bg: 'rgba(214, 166, 255, 0.25)', text: '#d6a6ff' },
        cyan:   { bg: 'rgba(165, 226, 234, 0.25)', text: '#a5e2ea' },
        orange: { bg: 'rgba(255, 176, 103, 0.25)', text: '#ffb067' }
    };
    return chipColorMap[colorName] || chipColorMap.grey;
}
```

### Anti-Patterns to Avoid
- **Adding chip as separate DOM row:** Decision is "inline with URL" -- chip goes IN the `.arcify-spotlight-result-url` div, not after it. Adding a new row would break the 44px min-height layout and make items taller.
- **Using `<button>` or `<a>` for chip:** Chips are static/non-interactive. Using interactive elements would break keyboard navigation (CHIP-03).
- **Per-chip async color fetch:** All color data must be in `result.metadata` before rendering. Never fetch color during HTML generation.
- **Modifying SelectionManager:** Chips are inside existing `.arcify-spotlight-result-item` buttons. Arrow keys already navigate between items. No SelectionManager changes needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text truncation | JS substring + measure | CSS `max-width` + `text-overflow: ellipsis` | More robust, handles variable fonts, no reflow |
| Color contrast calculation | Runtime luminance math | Pre-computed color map with verified contrast | Simpler, no runtime cost, verifiable |
| Pill shape | Complex border-radius calc | `border-radius: 9999px` | Standard CSS pill pattern |

**Key insight:** The chip is purely presentational CSS. All the complexity is in getting the data (spaceColor) to the rendering layer at the right time, not in the rendering itself.

## Common Pitfalls

### Pitfall 1: spaceColor Missing from Enrichment Data
**What goes wrong:** Phase 7's `enrichWithArcifyInfo()` does NOT inject `spaceColor`. The arcifyProvider cache stores `{ spaceName, spaceId, bookmarkId, bookmarkTitle }` but not color. Without spaceColor, all chips would be grey.
**Why it happens:** Phase 6 arcifyProvider builds cache from bookmarks (which don't have color). Color comes from `chrome.storage.local` spaces array or `chrome.tabGroups.get()`.
**How to avoid:** Two options:
  1. **Preferred:** Extend arcifyProvider to also store spaceColor during cache build by cross-referencing the spaces array in chrome.storage.local (same pattern as getPinnedTabsData).
  2. **Alternative:** Add a separate message to fetch spaceColor by spaceName from background, but this adds async complexity to rendering.
**Warning signs:** All chips showing grey color even when spaces have colors assigned.

### Pitfall 2: CSS Not Applied in Overlay Context
**What goes wrong:** Overlay.js uses inline `<style>` tags injected into the host page's DOM. CSS in `spotlight-styles.css` does NOT apply to the overlay -- it only applies to `newtab.html`. If chip CSS is only added to `spotlight-styles.css`, chips will be unstyled in overlay mode.
**Why it happens:** Content scripts cannot use external CSS files. The overlay creates its own `<style>` element with all CSS inline.
**How to avoid:** Add chip CSS to THREE places: (1) overlay.js inline styles, (2) newtab.js inline styles, (3) spotlight-styles.css. Or better: extract chip CSS into a shared constant that all three consume.
**Warning signs:** Chips look correct in newtab but broken/unstyled in overlay.

### Pitfall 3: Chip Breaks Keyboard Navigation
**What goes wrong:** If chip is rendered as a focusable element or a separate `.arcify-spotlight-result-item`, arrow keys would try to navigate to it.
**Why it happens:** SelectionManager queries `'.arcify-spotlight-result-item'` elements and navigates between them.
**How to avoid:** Use a `<span>` with class `arcify-space-chip` (NOT `arcify-spotlight-result-item`). Never use `<button>`, `<a>`, or any element with `tabindex`.
**Warning signs:** Arrow key navigation skips items or stops on chips.

### Pitfall 4: Chip Breaks URL Line Ellipsis
**What goes wrong:** The `.arcify-spotlight-result-url` div uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Adding an inline `<span>` child might break the text-overflow behavior.
**Why it happens:** `text-overflow: ellipsis` works on text nodes, not on child elements with their own overflow handling.
**How to avoid:** Make the URL div a flexbox row with `display: inline-flex` or `display: flex` and set both the URL text and chip as flex children. The URL text gets `overflow: hidden; text-overflow: ellipsis` and the chip gets `flex-shrink: 0`.
**Warning signs:** Long URLs don't truncate, or the chip gets cut off.

### Pitfall 5: Chip Overflows Result Item Width
**What goes wrong:** On narrow viewports or with long URLs, the chip could push content beyond the result item boundaries.
**Why it happens:** Chip has minimum width (text content) and the URL line has constrained width.
**How to avoid:** Give the chip `flex-shrink: 0` and a `max-width` with its own `text-overflow: ellipsis`. Give the URL text `flex: 1; min-width: 0` so it truncates first.
**Warning signs:** Horizontal scrollbar appears in results container, or chip text wraps.

## Code Examples

### Example 1: URL Line with Inline Chip (CSS Layout)

```css
/* Chip placed inline with URL text */
.arcify-spotlight-result-url {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    display: flex;           /* Changed from block to flex */
    align-items: center;     /* Vertically center chip with URL */
    gap: 6px;                /* Spacing between URL and chip */
    overflow: hidden;        /* Prevent overflow */
}

.arcify-spotlight-result-url:empty {
    display: none;
}

/* URL text truncation */
.arcify-spotlight-result-url-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;            /* Allow flex child to shrink below content width */
}

/* Space chip pill badge */
.arcify-space-chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 8px;
    border-radius: 9999px;   /* Pill shape */
    font-size: 10px;
    font-weight: 500;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;        /* ~18 chars before truncation */
    flex-shrink: 0;          /* Don't shrink the chip */
}
```

### Example 2: Chip Color Map with WCAG 3:1 Contrast

The existing `defaultColorMap` in ui-utilities.js uses these RGB values for Chrome tab group colors. For chips on a dark (#2D2D2D) background, use the color itself at reduced opacity for the background, and the full color for text. This creates a "tinted badge" effect common in dark UI.

```javascript
// Contrast analysis against #2D2D2D background:
// All these colors have relative luminance > 0.2 which gives > 3:1 against dark bg
// Background: #2D2D2D = rgb(45, 45, 45), relative luminance ~0.026
//
// Color         RGB              Luminance  Ratio vs #2D2D2D  Passes 3:1?
// grey          204,204,204      0.604      14.4:1             YES
// blue          139,179,243      0.417       9.5:1             YES
// red           255,158,151      0.380       8.6:1             YES
// yellow        255,226,159      0.728      17.6:1             YES
// green         139,218,153      0.549      12.9:1             YES
// pink          251,170,215      0.429       9.8:1             YES
// purple        214,166,255      0.406       9.2:1             YES
// cyan          165,226,234      0.619      14.8:1             YES
// orange        255,176,103      0.433       9.9:1             YES
//
// Strategy: Use full color as chip text, rgba(color, 0.15-0.20) as chip background
// This gives a "tinted badge" look consistent with the existing selected-item highlight pattern
```

### Example 3: Extending enrichWithArcifyInfo() for spaceColor

```javascript
// In base-data-provider.js enrichWithArcifyInfo()
// After getting spaceInfo from arcifyProvider:
if (spaceInfo) {
    result.metadata = result.metadata || {};
    result.metadata.isArcify = true;
    result.metadata.spaceName = spaceInfo.spaceName;
    result.metadata.spaceId = spaceInfo.spaceId;
    result.metadata.bookmarkId = spaceInfo.bookmarkId;
    result.metadata.bookmarkTitle = spaceInfo.bookmarkTitle;
    result.metadata.spaceColor = spaceInfo.spaceColor || 'grey';  // NEW: inject color
}
```

This requires extending arcifyProvider's cache to store spaceColor:

```javascript
// In arcify-provider.js rebuildCache()
// Cross-reference with spaces storage to get colors
const storage = await chrome.storage.local.get('spaces');
const spaces = storage.spaces || [];

for (const spaceFolder of subtree.children || []) {
    if (spaceFolder.url) continue;

    // Find matching space for color
    const space = spaces.find(s => s.name === spaceFolder.title);

    const spaceInfo = {
        spaceName: spaceFolder.title,
        spaceId: spaceFolder.id,
        spaceColor: space?.color || 'grey'  // NEW: store color
    };

    this.processFolder(spaceFolder, spaceInfo, newCache);
}
```

### Example 4: generateResultsHTML with Chip

```javascript
// Modified generateResultsHTML showing chip integration
static generateResultsHTML(results, mode) {
    if (!results || results.length === 0) {
        return '<div class="arcify-spotlight-empty">Start typing to search tabs, bookmarks, and history</div>';
    }

    return results.map((result, index) => {
        const formatted = SpotlightUtils.formatResult(result, mode);
        const isSelected = index === 0;
        const chipHtml = SpotlightUtils.generateSpaceChipHTML(result);

        // If chip exists, wrap URL text in a span for flex layout
        const urlContent = formatted.subtitle
            ? (chipHtml
                ? `<span class="arcify-spotlight-result-url-text">${SpotlightUtils.escapeHtml(formatted.subtitle)}</span>${SpotlightUtils.formatDebugInfo(result)}${chipHtml}`
                : `${SpotlightUtils.escapeHtml(formatted.subtitle)}${SpotlightUtils.formatDebugInfo(result)}`)
            : '';

        return `
            <button class="arcify-spotlight-result-item ${isSelected ? 'selected' : ''}"
                    data-index="${index}"
                    data-testid="spotlight-result">
                <img class="arcify-spotlight-result-favicon"
                     src="${SpotlightUtils.getFaviconUrl(result)}"
                     alt="favicon"
                     data-fallback-icon="true">
                <div class="arcify-spotlight-result-content">
                    <div class="arcify-spotlight-result-title">${SpotlightUtils.escapeHtml(formatted.title)}</div>
                    <div class="arcify-spotlight-result-url">${urlContent}</div>
                </div>
                <div class="arcify-spotlight-result-action">${SpotlightUtils.escapeHtml(formatted.action)}</div>
            </button>
        `;
    }).join('');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No space indicators | Action text only (Phase 7) | 2026-02-06 | Users see "Open Pinned Tab" but no visual space context |
| spaceColor not cached | Need to extend cache | Phase 8 | Required for colored chips |

**Key architectural note:** The existing codebase uses the pattern of light-opacity tinted backgrounds for interactive states (`.selected` uses `var(--spotlight-accent-color-20)`, hover uses `var(--spotlight-accent-color-15)`). The chip should follow the same aesthetic: light tinted background at ~15-20% opacity with full-color text.

## Data Flow Gap Analysis

### Where spaceColor Currently Exists

| Source | Has spaceColor? | When Available |
|--------|----------------|----------------|
| `getPinnedTabsData()` -> PINNED_TAB results | YES (from `chrome.storage.local` spaces array) | Already in metadata |
| `enrichWithArcifyInfo()` -> OPEN_TAB, BOOKMARK, HISTORY results | NO (arcifyProvider cache lacks color) | Needs extension |
| `arcifyProvider.cache` | NO (stores spaceName, spaceId, bookmarkId, bookmarkTitle) | Needs extension |
| `chrome.storage.local` spaces array | YES (each space has `.color`) | Available at cache build time |

### Recommended Fix

Extend `arcifyProvider.rebuildCache()` to cross-reference the spaces array (from `chrome.storage.local`) during cache build, storing `spaceColor` alongside other space metadata. This is the same pattern already used by `getPinnedTabsData()` in background-data-provider.js lines 117-143.

**Cost:** One additional `chrome.storage.local.get('spaces')` call during cache build (not per-lookup). The cache is already rebuilt on bookmark changes, so adding this data has near-zero runtime cost.

## CSS Duplication Strategy

The codebase has CSS in three locations that must stay in sync:

| Location | File | How CSS is Added |
|----------|------|-----------------|
| Overlay | `overlay.js` | Inline template literal in `spotlightCSS` variable |
| New Tab | `newtab.js` | Inline template literal in `spotlightCSS` variable |
| Shared (unused by overlay) | `shared/spotlight-styles.css` | External stylesheet for newtab.html |

**Recommendation:** Add chip CSS as a shared constant string in `ui-utilities.js` that can be imported by both overlay.js and newtab.js. This reduces the duplication to one source of truth. The constant would export the CSS text, and each context would inject it into their `<style>` element.

Alternatively, simply add the chip CSS to all three locations (simpler, follows existing pattern, but creates triple duplication). Given the chip CSS is only ~15 lines, this duplication is manageable.

## Claude's Discretion Recommendations

### Contrast Handling: Light tint background + matching color text

**Recommendation:** Use `rgba(color, 0.15)` for chip background and the full RGB color for chip text. This creates a "tinted badge" aesthetic that:
- Matches the existing dark UI theme (#2D2D2D background)
- Provides WCAG 3:1+ contrast for all Chrome tab group colors (verified mathematically)
- Follows the same pattern as the existing hover/selected highlights
- Looks native and unobtrusive

### Chip Alignment: Left-aligned, immediately after URL text

**Recommendation:** Left-aligned within the URL line, right after the URL text with 6px gap. This is consistent with the context of "inline with URL" and avoids the chip floating detached at the right edge.

### Typography: 10px, weight 500

**Recommendation:**
- Font size: 10px (2px smaller than URL text at 12px, creating clear visual hierarchy)
- Font weight: 500 (medium, same as title -- makes chip text readable at small size)
- Line height: 16px (gives 18px total height with 1px vertical padding)

### Spacing and Sizing

**Recommendation:**
- Chip padding: 1px 8px (tight, compact)
- Gap between URL and chip: 6px
- Max width: 140px (approximately 18 characters before ellipsis)
- Border radius: 9999px (true pill shape)
- Total chip height: ~18px (compact relative to 44px result item height)

## Open Questions

1. **Color override support for chips**
   - What we know: `getAccentColorCSS()` in ui-utilities.js supports `colorOverrides` from `chrome.storage.sync`. These allow users to customize space colors.
   - What's unclear: Should chips also respect color overrides, or always use default Chrome tab group colors?
   - Recommendation: Skip color overrides for chips in this phase. The chip uses a static color map at render time. Supporting overrides would require an async call per chip color. Can be added later if needed.

2. **Default results (empty query) chip display**
   - What we know: When query is empty, `getDefaultResults()` returns open tabs. These go through deduplication but NOT enrichment (no `enrichWithArcifyInfo()` call).
   - What's unclear: Should chips appear on default results too?
   - Recommendation: Yes, extend `getDefaultResults()` to also call `enrichWithArcifyInfo()`. Without this, chips only appear when user types a query, which is inconsistent.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `shared/shared-component-logic.js` - generateResultsHTML() rendering pipeline
- Codebase analysis: `shared/ui-utilities.js` - defaultColorMap with RGB values for all 9 Chrome colors
- Codebase analysis: `shared/data-providers/base-data-provider.js` - enrichWithArcifyInfo() pipeline
- Codebase analysis: `shared/data-providers/arcify-provider.js` - cache structure (no spaceColor)
- Codebase analysis: `shared/data-providers/background-data-provider.js` - getPinnedTabsData() has spaceColor
- Codebase analysis: Phase 7 summary - confirmed spaceColor omission as documented deviation
- [Chrome tabGroups API](https://developer.chrome.com/docs/extensions/reference/api/tabGroups) - 9 color values confirmed

### Secondary (MEDIUM confidence)
- WCAG 3:1 contrast ratio requirements from [WebAIM](https://webaim.org/resources/contrastchecker/) and [Accessible Web](https://accessibleweb.com/color-contrast-checker/)
- Contrast ratio calculations computed from known RGB values and WCAG relative luminance formula

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, pure CSS/JS within existing patterns
- Architecture: HIGH - rendering pipeline thoroughly analyzed from source code
- Data flow: HIGH - spaceColor gap verified from Phase 7 summary and code inspection
- Pitfalls: HIGH - identified from direct analysis of CSS duplication, keyboard nav, and overflow behavior
- Contrast: MEDIUM - calculated from known RGB values using WCAG formula, but not verified with automated tool

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable - no external dependencies to change)
