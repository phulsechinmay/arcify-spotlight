# Roadmap: Arcify Spotlight v1.01 Testing Infrastructure

**Milestone:** v1.01 Testing Infrastructure
**Created:** 2026-02-04
**Phases:** 5
**Depth:** Standard

## Overview

This milestone establishes a comprehensive testing infrastructure for Arcify Spotlight. Following the testing pyramid approach, we build from infrastructure setup through unit tests (pure logic, then mocked APIs), integration tests for message passing, and finally E2E tests for critical user flows. The goal is fast feedback loops with high coverage of the codebase's isolated pure functions.

## Phases

### Phase 1: Test Infrastructure Setup

**Goal:** Developer can run tests locally and in CI with coverage reporting

**Dependencies:** None (foundation phase)

**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md — Configure Vitest, Puppeteer, and GitHub Actions CI

**Requirements:**
- INFRA-01: Developer can run unit tests with `npm test`
- INFRA-02: Developer can run E2E tests with `npm run test:e2e`
- INFRA-03: Tests run automatically on git push via CI/CD
- INFRA-04: Test coverage reports are generated

**Success Criteria:**
1. `npm test` executes Vitest and exits cleanly (even with zero tests)
2. `npm run test:e2e` executes Puppeteer test runner and exits cleanly
3. Git push triggers CI workflow that runs tests and reports status
4. Coverage report is generated showing 0% baseline (ready for tests)

---

### Phase 2: Unit Tests - Pure Logic

**Goal:** Core logic functions are tested with fast, deterministic unit tests

**Dependencies:** Phase 1 (infrastructure must exist)

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — URL utilities and deduplication tests (UNIT-01, UNIT-02, UNIT-05)
- [x] 02-02-PLAN.md — Fuzzy matching and scoring tests (UNIT-03, UNIT-04)
- [x] 02-03-PLAN.md — Selection manager tests (UNIT-06)

**Requirements:**
- UNIT-01: URL normalization handles all edge cases
- UNIT-02: Deduplication correctly prioritizes open tabs over history
- UNIT-03: Fuzzy matching works for character-in-sequence patterns
- UNIT-04: Relevance scoring applies bonuses correctly
- UNIT-05: URL detection handles domains, localhost, IPs, rejects search queries
- UNIT-06: Selection manager navigates correctly

**Success Criteria:**
1. URL normalization tests cover fragments, trailing slashes, www, and protocol edge cases
2. Deduplication tests verify open tabs win over history/bookmarks for same URL
3. Fuzzy matching tests verify "ghub" matches "GitHub" and rejects out-of-order characters
4. Selection manager tests verify up/down/home/end navigation stays within bounds

---

### Phase 3: Unit Tests - Chrome API Mocks

**Goal:** Chrome API-dependent code is tested with mocked APIs

**Dependencies:** Phase 1 (infrastructure), Phase 2 (pure logic patterns established)

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Extend Chrome mock + cache tests (MOCK-01)
- [x] 03-02-PLAN.md — Debounce tests + action routing tests (MOCK-02, MOCK-03)

**Requirements:**
- MOCK-01: SearchEngine caching returns cached results within TTL
- MOCK-02: SearchEngine debouncing prevents rapid-fire API calls
- MOCK-03: Action routing calls correct Chrome APIs for each result type

**Success Criteria:**
1. Cache tests verify second identical query returns cached results without API call
2. Debounce tests verify rapid queries (< debounce window) trigger only one API call
3. Action routing tests verify tab switch calls chrome.tabs.update, new URL calls chrome.tabs.create

---

### Phase 4: Integration Tests

**Goal:** Message passing between content scripts and background script works correctly

**Dependencies:** Phase 3 (mocking patterns established)

**Plans:** 2 plans

Plans:
- [ ] 04-01-PLAN.md — Extend Chrome mock with callListeners + integration setup
- [ ] 04-02-PLAN.md — Message passing tests + activation flow tests

**Requirements:**
- INT-01: Message passing delivers queries from overlay to background
- INT-02: Message passing returns results from background to overlay
- INT-03: Spotlight activation flow works end-to-end

**Success Criteria:**
1. Search query message from content script reaches background and triggers search
2. Search results message from background reaches content script with expected format
3. Spotlight activation message sequence (inject -> activate -> ready) completes correctly

---

### Phase 5: E2E Tests

**Goal:** Critical user flows work end-to-end in a real browser

**Dependencies:** Phase 4 (integration tests validate components work together)

**Plans:** 1 plan

**Requirements:**
- E2E-01: Full search flow works (open -> type -> see results -> select -> navigate)
- E2E-02: Keyboard navigation works (arrow keys, enter, escape)
- E2E-03: Tab switching activates correct tab

**Success Criteria:**
1. User can open spotlight, type a query, see results, and navigate to a result
2. Arrow keys change selection, Enter activates, Escape closes spotlight
3. Selecting an open tab result activates that tab (not opens new tab)

---

## Progress

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1 - Infrastructure | Complete | INFRA-01, INFRA-02, INFRA-03, INFRA-04 | 4/4 |
| 2 - Unit Pure | Complete | UNIT-01, UNIT-02, UNIT-03, UNIT-04, UNIT-05, UNIT-06 | 6/6 |
| 3 - Unit Mocks | Complete | MOCK-01, MOCK-02, MOCK-03 | 3/3 |
| 4 - Integration | Pending | INT-01, INT-02, INT-03 | 0/3 |
| 5 - E2E | Pending | E2E-01, E2E-02, E2E-03 | 0/3 |

**Overall:** 13/19 requirements complete

## Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| INFRA-01 | 1 | npm test command |
| INFRA-02 | 1 | npm run test:e2e command |
| INFRA-03 | 1 | CI/CD pipeline |
| INFRA-04 | 1 | Coverage reports |
| UNIT-01 | 2 | URL normalization |
| UNIT-02 | 2 | Deduplication |
| UNIT-03 | 2 | Fuzzy matching |
| UNIT-04 | 2 | Relevance scoring |
| UNIT-05 | 2 | URL detection |
| UNIT-06 | 2 | Selection manager |
| MOCK-01 | 3 | SearchEngine caching |
| MOCK-02 | 3 | SearchEngine debouncing |
| MOCK-03 | 3 | Action routing |
| INT-01 | 4 | Query delivery |
| INT-02 | 4 | Results return |
| INT-03 | 4 | Activation flow |
| E2E-01 | 5 | Full search flow |
| E2E-02 | 5 | Keyboard navigation |
| E2E-03 | 5 | Tab switching |

**Coverage:** 19/19 requirements mapped

---

*Roadmap created: 2026-02-04*
*Phase 1 planned: 2026-02-04*
*Phase 2 planned: 2026-02-04*
*Phase 3 planned: 2026-02-04*
*Phase 4 planned: 2026-02-05*
