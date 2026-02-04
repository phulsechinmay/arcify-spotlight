# Phase 3: Unit Tests - Chrome API Mocks - Research

**Researched:** 2026-02-04
**Domain:** Vitest fake timers, Chrome API mocking, caching/debouncing test patterns
**Confidence:** HIGH

## Summary

This phase focuses on testing Chrome API-dependent code in SearchEngine and background.js using mocked APIs. The codebase already has a solid foundation: Vitest 4.0.18 with Chrome API mock scaffolding (`test/mocks/chrome.js`) and 151 passing tests from Phase 2 establishing testing patterns.

The key testing targets are:
1. **SearchEngine caching** - 30-second TTL cache with cache key `${query}:${mode}`
2. **SearchEngine debouncing** - 150ms debounce window using setTimeout
3. **Action routing** - `handleResultAction` method that calls different Chrome APIs based on result type

**Primary recommendation:** Use vi.useFakeTimers() with vi.advanceTimersByTimeAsync() for debounce/cache tests, extend chromeMock with chrome.search.query, and follow established table-driven test patterns with it.each() from Phase 2.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0.18 | Test runner with fake timers | Already installed, native ES modules, excellent timer mocking |
| @sinonjs/fake-timers | (bundled) | Underlying timer mock | Vitest uses this internally |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vi.fn() | N/A | Mock function creation | Mocking Chrome API methods |
| vi.useFakeTimers() | N/A | Timer control | Debounce and cache TTL tests |

### Already Configured
- `test/setup.js` - Sets `globalThis.chrome = chromeMock` and resets mocks in beforeEach
- `test/mocks/chrome.js` - Scaffolding for tabs, storage, bookmarks, history, runtime, tabGroups, windows

**No additional installation needed.**

## Architecture Patterns

### Recommended Test Structure
```
test/
├── mocks/
│   └── chrome.js           # Chrome API mocks (EXTEND for chrome.search)
├── setup.js                # Global setup
└── unit/
    ├── search-engine-cache.test.js    # NEW: Cache TTL tests
    ├── search-engine-debounce.test.js # NEW: Debounce tests
    └── action-routing.test.js         # NEW: handleResultAction tests
```

### Pattern 1: Fake Timers with Async Advancement
**What:** Use vi.useFakeTimers() with vi.advanceTimersByTimeAsync() for timer-dependent code
**When to use:** Testing debounce delays, cache TTL expiration
**Example:**
```javascript
// Source: Vitest docs + established Phase 2 patterns
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('SearchEngine caching', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns cached results within TTL', async () => {
        const engine = new SearchEngine(mockProvider);

        // First call - cache miss
        await engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');

        // Advance 15 seconds (within 30s TTL)
        await vi.advanceTimersByTimeAsync(15000);

        // Second call - should hit cache
        await engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');

        // Provider should only be called once
        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
    });
});
```

### Pattern 2: Mock Data Provider for SearchEngine Tests
**What:** Create a minimal mock data provider to inject into SearchEngine
**When to use:** Testing SearchEngine methods independent of real Chrome APIs
**Example:**
```javascript
// Source: search-engine.js constructor requirements
const createMockDataProvider = () => ({
    isBackgroundProvider: true,
    getSpotlightSuggestions: vi.fn().mockResolvedValue([
        { type: 'open-tab', title: 'Test Tab', url: 'https://test.com', metadata: { tabId: 1 } }
    ])
});
```

### Pattern 3: Table-Driven Chrome API Verification
**What:** Use it.each() to test multiple action types call correct Chrome APIs
**When to use:** Testing handleResultAction routing logic
**Example:**
```javascript
// Source: Established pattern from Phase 2 (scoring.test.js, fuzzy-matching.test.js)
describe('handleResultAction Chrome API calls', () => {
    it.each([
        ['open-tab', 'NEW_TAB', 'chrome.tabs.update', { tabId: 1 }],
        ['url-suggestion', 'NEW_TAB', 'chrome.tabs.create', { url: 'https://test.com' }],
        ['url-suggestion', 'CURRENT_TAB', 'chrome.tabs.update', { url: 'https://test.com' }],
        ['search-query', 'NEW_TAB', 'chrome.search.query', { disposition: 'NEW_TAB' }],
    ])('%s in %s mode calls %s', async (resultType, mode, expectedApi, expectedArgs) => {
        // Test implementation
    });
});
```

### Anti-Patterns to Avoid
- **Using synchronous timer advancement:** Use `advanceTimersByTimeAsync` not `advanceTimersByTime` to prevent promise/microtask issues
- **Not clearing timers between tests:** Always pair useFakeTimers with useRealTimers in afterEach
- **Testing implementation details:** Test observable behavior (API calls, return values) not internal cache Map contents

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timer mocking | Manual setTimeout stubs | vi.useFakeTimers() | Handles all timer APIs, microtasks, Date.now() |
| Chrome API mocking | Per-test chrome stubs | Extend existing chromeMock | Consistent across tests, resetChromeMocks() |
| Async assertions | Manual Promise waiting | vi.advanceTimersByTimeAsync | Properly flushes microtasks |

**Key insight:** The existing test infrastructure handles most complexity. Extend `test/mocks/chrome.js` rather than creating separate mock systems.

## Common Pitfalls

### Pitfall 1: Promise/Timer Deadlock in Debounce Tests
**What goes wrong:** Test hangs because async code waiting for timer, timer waiting for microtask
**Why it happens:** Using synchronous `advanceTimersByTime()` with async callbacks
**How to avoid:** Always use `vi.advanceTimersByTimeAsync()` when testing async debounced code
**Warning signs:** Test timeouts, hanging tests

### Pitfall 2: Cache State Pollution Between Tests
**What goes wrong:** Cache from one test affects another
**Why it happens:** SearchEngine instance or its cache persists between tests
**How to avoid:** Create fresh SearchEngine instance in each test's beforeEach
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 3: Forgetting to Mock chrome.search API
**What goes wrong:** Tests fail with "chrome.search is undefined"
**Why it happens:** chrome.search not included in existing chromeMock
**How to avoid:** Add chrome.search to chromeMock before running action routing tests
**Warning signs:** "Cannot read property 'query' of undefined"

### Pitfall 4: Testing Debounce with Exact Timing
**What goes wrong:** Flaky tests that sometimes pass, sometimes fail
**Why it happens:** Testing at exact boundary (e.g., advanceTimersByTime(150) for 150ms debounce)
**How to avoid:** Advance time slightly beyond threshold (e.g., 151ms for 150ms debounce)
**Warning signs:** Intermittent test failures

### Pitfall 5: Not Awaiting Debounced Promise Resolution
**What goes wrong:** Assertions run before debounced callback completes
**Why it happens:** getSpotlightSuggestionsUsingCache returns a Promise that resolves after debounce
**How to avoid:** Always await the result promise after advancing timers
**Warning signs:** Tests checking for calls before they happen

## Code Examples

Verified patterns based on codebase analysis and Vitest documentation:

### SearchEngine Cache Test
```javascript
// Testing cache key: `${query.trim()}:${mode}`
// TTL: 30000ms (CACHE_TTL constant)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchEngine } from '../../shared/search-engine.js';

describe('SearchEngine.getSpotlightSuggestionsUsingCache', () => {
    let engine;
    let mockProvider;

    beforeEach(() => {
        vi.useFakeTimers();
        mockProvider = {
            isBackgroundProvider: true,
            getSpotlightSuggestions: vi.fn().mockResolvedValue([
                { type: 'open-tab', title: 'Result', url: 'https://test.com' }
            ])
        };
        engine = new SearchEngine(mockProvider);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns cached results for identical query within TTL', async () => {
        // First call - triggers debounce and caches
        const promise1 = engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');
        await vi.advanceTimersByTimeAsync(151); // Past 150ms debounce
        await promise1;

        // Second call within 30s TTL - should hit cache immediately
        const promise2 = engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');
        const results = await promise2; // Cache hit, no debounce needed

        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
        expect(results).toHaveLength(1);
    });

    it('fetches fresh results after TTL expires', async () => {
        // First call
        const promise1 = engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');
        await vi.advanceTimersByTimeAsync(151);
        await promise1;

        // Advance past 30s TTL
        await vi.advanceTimersByTimeAsync(30001);

        // Second call - cache expired
        const promise2 = engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');
        await vi.advanceTimersByTimeAsync(151);
        await promise2;

        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(2);
    });
});
```

### SearchEngine Debounce Test
```javascript
// Testing DEBOUNCE_DELAY: 150ms
describe('SearchEngine debouncing', () => {
    let engine;
    let mockProvider;

    beforeEach(() => {
        vi.useFakeTimers();
        mockProvider = {
            isBackgroundProvider: true,
            getSpotlightSuggestions: vi.fn().mockResolvedValue([])
        };
        engine = new SearchEngine(mockProvider);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('rapid queries within debounce window trigger only one API call', async () => {
        // Simulate rapid typing
        engine.getSpotlightSuggestionsUsingCache('t', 'current-tab');
        await vi.advanceTimersByTimeAsync(50); // 50ms

        engine.getSpotlightSuggestionsUsingCache('te', 'current-tab');
        await vi.advanceTimersByTimeAsync(50); // 100ms total

        engine.getSpotlightSuggestionsUsingCache('tes', 'current-tab');
        await vi.advanceTimersByTimeAsync(50); // 150ms total

        const promise = engine.getSpotlightSuggestionsUsingCache('test', 'current-tab');
        await vi.advanceTimersByTimeAsync(151); // Final debounce window
        await promise;

        // Only the final query should trigger provider call
        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('test', 'current-tab');
    });

    it('clears previous timeout when new query arrives', async () => {
        engine.getSpotlightSuggestionsUsingCache('first', 'current-tab');
        await vi.advanceTimersByTimeAsync(100); // Partial wait

        // New query should cancel the first
        const promise = engine.getSpotlightSuggestionsUsingCache('second', 'current-tab');
        await vi.advanceTimersByTimeAsync(151);
        await promise;

        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
        expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('second', 'current-tab');
    });
});
```

### Action Routing Test
```javascript
// Source: search-engine.js handleResultAction method
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchEngine } from '../../shared/search-engine.js';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

// Extend chromeMock for search API
chromeMock.search = {
    query: vi.fn().mockResolvedValue(undefined)
};

describe('SearchEngine.handleResultAction', () => {
    let engine;

    beforeEach(() => {
        resetChromeMocks();
        chromeMock.search.query.mockClear();
        engine = new SearchEngine({
            isBackgroundProvider: true,
            getSpotlightSuggestions: vi.fn()
        });
    });

    describe('OPEN_TAB result type', () => {
        it('calls chrome.tabs.update when switching to existing tab in NEW_TAB mode', async () => {
            const result = {
                type: 'open-tab',
                url: 'https://test.com',
                metadata: { tabId: 42, windowId: 1 }
            };

            await engine.handleResultAction(result, 'new-tab');

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { active: true });
            expect(chromeMock.windows.update).toHaveBeenCalledWith(1, { focused: true });
        });

        it('calls chrome.tabs.update with URL when navigating in CURRENT_TAB mode', async () => {
            const result = {
                type: 'open-tab',
                url: 'https://test.com',
                metadata: { tabId: 1 }
            };

            await engine.handleResultAction(result, 'current-tab', 99);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(99, { url: 'https://test.com' });
        });
    });

    describe('URL_SUGGESTION result type', () => {
        it('calls chrome.tabs.create for NEW_TAB mode', async () => {
            const result = {
                type: 'url-suggestion',
                url: 'https://newsite.com'
            };

            await engine.handleResultAction(result, 'new-tab');

            expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://newsite.com' });
        });

        it('calls chrome.tabs.update for CURRENT_TAB mode', async () => {
            const result = {
                type: 'url-suggestion',
                url: 'https://newsite.com'
            };

            await engine.handleResultAction(result, 'current-tab', 99);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(99, { url: 'https://newsite.com' });
        });
    });

    describe('SEARCH_QUERY result type', () => {
        it('calls chrome.search.query with NEW_TAB disposition', async () => {
            const result = {
                type: 'search-query',
                metadata: { query: 'test search' }
            };

            await engine.handleResultAction(result, 'new-tab');

            expect(chromeMock.search.query).toHaveBeenCalledWith({
                text: 'test search',
                disposition: 'NEW_TAB'
            });
        });

        it('calls chrome.search.query with CURRENT_TAB disposition', async () => {
            const result = {
                type: 'search-query',
                metadata: { query: 'test search' }
            };

            await engine.handleResultAction(result, 'current-tab');

            expect(chromeMock.search.query).toHaveBeenCalledWith({
                text: 'test search',
                disposition: 'CURRENT_TAB'
            });
        });
    });
});
```

### Chrome Mock Extension
```javascript
// Add to test/mocks/chrome.js
export const chromeMock = {
  // ... existing mocks ...

  search: {
    query: vi.fn().mockResolvedValue(undefined)
  },

  topSites: {
    get: vi.fn().mockResolvedValue([])
  }
};

// Add to resetChromeMocks()
export function resetChromeMocks() {
  // ... existing resets ...

  chromeMock.search.query.mockClear().mockResolvedValue(undefined);
  chromeMock.topSites.get.mockClear().mockResolvedValue([]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vi.advanceTimersByTime() | vi.advanceTimersByTimeAsync() | Vitest 1.0+ | Prevents promise/timer deadlocks |
| Manual Promise.resolve() | Async timer APIs | 2024 | More reliable async timer tests |

**Current best practice:** Always use async variants of timer advancement APIs when testing code that combines timers and Promises (like debounced async functions).

## SearchEngine Internals Summary

Based on analysis of `shared/search-engine.js`:

### Cache Mechanism
- **Storage:** `this.cache = new Map()`
- **Key format:** `${query.trim()}:${mode}` (e.g., "github:current-tab")
- **Value structure:** `{ results: [...], timestamp: Date.now() }`
- **TTL:** 30000ms (30 seconds) - `this.CACHE_TTL = 30000`
- **Check:** `Date.now() - cached.timestamp < this.CACHE_TTL`

### Debounce Mechanism
- **Storage:** `this.suggestionsTimeout = null`
- **Delay:** 150ms - `this.DEBOUNCE_DELAY = 150`
- **Implementation:** Uses `clearTimeout(this.suggestionsTimeout)` then `setTimeout(..., this.DEBOUNCE_DELAY)`
- **Key behavior:** Each new call cancels the previous pending call

### Action Routing (handleResultAction)
Maps result types to Chrome API calls:

| ResultType | Mode | Chrome API Called |
|------------|------|-------------------|
| OPEN_TAB | NEW_TAB | chrome.tabs.update (activate), chrome.windows.update (focus) |
| OPEN_TAB | CURRENT_TAB | chrome.tabs.update (navigate URL) |
| URL_SUGGESTION | NEW_TAB | chrome.tabs.create |
| URL_SUGGESTION | CURRENT_TAB | chrome.tabs.update |
| SEARCH_QUERY | NEW_TAB | chrome.search.query (disposition: NEW_TAB) |
| SEARCH_QUERY | CURRENT_TAB | chrome.search.query (disposition: CURRENT_TAB) |
| BOOKMARK | NEW_TAB | chrome.tabs.create |
| BOOKMARK | CURRENT_TAB | chrome.tabs.update |
| HISTORY | NEW_TAB | chrome.tabs.create |
| HISTORY | CURRENT_TAB | chrome.tabs.update |
| TOP_SITE | NEW_TAB | chrome.tabs.create |
| TOP_SITE | CURRENT_TAB | chrome.tabs.update |

## Open Questions

1. **Non-background context testing**
   - What we know: handleResultAction has two code paths - background (direct Chrome API) and content script (message passing)
   - What's unclear: Should we test content script path that uses chrome.runtime.sendMessage?
   - Recommendation: Focus on background context path for Phase 3, defer content script path

2. **PINNED_TAB result handling**
   - What we know: Uses chrome.runtime.sendMessage to communicate with Arcify extension
   - What's unclear: How to verify message is sent correctly without actual extension
   - Recommendation: Mock chrome.runtime.sendMessage and verify message shape

## Sources

### Primary (HIGH confidence)
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/shared/search-engine.js` - SearchEngine implementation (caching, debouncing, action routing)
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/test/mocks/chrome.js` - Existing Chrome mock scaffolding
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/test/setup.js` - Test setup configuration
- `/Users/phulsechinmay/Desktop/Projects/arcify-spotlight/vitest.config.js` - Vitest configuration
- [Vitest Timer Documentation](https://vitest.dev/guide/mocking/timers) - Official fake timer guide
- [Vitest Vi API](https://vitest.dev/api/vi) - Timer method signatures

### Secondary (MEDIUM confidence)
- [Vitest Fake Timers Best Practices](https://hy2k.dev/en/blog/2025/10-03-vitest-fake-timers-debounced-solidjs-search/) - Async timer patterns
- [Mastering Time with Vitest](https://dev.to/brunosabot/mastering-time-using-fake-timers-with-vitest-390b) - Practical examples

### Tertiary (LOW confidence)
- None - all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Vitest 4.0.18, established patterns
- Architecture: HIGH - Based on actual codebase analysis
- Pitfalls: HIGH - Derived from official Vitest docs and codebase patterns
- Code examples: HIGH - Based on actual SearchEngine implementation

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable testing patterns)
