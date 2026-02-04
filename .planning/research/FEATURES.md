# Features Research: Spotlight/Command Palette UX Patterns

**Research Date:** 2026-02-03
**Research Type:** Project Research - Features Dimension
**Target:** Arcify Spotlight Chrome Extension improvements

---

## Executive Summary

This research examines UX patterns and best practices for command palette/spotlight interfaces, drawing from established tools (Arc Browser, Raycast, Alfred, VS Code, Chrome Omnibox) to inform improvements to the Arcify Spotlight Chrome extension. The focus areas are: deduplication strategies, matching algorithms, keyboard navigation, and visual theming.

---

## 1. Table Stakes (Must-Have for Spotlight UX)

### 1.1 Reliable Deduplication

**Industry Standard:**
All mature spotlight implementations handle duplicates gracefully. The same URL should never appear twice, regardless of whether it comes from tabs, history, or bookmarks.

**Best Practice Pattern:**
```
Priority order for deduplication:
1. Open Tab (highest - user has it open now)
2. Pinned Tab (active context)
3. Bookmark (user explicitly saved)
4. History (passive tracking)
5. Autocomplete suggestions (external source)
```

**Current State in Arcify:**
The codebase has `deduplicateResults()` in `base-data-provider.js` that normalizes URLs by:
- Removing trailing slashes
- Removing protocol prefixes (http/https)
- Removing www. prefix
- Using type priority to decide which duplicate to keep

**Gap Analysis:**
- Current deduplication is sound in architecture
- Need to verify it handles edge cases: URL fragments (#), query params (?), case sensitivity
- May need more aggressive normalization for complex URLs

### 1.2 Keyboard-First Navigation

**Industry Standard (from VS Code, Raycast, Alfred):**
- Arrow Up/Down: Move selection
- Enter: Execute selected action
- Escape: Close palette
- Home/End: Jump to first/last result
- Tab: (optionally) cycle through result groups or actions
- Cmd/Ctrl+Number: Quick select by position (1-9)

**Current State in Arcify:**
`selection-manager.js` handles:
- ArrowDown/ArrowUp: Move selection
- Home/End: Jump to first/last
- Enter: Execute (in shared-component-logic.js)
- Escape: Close

**Gap Analysis:**
- Missing: Quick select via Cmd+1-9 (differentiator, not table stakes)
- Current implementation is solid for core navigation

### 1.3 Instant Visual Feedback

**Industry Standard:**
- Selection highlight must follow keyboard navigation instantly (<16ms)
- Selected item scrolls into view smoothly
- No flash or layout shift when results update

**Current State in Arcify:**
`selection-manager.js` uses `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` for auto-scrolling. Visual selection uses CSS class toggle.

**Gap Analysis:**
- Implementation is standard-compliant
- The smooth scrolling may cause slight lag on rapid navigation - consider 'instant' for keyboard nav

### 1.4 Sub-100ms Input Response

**Industry Standard:**
- Instant suggestions appear within 50ms
- Debounced async results within 150-300ms
- User should never feel "waiting"

**Current State in Arcify:**
- `DEBOUNCE_DELAY = 150` in SearchEngine
- Instant suggestions via `generateInstantSuggestion()` (zero latency)
- Two-phase architecture: instant + async

**Gap Analysis:**
- Architecture is correct
- 150ms debounce is industry-standard

---

## 2. Differentiators (What Makes This Better Than Chrome Default)

### 2.1 URL Preview on Keyboard Navigation

**Pattern from Arc Browser:**
When navigating through results with keyboard, the URL bar (or a preview area) shows the full URL of the currently selected item. This gives users confidence before pressing Enter.

**Implementation Approach:**
```javascript
// On selection change, emit URL to preview element
selectionManager.onSelectionChange = (selectedResult) => {
    urlPreviewElement.textContent = selectedResult?.url || '';
};
```

**Priority:** HIGH - This is explicitly requested and significantly improves confidence in selection.

### 2.2 Dynamic Color Theming

**Pattern from Arc Browser:**
Spotlight accent color matches the current space/context color, creating visual consistency.

**Current State in Arcify:**
`ui-utilities.js` already has `getAccentColorCSS()` that:
- Maps space colors (grey, blue, red, etc.) to RGB values
- Supports color overrides from settings
- Generates CSS custom properties for theming

**Gap Analysis:**
- Foundation exists
- Need to ensure color updates without full re-render
- Consider: Pull color from active tab group if available

### 2.3 Compact Visual Density

**Pattern from Raycast/Alfred:**
- 8-12 items visible without scrolling
- Minimal padding (8-12px vertical per item)
- Single-line titles with ellipsis

**Current State in Arcify:**
```css
.arcify-spotlight-result-item {
    padding: 12px 24px 12px 20px;
    min-height: 44px;
}
.arcify-spotlight-results {
    max-height: 270px;
}
```
This allows roughly 6 items visible (270px / 44px min-height).

**Gap Analysis:**
- Requested: Reduce padding for more density
- Target: 10+ items visible
- Suggested padding: `8px 20px 8px 16px` with `min-height: 36px`

### 2.4 Smart Substring Matching

**Pattern from VS Code Command Palette:**
- Fuzzy matching with character highlighting
- Matches across word boundaries (e.g., "gp" matches "Git Push")
- Substring matches in both title and URL

**Current State in Arcify:**
`base-data-provider.js` uses `calculateRelevanceScore()` with:
- Exact title match bonus (+20)
- Title starts with query (+15)
- Title contains query (+10)
- URL contains query (+5)

**Gap Analysis:**
- Current matching is substring-based, which is good
- Missing: fuzzy/acronym matching (e.g., "gp" for "Git Push")
- Missing: highlight of matched characters in results

### 2.5 Source Badges/Indicators

**Pattern from Raycast:**
Show a small badge or icon indicating the source of each result (Tab icon, Bookmark star, History clock).

**Current State in Arcify:**
Results have `type` field but no visible indicator in UI.

**Gap Analysis:**
- Adding subtle source indicators would help users understand why a result appears
- Simple: small icon or text badge showing "Tab" / "Bookmark" / "History"

---

## 3. Anti-Features (Common Pitfalls to Avoid)

### 3.1 Over-Aggressive Deduplication

**Pitfall:** Removing results that look the same but have different intents.

**Example:**
- `github.com/user/repo` (Open Tab)
- `github.com/user/repo/issues` (History)
These are different pages and should NOT be deduplicated.

**Recommendation:** Only deduplicate exact URL matches after normalization. Include path in comparison.

**Current State:** Arcify's deduplication normalizes full URLs including paths, which is correct.

### 3.2 Slow Typing Feedback

**Pitfall:** Waiting for all async results before showing anything.

**Recommendation:** Always show instant suggestions immediately. Update async results when ready without replacing instant.

**Current State:** Arcify correctly uses two-phase architecture (instant + async).

### 3.3 Layout Shift During Updates

**Pitfall:** Results jumping around as async data arrives.

**Recommendation:**
- Maintain selected index when results update (or smart re-selection)
- Don't change result order for items already visible

**Current State:** `selectionManager.updateResults()` resets to index 0. Consider preserving selection if the selected URL is still in results.

### 3.4 Over-Complicated Result Actions

**Pitfall:** Having different actions for Enter vs Cmd+Enter vs Tab+Enter.

**Recommendation:** Keep it simple:
- Enter: Primary action (navigate)
- Escape: Close
- Modifier+Enter: Secondary action (e.g., open in new tab)

**Current State:** Arcify has two modes (current-tab, new-tab) which is appropriate. The mode is clear from the placeholder text.

### 3.5 Ignoring Chrome Native Behavior

**Pitfall:** Fighting against Chrome's expected keyboard shortcuts.

**Recommendation:** Don't override Cmd+L (address bar), Cmd+T (new tab), etc. The spotlight should feel like an addition, not a replacement.

**Current State:** Arcify is activated via custom hotkeys, not overriding system shortcuts. Good.

---

## 4. Specific Implementation Recommendations

### 4.1 Deduplication Enhancement

**Recommendation:** Add fragment and query param handling:

```javascript
normalizeUrlForDeduplication(url) {
    if (!url) return '';
    let normalized = url.toLowerCase();
    normalized = normalized.replace(/\/+$/, '');
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');
    // NEW: Remove hash fragments for deduplication
    normalized = normalized.split('#')[0];
    // NEW: Sort query params for consistent comparison
    // OR: Remove query params entirely for more aggressive dedup
    return normalized;
}
```

### 4.2 URL Preview Implementation

**Recommendation:** Add preview element in input wrapper:

```html
<div class="arcify-spotlight-input-wrapper">
    <svg class="arcify-spotlight-search-icon">...</svg>
    <input class="arcify-spotlight-input" ...>
    <div class="arcify-spotlight-url-preview"></div>
</div>
```

Update on selection change:
```javascript
selectionManager.updateVisualSelection = function() {
    // ... existing code ...
    const selected = this.getSelectedResult();
    const preview = document.querySelector('.arcify-spotlight-url-preview');
    if (preview && selected?.url) {
        preview.textContent = selected.url;
    }
}
```

### 4.3 Padding Reduction

**Recommendation:** Update CSS:

```css
.arcify-spotlight-result-item {
    padding: 8px 20px 8px 16px;  /* Was: 12px 24px 12px 20px */
    min-height: 36px;            /* Was: 44px */
}
.arcify-spotlight-results {
    max-height: 360px;           /* Was: 270px - now fits ~10 items */
}
```

### 4.4 Tab Matching Improvement

**Issue:** "Correctly show open tabs in suggestions when input matches tab name/URL"

**Root Cause Analysis:**
The `getOpenTabs()` method in `base-data-provider.js` returns all tabs, and filtering happens in `scoreAndSortResults()`. The score bonuses might not be sufficient to surface matching tabs above other results.

**Recommendation:**
1. Verify tabs are being filtered/scored correctly
2. Increase `SCORE_BONUSES.EXACT_TITLE_MATCH` and `TITLE_CONTAINS` for open tabs
3. Consider a separate "Tab:" prefix search mode (like VS Code's ">" for commands)

### 4.5 Arcify Bookmark Integration

**Recommendation:** For detecting Arcify bookmark folder membership:

```javascript
async isInArcifyFolder(bookmarkUrl) {
    const arcifyFolders = await this.getArcifyFolders(); // Get Arcify-specific folders
    const bookmarks = await chrome.bookmarks.search({ url: bookmarkUrl });
    for (const bookmark of bookmarks) {
        if (this.isChildOfArcifyFolder(bookmark.parentId, arcifyFolders)) {
            return true;
        }
    }
    return false;
}
```

Then adjust result wording: "Open in Arcify" vs "Navigate to"

---

## 5. Matching Algorithm Comparison

| Tool | Primary Match | Secondary Match | Fuzzy Support |
|------|---------------|-----------------|---------------|
| Chrome Omnibox | URL prefix | Title contains | No |
| Arc Browser | Full fuzzy | URL + Title | Yes (fzf-style) |
| Raycast | Acronym + Fuzzy | Full text | Yes |
| Alfred | Word boundary | Fuzzy | Yes |
| VS Code | Fuzzy with highlight | Commands first | Yes |
| **Arcify (current)** | Title/URL contains | Popularity sites | Partial |

**Recommendation:** Consider adding fzf-style fuzzy matching for power users, but keep current substring matching as default.

---

## 6. Quality Gate Checklist

- [x] UX patterns from established tools (Arc, Raycast, Alfred, VS Code) - Documented above
- [x] Deduplication best practices - Section 1.1 and 4.1
- [x] Keyboard navigation standards - Section 1.2
- [x] Visual feedback patterns - Section 1.3, 2.1, 2.3
- [x] Common pitfalls in command palette UX - Section 3

---

## 7. Priority Matrix for Improvements

| Feature | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| URL preview on keyboard nav | HIGH | LOW | HIGH |
| Reduce padding/density | HIGH | LOW | MEDIUM |
| Fix tab matching | HIGH | MEDIUM | HIGH |
| Dynamic color theming | MEDIUM | LOW | MEDIUM |
| Arcify folder detection | MEDIUM | MEDIUM | MEDIUM |
| Duplicate elimination fixes | HIGH | LOW | HIGH |
| Selection preservation on update | LOW | MEDIUM | LOW |
| Source badges | LOW | LOW | LOW |
| Fuzzy/acronym matching | LOW | HIGH | MEDIUM |

---

## References

- Arc Browser Command Bar: Visual density, color theming, URL preview
- Raycast: Keyboard shortcuts, result grouping, instant search
- Alfred: Workflow integration, fuzzy matching
- VS Code Command Palette: Fuzzy matching with highlights, command prefixes
- Chrome Omnibox: Native autocomplete behavior, history integration

---

*Research compiled from analysis of existing codebase patterns and industry-standard command palette implementations.*
