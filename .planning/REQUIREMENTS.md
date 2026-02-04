# Requirements: Arcify Spotlight v1.01

**Defined:** 2026-02-04
**Core Value:** Fast, keyboard-driven tab and URL navigation that feels native to Chrome

## v1.01 Requirements

Requirements for testing infrastructure. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Developer can run unit tests with `npm test`
- [ ] **INFRA-02**: Developer can run E2E tests with `npm run test:e2e`
- [ ] **INFRA-03**: Tests run automatically on git push via CI/CD
- [ ] **INFRA-04**: Test coverage reports are generated

### Unit Tests - Pure Logic

- [ ] **UNIT-01**: URL normalization handles all edge cases (fragments, trailing slashes, www, protocol)
- [ ] **UNIT-02**: Deduplication correctly prioritizes open tabs over history
- [ ] **UNIT-03**: Fuzzy matching works for character-in-sequence patterns (ghub→GitHub)
- [ ] **UNIT-04**: Relevance scoring applies bonuses correctly
- [ ] **UNIT-05**: URL detection (isURL) handles domains, localhost, IPs, and rejects search queries
- [ ] **UNIT-06**: Selection manager navigates correctly (up/down/home/end bounds)

### Unit Tests - Chrome API Mocks

- [ ] **MOCK-01**: SearchEngine caching returns cached results within TTL
- [ ] **MOCK-02**: SearchEngine debouncing prevents rapid-fire API calls
- [ ] **MOCK-03**: Action routing calls correct Chrome APIs for each result type

### Integration Tests

- [ ] **INT-01**: Message passing delivers queries from overlay to background
- [ ] **INT-02**: Message passing returns results from background to overlay
- [ ] **INT-03**: Spotlight activation flow works end-to-end

### E2E Tests

- [ ] **E2E-01**: Full search flow works (open spotlight → type → see results → select → navigate)
- [ ] **E2E-02**: Keyboard navigation works (arrow keys, enter, escape)
- [ ] **E2E-03**: Tab switching activates correct tab

## Future Requirements

Deferred to later milestones.

### Accessibility Testing

- **A11Y-01**: Spotlight dialog passes axe-core accessibility audit
- **A11Y-02**: Screen reader announces selection changes

### Performance Testing

- **PERF-01**: Cached search returns in under 50ms
- **PERF-02**: Fresh search returns in under 200ms

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual regression tests | CSS is simple and stable |
| Cross-browser testing | Chrome-only extension |
| Mutation testing | Overkill for focused codebase |
| Load/stress testing | Unlikely to hit scale issues |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| UNIT-01 | Phase 2 | Pending |
| UNIT-02 | Phase 2 | Pending |
| UNIT-03 | Phase 2 | Pending |
| UNIT-04 | Phase 2 | Pending |
| UNIT-05 | Phase 2 | Pending |
| UNIT-06 | Phase 2 | Pending |
| MOCK-01 | Phase 3 | Pending |
| MOCK-02 | Phase 3 | Pending |
| MOCK-03 | Phase 3 | Pending |
| INT-01 | Phase 4 | Pending |
| INT-02 | Phase 4 | Pending |
| INT-03 | Phase 4 | Pending |
| E2E-01 | Phase 5 | Pending |
| E2E-02 | Phase 5 | Pending |
| E2E-03 | Phase 5 | Pending |

**Coverage:**
- v1.01 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-04*
