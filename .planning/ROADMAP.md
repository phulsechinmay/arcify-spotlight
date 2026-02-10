# Roadmap: Arcify Spotlight

## Milestones

- ✅ **v1.0 Polish** - Phases 1-2 (shipped 2026-02-04)
- ✅ **v1.01 Testing** - Phases 3-4 (shipped 2026-02-04)
- ✅ **v1.5 Arcify Integration** - Phases 5-8 (shipped 2026-02-06)
- ✅ **v2.0 Fuse.js Search** - Phases 9-12 (shipped 2026-02-07)
- 🚧 **v2.1 Test Coverage Audit** - Phases 13-16 (in progress)

## Phases

<details>
<summary>v1.0 through v2.0 (Phases 1-12) -- SHIPPED</summary>

Prior milestones delivered: bug fixes, UX polish, testing infrastructure (240 tests), Arcify bookmark integration, Fuse.js search with weighted scoring, parallel fetch, progressive rendering (337 tests). See PROJECT.md Completed Milestones for details.

</details>

### v2.1 Test Coverage Audit (In Progress)

**Milestone Goal:** Comprehensive blind audit of test coverage across all source modules, identify gaps with risk assessment, and fill them with user-approved tests to build a solid safety net for future feature work.

**Phase Numbering:**
- Integer phases (13, 14, 15, 16): Planned milestone work
- Decimal phases (e.g., 14.1): Urgent insertions if needed (marked with INSERTED)

- [ ] **Phase 13: Audit & Coverage Report** - Produce coverage analysis and prioritized gap list for user review
- [ ] **Phase 14: Utility Module Tests** - Test bookmark-utils, website-name-extractor, popular-sites
- [ ] **Phase 15: Provider & Component Tests** - Test data providers and component logic
- [ ] **Phase 16: Low Priority Tests & E2E** - Remaining tests and CI investigation

## Phase Details

### Phase 13: Audit & Coverage Report
**Goal**: User has a complete, data-driven picture of test coverage across every source module, with a prioritized gap list they can review and approve before any test writing begins
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. A coverage report exists showing line, branch, and function metrics for every source module in `shared/`
  2. Every source module is mapped to its test file(s) with a gap classification of untested, partially tested, or well tested
  3. A prioritized gap list exists ranking modules by risk (code complexity, change frequency, user-facing impact)
  4. The gap list has been presented to the user and their approval captured before any test implementation begins
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

### Phase 14: Utility Module Tests
**Goal**: The three utility modules (bookmark-utils, website-name-extractor, popular-sites) have thorough unit test coverage validating their core logic paths
**Depends on**: Phase 13 (gap list approved by user)
**Requirements**: UTIL-01, UTIL-02, UTIL-03
**Success Criteria** (what must be TRUE):
  1. `bookmark-utils.js` has tests covering folder detection, tree traversal, and import handling -- all passing
  2. `website-name-extractor.js` has tests covering domain name parsing, extraction edge cases, and malformed URLs -- all passing
  3. `popular-sites.js` has tests that go beyond the existing `findMatchingDomains` tests to cover additional exported functions and edge cases -- all passing
  4. Running `npx vitest run` shows all new utility tests passing alongside existing 337 tests with no regressions
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD
- [ ] 14-03: TBD

### Phase 15: Provider & Component Tests
**Goal**: The data provider and component logic modules have unit tests covering their integration points, data flow, and error handling
**Depends on**: Phase 13 (gap list approved by user)
**Requirements**: PROV-01, PROV-02, COMP-01, COMP-02
**Success Criteria** (what must be TRUE):
  1. `autocomplete-provider.js` has tests covering Chrome search API integration mocking, result formatting, and error/empty-result paths -- all passing
  2. `background-data-provider.js` has tests covering data aggregation, parallel fetch orchestration (Promise.allSettled), enrichment pipeline, and partial-failure scenarios -- all passing
  3. `shared-component-logic.js` has tests covering input handling, overlay lifecycle (show/hide/toggle), and suggestion rendering logic -- all passing
  4. `message-client.js` has tests covering message serialization, error handling, response parsing, and timeout scenarios -- all passing
  5. Running `npx vitest run` shows all new provider and component tests passing with no regressions
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: Low Priority Tests & E2E Maintenance
**Goal**: Remaining low-priority modules are assessed and tested where meaningful, and the E2E CI situation is investigated with a clear path forward
**Depends on**: Phase 13 (gap list approved by user)
**Requirements**: LOW-01, LOW-02, LOW-03, E2E-01
**Success Criteria** (what must be TRUE):
  1. `logger.js` has unit tests covering log levels and formatting -- all passing
  2. `styling.js` has been assessed for testability; tests exist if the module contains meaningful testable logic, or a documented rationale explains why tests were skipped
  3. `utils.js` has been audited and any non-trivial logic has corresponding tests -- all passing
  4. The root cause of E2E tests being disabled in CI (commit b991caa) is documented, and a concrete next step (re-enable, fix, or defer with rationale) is determined
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

## Progress

**Execution Order:**
Phase 13 executes first. Phases 14, 15, and 16 can execute in parallel after Phase 13 approval (they are independent of each other).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 13. Audit & Coverage Report | v2.1 | 0/TBD | Not started | - |
| 14. Utility Module Tests | v2.1 | 0/TBD | Not started | - |
| 15. Provider & Component Tests | v2.1 | 0/TBD | Not started | - |
| 16. Low Priority Tests & E2E | v2.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-09*
*Last updated: 2026-02-09*
