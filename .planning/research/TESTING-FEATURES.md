# Test Types Research: Chrome Extension Testing

**Project:** Arcify Spotlight
**Researched:** 2026-02-04
**Domain:** Chrome Extension Testing Strategy
**Confidence:** HIGH (official Chrome documentation + community best practices)

## Executive Summary

Chrome extension testing follows a modified testing pyramid where **unit tests for pure logic provide the highest ROI**, integration tests with mocked Chrome APIs catch API usage errors, and E2E tests validate critical user flows. Given Arcify Spotlight's architecture with clearly separated concerns (scoring logic, URL normalization, fuzzy matching, selection management), unit testing the pure logic modules will provide excellent coverage with minimal setup.

---

## Table Stakes (Must Have)

### Unit Tests for Pure Logic

**What to test:** Functions that don't depend on Chrome APIs or DOM.

**Why table stakes:** These tests are fast, deterministic, and catch logic errors before they propagate. Given Arcify Spotlight's architecture, most core logic is already isolated in pure functions.

| Module | What to Test | Example Tests |
|--------|--------------|---------------|
| `scoring-constants.js` | Score calculations, fuzzy match scoring | `getFuzzyMatchScore('start', 15, 5)` returns expected score |
| `base-data-provider.js` | `normalizeUrlForDeduplication()` | Trailing slash removal, fragment removal, www prefix removal |
| `base-data-provider.js` | `deduplicateResults()` | Higher priority results win, same URL different sources |
| `base-data-provider.js` | `fuzzyMatch()` | "ghub" matches "GitHub", "yt" matches "YouTube" |
| `base-data-provider.js` | `calculateRelevanceScore()` | Score bonuses applied correctly |
| `ui-utilities.js` | `isURL()` | Domain patterns, localhost, IP addresses, edge cases |
| `ui-utilities.js` | `normalizeURL()` | Protocol prefixing, already-valid URLs |
| `selection-manager.js` | Selection state transitions | Up/down navigation wraps correctly, Home/End work |

**Example test structure:**
```javascript
// scoring.test.js
import { getFuzzyMatchScore, BASE_SCORES } from './scoring-constants.js';

describe('getFuzzyMatchScore', () => {
  it('returns higher score for start matches than contains', () => {
    const startScore = getFuzzyMatchScore('start', 15, 5);
    const containsScore = getFuzzyMatchScore('contains', 15, 5);
    expect(startScore).toBeGreaterThan(containsScore);
  });

  it('penalizes longer domains for start matches', () => {
    const shortDomain = getFuzzyMatchScore('start', 10, 5);
    const longDomain = getFuzzyMatchScore('start', 20, 5);
    expect(shortDomain).toBeGreaterThan(longDomain);
  });
});
```

**Framework recommendation:** Vitest (10-20x faster than Jest, native ESM support, works with Vite builds)

---

### Unit Tests with Chrome API Mocks

**What to test:** Code that uses Chrome APIs but where the logic can be isolated.

**Why table stakes:** Validates that your code calls Chrome APIs correctly without requiring a browser. Critical for `SearchEngine`, `BackgroundDataProvider`, message handlers.

| Module | What to Test | Mocking Approach |
|--------|--------------|------------------|
| `search-engine.js` | Cache behavior, debouncing | Mock `dataProvider` methods |
| `search-engine.js` | `handleResultAction()` routing | Mock `chrome.tabs`, `chrome.runtime` |
| `background.js` | Message handler routing | Mock `chrome.tabs.sendMessage`, `chrome.runtime.onMessage` |
| `message-client.js` | Message formatting and sending | Mock `chrome.runtime.sendMessage` |

**Chrome API mocking setup (Vitest):**
```javascript
// vitest.setup.js
import { vi } from 'vitest';

global.chrome = {
  tabs: {
    query: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    sendMessage: vi.fn()
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() }
  },
  storage: {
    local: { get: vi.fn(), set: vi.fn() },
    sync: { get: vi.fn(), set: vi.fn() }
  },
  bookmarks: { search: vi.fn() },
  history: { search: vi.fn() },
  topSites: { get: vi.fn() }
};
```

**Libraries:**
- `jest-chrome` or `vitest-chrome` for comprehensive Chrome API mocks
- `sinon-chrome` as alternative (works with both Jest and Vitest)

---

### Integration Tests for Message Passing

**What to test:** Background script <-> Content script communication flows.

**Why table stakes:** Message passing bugs are the #1 cause of "extension just doesn't work" issues. Per Chrome documentation, common errors like "Could not establish connection. Receiving end does not exist" must be caught before production.

| Flow | What to Test |
|------|--------------|
| Spotlight activation | `activateSpotlight` message creates correct response |
| Search delegation | Content script query -> background -> results returned |
| Tab switching | `switchToTab` message triggers correct Chrome API calls |
| Settings sync | `getSettings` returns merged defaults + stored values |

**Test approach:** Mock Chrome messaging APIs, verify message format and handler responses.

```javascript
// message-passing.test.js
describe('spotlight activation flow', () => {
  it('sends activateSpotlight with correct payload', async () => {
    chrome.tabs.sendMessage.mockResolvedValue({ success: true });

    await injectSpotlightScript('current-tab');

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        action: 'activateSpotlight',
        mode: 'current-tab'
      })
    );
  });
});
```

---

### E2E Tests for Critical User Flows

**What to test:** Complete user journeys that span content script, background script, and Chrome APIs.

**Why table stakes:** Some bugs only manifest when all pieces work together. Critical flows like "open spotlight, type query, select result, navigate" must work end-to-end.

**Critical flows to test:**

| Flow | Steps |
|------|-------|
| Basic search | Open spotlight -> Type query -> Results appear -> Select -> Navigate |
| Keyboard navigation | Open spotlight -> Arrow down -> Arrow up -> Enter |
| Tab switching | Search for open tab -> Select -> Tab activates |
| Fallback behavior | Trigger on restricted URL -> Fallback tab opens |

**Framework recommendation:** Puppeteer (Chrome-focused, official support, simpler than Playwright for single-browser)

Per Chrome's official E2E testing docs:
- Load extension via `--load-extension` flag
- Use `--headless=new` for CI (supports extensions)
- Access extension pages via `chrome-extension://[id]/` URLs

**Setup example:**
```javascript
// e2e/spotlight.test.js
const puppeteer = require('puppeteer');

describe('Spotlight E2E', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`
      ]
    });
    page = await browser.newPage();
  });

  it('opens spotlight on keyboard shortcut', async () => {
    await page.goto('https://example.com');
    await page.keyboard.down('Control');
    await page.keyboard.press('Space');
    await page.keyboard.up('Control');

    // Wait for spotlight dialog
    const dialog = await page.waitForSelector('#arcify-spotlight-dialog[open]');
    expect(dialog).toBeTruthy();
  });
});
```

---

## Differentiators (Nice to Have)

### Accessibility Tests

**What:** Verify keyboard navigation, focus management, screen reader compatibility.

**Value:** Spotlight is keyboard-driven by design. Accessibility bugs directly impact core UX.

**What to test:**
- Focus trap within dialog (Tab cycles through dialog elements)
- `aria-activedescendant` updates on selection change
- Screen reader announces selection changes
- Escape key closes dialog and returns focus

**Approach:** Use `axe-core` in unit tests + manual ChromeVox verification.

```javascript
// accessibility.test.js
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('spotlight dialog has no accessibility violations', async () => {
  const html = renderSpotlightDialog();
  const results = await axe(html);
  expect(results).toHaveNoViolations();
});
```

**When to add:** After core functionality is stable. Table stakes if targeting enterprise users.

---

### Performance Tests

**What:** Measure search latency, memory usage, render times.

**Value:** Spotlight must feel instant (<100ms). Performance regressions break the UX.

**What to test:**
| Metric | Target | How to Test |
|--------|--------|-------------|
| Search latency | <50ms for cached, <200ms for fresh | Console timing in tests |
| Memory baseline | <80MB steady state | Chrome DevTools heap snapshot |
| Render time | <16ms (60fps) | Performance API in tests |

**Approach:** Benchmark tests that fail if metrics exceed thresholds.

```javascript
// performance.test.js
it('cached search returns in under 50ms', async () => {
  const engine = new SearchEngine(mockProvider);

  // Warm cache
  await engine.getSpotlightSuggestionsImmediate('test', 'current-tab');

  const start = performance.now();
  await engine.getSpotlightSuggestionsImmediate('test', 'current-tab');
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(50);
});
```

**When to add:** After shipping MVP. Add to CI to catch regressions.

---

### Visual Regression Tests

**What:** Screenshot comparison to catch unintended CSS changes.

**Value:** Spotlight overlay UI is visually prominent. CSS bugs are highly visible.

**Tools considered:**
| Tool | Approach | Recommendation |
|------|----------|----------------|
| Percy | Cloud-based, CI integration | Good for teams, costs money |
| BackstopJS | Local screenshots, Docker | Free, good for solo dev |
| Playwright screenshots | Built-in to Playwright | Simple, manual review |

**Recommendation:** Skip for now. CSS is simple and stable. Add BackstopJS if:
- Multiple developers changing styles
- Supporting multiple themes/color schemes
- Users report visual inconsistencies

---

## Anti-Features (Skip)

### Exhaustive Chrome API Mocking

**What it looks like:** Mocking every Chrome API method, including ones you don't use.

**Why skip:** Chrome APIs are tested by Google. Mock only what you call. `jest-chrome` provides safe stubs for uncalled methods.

**Time cost:** 2-4 hours of setup for zero additional coverage.

---

### E2E Tests for Every Feature

**What it looks like:** E2E test for bookmark search, E2E test for history search, E2E test for autocomplete, etc.

**Why skip:** E2E tests are slow (seconds per test), flaky (browser automation), and expensive to maintain. The data flows through the same code paths.

**Better approach:** One E2E test per critical user journey. Unit test the data-specific logic (filtering, scoring, formatting).

---

### Cross-Browser Testing

**What it looks like:** Testing in Firefox, Edge, Safari, Brave, etc.

**Why skip for now:** Arcify Spotlight is Chrome-only (uses chrome.* APIs, not WebExtensions polyfill). Cross-browser support would require significant architecture changes.

**When to reconsider:** If porting to Firefox/Edge becomes a goal.

---

### Mutation Testing

**What it looks like:** Tools like Stryker that modify code to ensure tests catch changes.

**Why skip:** Overkill for a focused extension. High setup cost, slow execution, diminishing returns for small codebases.

---

### Contract Testing for Message Passing

**What it looks like:** Formal schema validation for messages between scripts (like Pact).

**Why skip:** Message format is simple and controlled by one developer. TypeScript interfaces provide sufficient contract enforcement.

---

### Load/Stress Testing

**What it looks like:** Testing with 1000+ open tabs, 10000+ bookmarks, etc.

**Why skip initially:** Unlikely to hit these scales in normal usage. Add targeted benchmarks if users report slowness with large datasets.

---

## Testing Pyramid for Chrome Extensions

```
                    /\
                   /  \
                  / E2E \       ~5 tests
                 /  Tests \     Critical user flows only
                /----------\
               /            \
              / Integration  \   ~15-20 tests
             /   (Mocked API) \  Message passing, Chrome API usage
            /------------------\
           /                    \
          /     Unit Tests       \  ~50+ tests
         /   (Pure Functions)     \ Scoring, URL handling, fuzzy matching
        /==========================\
```

**Recommended distribution for Arcify Spotlight:**

| Layer | Count | Purpose |
|-------|-------|---------|
| Unit (pure) | 50+ | Logic correctness, fast feedback |
| Unit (mocked) | 15-20 | API usage correctness |
| Integration | 10-15 | Message passing, component interaction |
| E2E | 3-5 | Critical flows work end-to-end |

---

## Priority Order for Implementation

Based on ROI and existing code structure:

### Phase 1: Unit Tests for Pure Logic (Highest ROI)
1. `normalizeUrlForDeduplication()` - used everywhere
2. `deduplicateResults()` - complex logic, easy to regress
3. `isURL()` - many edge cases
4. `fuzzyMatch()` - core search feature
5. `calculateRelevanceScore()` - affects result ordering
6. `getFuzzyMatchScore()` - affects ranking

### Phase 2: Unit Tests with Mocks
1. `SearchEngine.getSpotlightSuggestionsUsingCache()` - caching and debouncing
2. `SearchEngine.handleResultAction()` - action routing
3. Message handlers in `background.js`

### Phase 3: Integration Tests
1. Spotlight activation flow
2. Search -> results flow
3. Result action -> navigation flow

### Phase 4: E2E Tests
1. Full search flow (open -> type -> select -> navigate)
2. Keyboard navigation (arrows, enter, escape)
3. Fallback to new tab (restricted URL handling)

---

## Arcify-Specific Test Cases

Based on codebase analysis, these are the highest-value test cases:

### URL Normalization (`normalizeUrlForDeduplication`)
```javascript
describe('normalizeUrlForDeduplication', () => {
  it('removes trailing slashes', () => {
    expect(normalize('https://example.com/')).toBe('example.com');
    expect(normalize('https://example.com///')).toBe('example.com');
  });

  it('removes URL fragments', () => {
    expect(normalize('https://example.com#section')).toBe('example.com');
    expect(normalize('https://example.com/page#anchor')).toBe('example.com/page');
  });

  it('removes www prefix', () => {
    expect(normalize('https://www.example.com')).toBe('example.com');
  });

  it('removes protocol', () => {
    expect(normalize('http://example.com')).toBe('example.com');
    expect(normalize('https://example.com')).toBe('example.com');
  });

  it('preserves path for different pages', () => {
    expect(normalize('https://github.com/user/repo')).toBe('github.com/user/repo');
    expect(normalize('https://github.com/user/repo/issues')).toBe('github.com/user/repo/issues');
  });

  it('handles edge cases', () => {
    expect(normalize('')).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});
```

### Fuzzy Matching (`fuzzyMatch`)
```javascript
describe('fuzzyMatch', () => {
  it('matches exact substrings', () => {
    expect(fuzzyMatch('git', 'GitHub')).toBe(true);
    expect(fuzzyMatch('hub', 'GitHub')).toBe(true);
  });

  it('matches characters in order', () => {
    expect(fuzzyMatch('ghub', 'GitHub')).toBe(true);
    expect(fuzzyMatch('gml', 'Gmail')).toBe(true);
    expect(fuzzyMatch('yt', 'YouTube')).toBe(true);
  });

  it('rejects out-of-order characters', () => {
    expect(fuzzyMatch('hubg', 'GitHub')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('GITHUB', 'github')).toBe(true);
    expect(fuzzyMatch('github', 'GITHUB')).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(fuzzyMatch('', 'GitHub')).toBe(false);
    expect(fuzzyMatch('git', '')).toBe(false);
    expect(fuzzyMatch('', '')).toBe(false);
  });
});
```

### URL Detection (`isURL`)
```javascript
describe('isURL', () => {
  // Valid URLs
  it('recognizes full URLs', () => {
    expect(isURL('https://example.com')).toBe(true);
    expect(isURL('http://example.com')).toBe(true);
    expect(isURL('chrome://extensions')).toBe(true);
  });

  it('recognizes domain patterns', () => {
    expect(isURL('example.com')).toBe(true);
    expect(isURL('sub.example.com')).toBe(true);
    expect(isURL('example.co.uk')).toBe(true);
  });

  it('recognizes localhost', () => {
    expect(isURL('localhost')).toBe(true);
    expect(isURL('localhost:3000')).toBe(true);
  });

  it('recognizes IP addresses', () => {
    expect(isURL('192.168.1.1')).toBe(true);
    expect(isURL('192.168.1.1:8080')).toBe(true);
  });

  // Not URLs (should search instead)
  it('rejects search queries', () => {
    expect(isURL('how to code')).toBe(false);
    expect(isURL('javascript tutorial')).toBe(false);
    expect(isURL('example')).toBe(false);
  });

  it('rejects invalid TLDs', () => {
    expect(isURL('example.x')).toBe(false);
    expect(isURL('example.123')).toBe(false);
  });

  it('rejects invalid IP addresses', () => {
    expect(isURL('999.999.999.999')).toBe(false);
    expect(isURL('192.168.1')).toBe(false);
  });
});
```

### Selection Manager State
```javascript
describe('SelectionManager', () => {
  it('initializes with first item selected', () => {
    const manager = new SelectionManager(container);
    manager.updateResults([{}, {}, {}]);
    expect(manager.selectedIndex).toBe(0);
  });

  it('moves selection down', () => {
    const manager = new SelectionManager(container);
    manager.updateResults([{}, {}, {}]);
    manager.moveSelection('down');
    expect(manager.selectedIndex).toBe(1);
  });

  it('stops at last item when moving down', () => {
    const manager = new SelectionManager(container);
    manager.updateResults([{}, {}]);
    manager.moveSelection('down');
    manager.moveSelection('down');
    manager.moveSelection('down');
    expect(manager.selectedIndex).toBe(1);
  });

  it('stops at first item when moving up', () => {
    const manager = new SelectionManager(container);
    manager.updateResults([{}, {}]);
    manager.moveSelection('up');
    expect(manager.selectedIndex).toBe(0);
  });

  it('calls onSelectionChange when selection changes', () => {
    const callback = vi.fn();
    const manager = new SelectionManager(container, callback);
    manager.updateResults([{ id: 1 }, { id: 2 }]);
    manager.moveSelection('down');
    expect(callback).toHaveBeenCalledWith({ id: 2 }, 1);
  });
});
```

---

## Sources

**Official Documentation (HIGH confidence):**
- [Chrome Extensions Unit Testing](https://developer.chrome.com/docs/extensions/how-to/test/unit-testing)
- [Chrome Extensions E2E Testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Chrome Extensions Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Puppeteer Chrome Extension Testing](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)

**Community Resources (MEDIUM confidence):**
- [jest-chrome GitHub](https://github.com/extend-chrome/jest-chrome) - Complete Chrome API mocks for Jest
- [Vitest Discussion: Chrome Extension Testing](https://github.com/vitest-dev/vitest/discussions/3090) - Community approaches
- [Chrome Extension Testing with Playwright and CDP](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl)

**Accessibility (MEDIUM confidence):**
- [BrowserStack Accessibility Extension Guide](https://www.browserstack.com/guide/accessibility-extension-chrome)
- [WAVE Evaluation Tool](https://chromewebstore.google.com/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh)
- [Chrome DevTools Accessibility Reference](https://developer.chrome.com/docs/devtools/accessibility/reference)

**Performance (MEDIUM confidence):**
- [Chrome DevTools Memory Problems](https://developer.chrome.com/docs/devtools/memory-problems)
- [DebugBear Chrome Extension Performance Report](https://www.debugbear.com/blog/2020-chrome-extension-performance-report)
