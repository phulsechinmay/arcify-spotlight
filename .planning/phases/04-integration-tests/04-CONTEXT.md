# Phase 4: Integration Tests - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Test message passing between content scripts and background script. Verify that queries flow from overlay to background, results flow back to overlay, and the spotlight activation sequence completes correctly.

Requirements:
- INT-01: Message passing delivers queries from overlay to background
- INT-02: Message passing returns results from background to overlay
- INT-03: Spotlight activation flow works end-to-end

</domain>

<decisions>
## Implementation Decisions

### Testing Approach
- Trigger handlers via mocked onMessage.addListener flow (not direct handler calls)
- Use real timers (not vi.useFakeTimers) - different from unit tests
- Ensure all tests pass: run `npm run test` to verify old and new tests

### Message Coverage
- Cover all message types:
  - Search queries (SPOTLIGHT_SEARCH)
  - Result delivery (search results back to overlay)
  - Tab actions (ACTIVATE_TAB, CREATE_TAB)
  - Activation sequence (INJECT_SPOTLIGHT, ACTIVATE_SPOTLIGHT, SPOTLIGHT_READY)
- Test comprehensive error scenarios (timeouts, malformed messages, handler errors, connection failures)
- Use full round-trip testing for search flow (query → search → results as single test)
- Verify SearchEngine is called with correct parameters

### Test Structure
- Separate directory: test/integration/
- Tests in this directory are integration tests, distinct from unit tests

### Activation Flow
- Test full sequence: inject → activate → ready
- Test double-activation handling (spotlight triggered when already open)
- Test full lifecycle: activate → use → close
- Include DOM verification (verify overlay element appears)

### Claude's Discretion
- Mock isolation level (fully mocked vs partial real)
- Message format strictness (strict vs behavior only)
- Test file organization within test/integration/
- Setup file approach (shared vs separate)
- Test patterns (describe/it nesting level)

</decisions>

<specifics>
## Specific Ideas

- Full flow testing: trigger via mocked onMessage.addListener rather than calling handlers directly
- Real timers for more realistic integration behavior
- Verify SearchEngine.getSpotlightSuggestionsUsingCache() and handleResultAction() are called correctly
- DOM assertions for activation tests

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-integration-tests*
*Context gathered: 2026-02-05*
