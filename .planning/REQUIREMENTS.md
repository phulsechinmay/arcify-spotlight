# Requirements: Arcify Spotlight v2.1

**Defined:** 2026-02-09
**Core Value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome

## v2.1 Requirements

Requirements for the Test Coverage Audit milestone. Each maps to roadmap phases.

### Audit

- [ ] **AUDIT-01**: Run V8 coverage analysis and produce coverage report with per-module line/branch/function metrics
- [ ] **AUDIT-02**: Map each source module to its test files with gap classification (untested, partially tested, well tested)
- [ ] **AUDIT-03**: Produce prioritized gap list with risk assessment, present to user for approval before implementing

### Utility Tests

- [ ] **UTIL-01**: Add unit tests for `bookmark-utils.js` — folder detection, tree traversal, import handling
- [ ] **UTIL-02**: Add unit tests for `website-name-extractor.js` — domain name parsing and extraction
- [ ] **UTIL-03**: Add unit tests for `popular-sites.js` — comprehensive coverage beyond existing `findMatchingDomains` tests

### Provider Tests

- [ ] **PROV-01**: Add unit tests for `autocomplete-provider.js` — Chrome search API integration, result formatting
- [ ] **PROV-02**: Add unit tests for `background-data-provider.js` — data aggregation, parallel fetch orchestration, enrichment pipeline

### Component Tests

- [ ] **COMP-01**: Add unit tests for `shared-component-logic.js` — input handling, overlay lifecycle, suggestion rendering
- [ ] **COMP-02**: Add unit tests for `message-client.js` — message serialization, error handling, response parsing

### Low Priority

- [ ] **LOW-01**: Add unit tests for `logger.js` — log levels, formatting
- [ ] **LOW-02**: Assess `styling.js` testability and add tests if meaningful
- [ ] **LOW-03**: Audit `utils.js` and add tests for any non-trivial logic

### E2E Maintenance

- [ ] **E2E-01**: Investigate why E2E tests were disabled in CI and determine path to re-enable

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual regression testing | Requires browser-based screenshot comparison tooling, different milestone |
| Performance benchmarking | Separate concern from coverage gaps |
| TypeScript migration | Out of scope for test-focused milestone |
| New feature tests | Only covering existing untested code, not new features |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | TBD | Pending |
| AUDIT-02 | TBD | Pending |
| AUDIT-03 | TBD | Pending |
| UTIL-01 | TBD | Pending |
| UTIL-02 | TBD | Pending |
| UTIL-03 | TBD | Pending |
| PROV-01 | TBD | Pending |
| PROV-02 | TBD | Pending |
| COMP-01 | TBD | Pending |
| COMP-02 | TBD | Pending |
| LOW-01 | TBD | Pending |
| LOW-02 | TBD | Pending |
| LOW-03 | TBD | Pending |
| E2E-01 | TBD | Pending |

**Coverage:**
- v2.1 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after initial definition*
