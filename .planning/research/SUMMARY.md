# Research Summary: Chrome Extension Testing

**Milestone:** v1.01 Testing Infrastructure
**Researched:** 2026-02-04
**Confidence:** HIGH (official Chrome documentation + community best practices)

## Key Findings

### Recommended Stack

| Tool | Purpose | Why |
|------|---------|-----|
| **Vitest** | Unit/integration tests | 10-20x faster than Jest, native ESM support, works with Vite |
| **Puppeteer** | E2E tests | Chrome-focused, official support, simpler than Playwright for single-browser |
| **sinon-chrome** or manual mocks | Chrome API mocking | Well-documented, comprehensive coverage |

### Testing Pyramid

```
                /\
               / E2E \        3-5 tests (critical flows only)
              /--------\
             / Integration \   10-15 tests (message passing)
            /--------------\
           /   Unit Tests    \  50+ tests (pure logic)
          /==================\
```

### Table Stakes (Must Have)

1. **Unit tests for pure logic** (~50+ tests)
   - `normalizeUrlForDeduplication()` - URL handling edge cases
   - `deduplicateResults()` - priority-based deduplication
   - `fuzzyMatch()` - character-in-sequence matching
   - `calculateRelevanceScore()` - scoring logic
   - `isURL()` - URL detection patterns
   - `SelectionManager` - navigation state

2. **Unit tests with Chrome API mocks** (~15-20 tests)
   - `SearchEngine` caching and debouncing
   - `handleResultAction()` routing
   - Message handlers in background.js

3. **Integration tests** (~10-15 tests)
   - Message passing flows (background <-> content script)
   - Spotlight activation sequence
   - Search -> results pipeline

4. **E2E tests** (3-5 tests)
   - Full search flow (open -> type -> select -> navigate)
   - Keyboard navigation (arrows, enter, escape)
   - Fallback behavior (restricted URL -> new tab)

### Differentiators (Nice to Have)

- **Accessibility tests** - axe-core for ARIA compliance
- **Performance tests** - Search latency <50ms cached, <200ms fresh

### Anti-Features (Skip)

- Visual regression testing (CSS is simple and stable)
- Cross-browser testing (Chrome-only extension)
- Mutation testing (overkill for focused codebase)
- Contract testing for messages (TypeScript sufficient)
- Load/stress testing (unlikely to hit scale issues)

## Implementation Phases

1. **Phase 1: Test infrastructure setup**
   - Vitest configuration with Chrome API mocks
   - Test directory structure
   - CI/CD pipeline

2. **Phase 2: Unit tests for pure logic** (highest ROI)
   - URL normalization, deduplication, fuzzy matching
   - Scoring logic, selection state

3. **Phase 3: Integration tests**
   - Message passing, Chrome API usage

4. **Phase 4: E2E tests**
   - Puppeteer setup with extension loading
   - Critical user flow tests

## Watch Out For

1. **Flaky E2E tests** - Use minimal E2E, more unit tests
2. **Chrome API mocking complexity** - Mock only what you use
3. **Service worker termination** - State persistence in tests
4. **Async timing issues** - Proper await/Promise handling

## Sources

- [Chrome Extensions Unit Testing](https://developer.chrome.com/docs/extensions/how-to/test/unit-testing)
- [Chrome Extensions E2E Testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Puppeteer Chrome Extension Testing](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)

---

*Research synthesized: 2026-02-04*
