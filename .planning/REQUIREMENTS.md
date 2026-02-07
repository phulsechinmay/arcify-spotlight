# Requirements: Arcify Spotlight v2.0

**Defined:** 2026-02-06
**Core Value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome

## v2.0 Requirements

Requirements for Fuse.js search architecture. Each maps to roadmap phases.

### Matching Engine

- [ ] **MATCH-01**: All data sources use Fuse.js for fuzzy matching instead of hand-rolled fuzzyMatch()
- [ ] **MATCH-02**: Title matches weighted higher than URL matches via Fuse.js field weights
- [ ] **MATCH-03**: Match threshold configured to eliminate false positives on short queries (e.g., 2-3 char)
- [ ] **MATCH-04**: Each result includes a match quality score (0-1) from Fuse.js
- [ ] **MATCH-05**: Bookmarks use Fuse.js matching (replacing Chrome's substring-only search)

### Scoring System

- [ ] **SCORE-01**: Scoring uses weighted multi-signal formula (type + matchQuality + recency + frequency)
- [ ] **SCORE-02**: Source type priority preserved (open tabs > pinned tabs > bookmarks > history > top sites > autocomplete)
- [ ] **SCORE-03**: History results incorporate recency signal (recently visited pages score higher)
- [ ] **SCORE-04**: History results incorporate frequency signal (frequently visited pages score higher)
- [ ] **SCORE-05**: Autocomplete suggestions score competitively when few local results match

### Performance

- [ ] **PERF-01**: Data sources fetched in parallel via Promise.all() instead of sequential awaits
- [ ] **PERF-02**: Double debouncing eliminated (single debounce layer, not overlay 150ms + SearchEngine 150ms)
- [ ] **PERF-03**: Local results display immediately while autocomplete results append when ready (progressive rendering)

### Regression Safety

- [ ] **REG-01**: All existing tests pass after migration (300+ tests)
- [ ] **REG-02**: Deduplication, Arcify enrichment, and action routing unchanged

## Future Requirements

Deferred to later milestones.

### Search Learning (v2.1+)

- **LEARN-01**: User selections tracked and used to boost frequently chosen results
- **LEARN-02**: Selection history pruned automatically to prevent unbounded storage growth

### Space Chip UI (deferred from v1.5)

- **CHIP-01**: Space name chip appears below Arcify suggestion items
- **CHIP-02**: Chip color matches tab group color
- **CHIP-03**: Chip is static/non-interactive
- **CHIP-04**: Chip has WCAG 3:1 contrast ratio
- **CHIP-05**: Feature degrades gracefully when Arcify folder not found

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pre-built unified search index | Over-engineering for current data volume; Fuse.js per-source is sufficient |
| Selection learning | High effort, deferred to v2.1+ |
| Dynamic result count | Minor UX improvement, not part of core architecture change |
| Space-aware scoring boost | Depends on CHIP UI which is deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MATCH-01 | Phase 9 | Pending |
| MATCH-02 | Phase 9 | Pending |
| MATCH-03 | Phase 9 | Pending |
| MATCH-04 | Phase 9 | Pending |
| MATCH-05 | Phase 9 | Pending |
| SCORE-01 | Phase 10 | Pending |
| SCORE-02 | Phase 10 | Pending |
| SCORE-03 | Phase 10 | Pending |
| SCORE-04 | Phase 10 | Pending |
| SCORE-05 | Phase 10 | Pending |
| PERF-01 | Phase 11 | Pending |
| PERF-02 | Phase 11 | Pending |
| PERF-03 | Phase 11 | Pending |
| REG-01 | Phase 12 | Pending |
| REG-02 | Phase 12 | Pending |

**Coverage:**
- v2.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 — All 15 requirements mapped to Phases 9-12*
