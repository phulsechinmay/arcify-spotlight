# Requirements: Arcify Spotlight v2.0

**Defined:** 2026-02-06
**Core Value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome

## v2.0 Requirements

Requirements for Fuse.js search architecture. Each maps to roadmap phases.

### Matching Engine

- [x] **MATCH-01**: All data sources use Fuse.js for fuzzy matching instead of hand-rolled fuzzyMatch()
- [x] **MATCH-02**: Title matches weighted higher than URL matches via Fuse.js field weights
- [x] **MATCH-03**: Match threshold configured to eliminate false positives on short queries (e.g., 2-3 char)
- [x] **MATCH-04**: Each result includes a match quality score (0-1) from Fuse.js
- [x] **MATCH-05**: Bookmarks use Fuse.js matching (replacing Chrome's substring-only search)

### Scoring System

- [x] **SCORE-01**: Scoring uses weighted multi-signal formula (type + matchQuality + recency + frequency)
- [x] **SCORE-02**: Source type priority preserved (open tabs > pinned tabs > bookmarks > history > top sites > autocomplete)
- [x] **SCORE-03**: History results incorporate recency signal (recently visited pages score higher)
- [x] **SCORE-04**: History results incorporate frequency signal (frequently visited pages score higher)
- [x] **SCORE-05**: Autocomplete suggestions score competitively when few local results match

### Performance

- [x] **PERF-01**: Data sources fetched in parallel via Promise.all() instead of sequential awaits
- [x] **PERF-02**: Double debouncing eliminated (single debounce layer, not overlay 150ms + SearchEngine 150ms)
- [x] **PERF-03**: Local results display immediately while autocomplete results append when ready (progressive rendering)

### Regression Safety

- [x] **REG-01**: All existing tests pass after migration (300+ tests)
- [x] **REG-02**: Deduplication, Arcify enrichment, and action routing unchanged

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
| MATCH-01 | Phase 9 | Complete |
| MATCH-02 | Phase 9 | Complete |
| MATCH-03 | Phase 9 | Complete |
| MATCH-04 | Phase 9 | Complete |
| MATCH-05 | Phase 9 | Complete |
| SCORE-01 | Phase 10 | Complete |
| SCORE-02 | Phase 10 | Complete |
| SCORE-03 | Phase 10 | Complete |
| SCORE-04 | Phase 10 | Complete |
| SCORE-05 | Phase 10 | Complete |
| PERF-01 | Phase 11 | Complete |
| PERF-02 | Phase 11 | Complete |
| PERF-03 | Phase 11 | Complete |
| REG-01 | Phase 12 | Complete |
| REG-02 | Phase 12 | Complete |

**Coverage:**
- v2.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-07 — 15/15 requirements complete (all v2.0 requirements satisfied)*
