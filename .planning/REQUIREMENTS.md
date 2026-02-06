# Requirements: Arcify Spotlight v1.5

**Defined:** 2026-02-05
**Core Value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome

## v1.5 Requirements

Requirements for Arcify integration. Each maps to roadmap phases.

### Detection & Caching

- [x] **DET-01**: Extension detects Arcify folder in Chrome bookmarks on startup
- [x] **DET-02**: Extension caches URL-to-space mapping with O(1) lookup performance
- [x] **DET-03**: Cache refreshes automatically when bookmarks change (onCreated, onRemoved, onMoved, onChanged)
- [x] **DET-04**: URL normalization ensures reliable matching (trailing slashes, protocols, www prefix)

### Wording Changes

- [x] **WORD-01**: Action text shows "Open pinned tab" for Arcify-bookmarked tabs
- [x] **WORD-02**: Action text shows "Open favorite tab" for Chrome-pinned Arcify tabs
- [x] **WORD-03**: Non-Arcify tabs keep existing "Switch to tab" wording unchanged

### Space Chip UI

- [ ] **CHIP-01**: Space name chip appears below Arcify suggestion items
- [ ] **CHIP-02**: Chip color matches tab group color (using existing color palette)
- [ ] **CHIP-03**: Chip is static/non-interactive (keyboard navigation unchanged)
- [ ] **CHIP-04**: Chip has WCAG 3:1 contrast ratio (dark text on light colors)
- [ ] **CHIP-05**: Feature degrades gracefully when Arcify folder not found (no chips, no errors)

## Future Requirements

Deferred to later milestones.

### Scoring Enhancements (v2.0)

- **SCORE-01**: Results from user's active space receive scoring boost
- **SCORE-02**: Space filter chips allow narrowing search to specific space

### Accessibility (v2.0)

- **A11Y-01**: Screen reader announces space name for Arcify suggestions
- **A11Y-02**: Spotlight dialog passes axe-core accessibility audit

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive space chips | Violates static badge pattern, causes focus confusion |
| Multi-space indicators | Edge case (same URL in multiple spaces), rare scenario |
| Cross-extension messaging | Adds complexity, bookmark detection is sufficient |
| Space filter keyboard shortcuts | Power feature, not needed for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | Phase 6 | Complete |
| DET-02 | Phase 6 | Complete |
| DET-03 | Phase 6 | Complete |
| DET-04 | Phase 6 | Complete |
| WORD-01 | Phase 7 | Complete |
| WORD-02 | Phase 7 | Complete |
| WORD-03 | Phase 7 | Complete |
| CHIP-01 | Phase 8 | Pending |
| CHIP-02 | Phase 8 | Pending |
| CHIP-03 | Phase 8 | Pending |
| CHIP-04 | Phase 8 | Pending |
| CHIP-05 | Phase 8 | Pending |

**Coverage:**
- v1.5 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Phase mappings added: 2026-02-05*
