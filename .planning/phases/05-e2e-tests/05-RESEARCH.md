# Phase 5: E2E Tests - Research

**Researched:** 2026-02-04
**Domain:** Chrome Extension E2E Testing with Puppeteer
**Confidence:** HIGH

## Summary

E2E testing for Chrome extensions with Puppeteer requires understanding unique browser extension architecture constraints. Unlike standard web apps, extensions must run in non-headless mode, require special service worker targeting for Manifest V3, and have limited content script testing capabilities. The standard stack combines Puppeteer v24.36+ with Node.js native test runner, focusing on visible DOM effects rather than isolated content script contexts.

Chrome extensions present three testable surfaces: service workers (background logic), popups (UI interactions), and content scripts (page modifications). However, direct evaluation in content script isolated worlds is not possible, so tests verify DOM changes instead. Keyboard shortcuts registered via chrome.commands API cannot be triggered programmatically through Puppeteer due to browser-level vs page-level event handling.

The recommended approach uses the Page Object pattern to encapsulate extension components, stable data-testid selectors to prevent flakiness, and proper async waiting strategies for dynamic content. Tests should be organized around critical user flows (3-5 tests) rather than comprehensive coverage, following the testing pyramid principle.

**Primary recommendation:** Use Puppeteer 24.36+ with Node.js test runner, target service workers for extension state, verify content script effects via DOM queries, and accept keyboard shortcut limitations require manual testing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | 24.36.1+ | Browser automation and extension testing | Official Chrome DevTools Protocol implementation, first-class extension support |
| node:test | Node.js 20+ | Test runner | Native, zero-dependency, sufficient for E2E orchestration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pptr-testing-library | 0.8+ | DOM Testing Library queries for Puppeteer | When team familiar with Testing Library patterns |
| xvfb | System | Virtual framebuffer for CI headful mode | Required for GitHub Actions or headless servers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js test | Jest | Jest adds setup complexity and dependencies; Node.js test sufficient for E2E |
| Puppeteer | Playwright | Playwright has better cross-browser support but Puppeteer has better Chrome extension docs |

**Installation:**
```bash
# Already installed in Phase 1
npm install puppeteer  # Currently 24.36.1

# Optional - Testing Library integration
npm install --save-dev pptr-testing-library
```

**Note:** Puppeteer is already installed. Existing scaffolding in `e2e/setup.js` provides foundation.

## Architecture Patterns

### Recommended Project Structure
```
e2e/
├── setup.js                    # Browser launch utilities (exists)
├── helpers/
│   └── waitFor.js             # Custom wait utilities
├── page-objects/
│   ├── BasePage.js            # Shared page object logic
│   ├── SpotlightOverlay.js    # Spotlight UI interactions
│   └── ServiceWorker.js       # Background worker utilities
└── tests/
    ├── search-flow.e2e.test.js
    ├── keyboard-nav.e2e.test.js
    └── tab-switching.e2e.test.js
```

### Pattern 1: Service Worker Targeting (MV3)
**What:** Wait for extension service worker to load before tests
**When to use:** Every test - extension background logic runs in service worker
**Example:**
```javascript
// Source: https://pptr.dev/guides/chrome-extensions
const workerTarget = await browser.waitForTarget(
  target =>
    target.type() === 'service_worker' &&
    target.url().endsWith('background.js'),
);
const worker = await workerTarget.worker();

// Evaluate code in worker context
const result = await worker.evaluate(() => {
  return chrome.runtime.getManifest().version;
});
```

### Pattern 2: Content Script Effect Testing
**What:** Verify content script injection by checking DOM changes
**When to use:** Testing overlay display, element injection
**Example:**
```javascript
// Source: https://pptr.dev/guides/chrome-extensions
// Navigate to trigger content script injection
const page = await browser.newPage();
await page.goto('https://example.com');

// Wait for injected element (cannot access content script context directly)
await page.waitForSelector('[data-testid="spotlight-overlay"]', {
  visible: true,
  timeout: 3000
});

const overlayVisible = await page.$eval(
  '[data-testid="spotlight-overlay"]',
  el => el.style.display !== 'none'
);
```

### Pattern 3: Page Object Pattern
**What:** Encapsulate extension component interactions in classes
**When to use:** All tests - improves maintainability
**Example:**
```javascript
// Source: https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl
class SpotlightOverlay {
  constructor(page) {
    this.page = page;
  }

  async waitForVisible() {
    await this.page.waitForSelector(
      '[data-testid="spotlight-overlay"]',
      { visible: true, timeout: 3000 }
    );
  }

  async typeQuery(text) {
    await this.page.type('[data-testid="search-input"]', text);
  }

  async getResultCount() {
    return await this.page.$$eval(
      '[data-testid="search-result"]',
      results => results.length
    );
  }

  async selectResultByIndex(index) {
    const results = await this.page.$$('[data-testid="search-result"]');
    await results[index].click();
  }
}
```

### Pattern 4: Test Isolation with Browser Per Test
**What:** Launch fresh browser for each test
**When to use:** Always - prevents cross-test interference
**Example:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/how-to/test/puppeteer
import { describe, it } from 'node:test';
import { launchBrowserWithExtension, closeBrowser } from './setup.js';

describe('Search Flow', () => {
  it('should display results when typing', async () => {
    let browser;
    try {
      browser = await launchBrowserWithExtension();
      // ... test logic
    } finally {
      await closeBrowser(browser);
    }
  });
});
```

### Pattern 5: Async Wait Strategies
**What:** Combine waitForSelector with visible/hidden options
**When to use:** All dynamic content interactions
**Example:**
```javascript
// Source: https://www.webshare.io/academy-article/puppeteer-waitforselector
// Wait for element to be visible
await page.waitForSelector('[data-testid="search-results"]', {
  visible: true,
  timeout: 3000
});

// Wait for loading state to disappear
await page.waitForSelector('[data-testid="loading-spinner"]', {
  hidden: true,
  timeout: 5000
});

// Custom wait for element count
await page.waitForFunction(
  (selector) => document.querySelectorAll(selector).length > 0,
  {},
  '[data-testid="search-result"]'
);
```

### Anti-Patterns to Avoid
- **Testing in headless mode:** Extensions require headless: false, will fail silently otherwise
- **Hardcoding extension IDs:** Extension IDs change per environment, discover via targets API
- **Testing keyboard shortcuts via page.keyboard:** Commands API shortcuts are browser-level, page events won't trigger them
- **Long timeouts to hide flakiness:** Use proper wait conditions instead of arbitrary delays
- **Evaluating code in content script context:** Not supported, test DOM effects instead
- **Reusing browser across tests:** Causes state pollution, always use fresh browser per test

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding extension ID | Custom URL parsing | `browser.waitForTarget()` filtering | Extension IDs are dynamic, target filtering is reliable |
| Element waiting logic | `setTimeout()` loops | `page.waitForSelector()` with options | Built-in retry logic, timeout handling, visibility checks |
| Browser launch config | Manual args construction | `launchBrowserWithExtension()` helper | Existing setup.js already handles required flags |
| DOM query stability | CSS selectors (classes, IDs) | data-testid attributes | Build optimization changes classes/IDs, data-testid stable |
| Service worker readiness | Polling chrome.runtime | `waitForTarget(type: 'service_worker')` | Official pattern from Puppeteer docs |

**Key insight:** Chrome extension testing has unique constraints (headful mode, service worker targeting, content script isolation) that require using specialized patterns rather than general web testing approaches.

## Common Pitfalls

### Pitfall 1: Headless Mode Failure
**What goes wrong:** Tests silently fail or extension doesn't load in headless mode
**Why it happens:** Chrome extensions fundamentally require a browser UI context
**How to avoid:** Always set `headless: false` in launch options, use Xvfb in CI
**Warning signs:** Extension targets never appear, service worker not found, timeouts on all tests

### Pitfall 2: Keyboard Shortcut Testing
**What goes wrong:** `page.keyboard.press()` doesn't trigger extension commands
**Why it happens:** Extension commands listen at browser level, Puppeteer injects events at page level
**How to avoid:** Accept limitation, use manual testing for keyboard shortcuts, or test command handlers directly via service worker
**Warning signs:** Keyboard navigation works manually but fails in tests

### Pitfall 3: Content Script Isolation
**What goes wrong:** Cannot execute code or access variables in content script context
**Why it happens:** Content scripts run in isolated world, Puppeteer evaluates in page context
**How to avoid:** Test DOM effects instead of content script internals, verify injected elements exist
**Warning signs:** `page.evaluate()` returns undefined for content script variables

### Pitfall 4: Dynamic Extension IDs
**What goes wrong:** Hardcoded chrome-extension:// URLs fail in different environments
**Why it happens:** Extension IDs change between dev/prod, different Chrome installations
**How to avoid:** Use `browser.waitForTarget()` to discover extension ID dynamically
**Warning signs:** Tests pass locally, fail in CI or on other machines

### Pitfall 5: Timing Issues and Flakiness
**What goes wrong:** Tests intermittently fail with "element not found" errors
**Why it happens:** Not waiting for async operations (service worker start, content script injection, DOM updates)
**How to avoid:** Use `waitForSelector()` with visible: true, wait for service worker target, set reasonable timeouts
**Warning signs:** Tests fail randomly, work when run individually, pass with longer timeouts

### Pitfall 6: CSS Selector Instability
**What goes wrong:** Selectors break after build optimization (minification, class name hashing)
**Why it happens:** Build tools rename CSS classes and IDs for optimization
**How to avoid:** Use data-testid attributes for test selectors, avoid class/ID selectors
**Warning signs:** Tests pass in dev mode, fail with production build

### Pitfall 7: Cross-Test State Pollution
**What goes wrong:** Tests pass individually but fail when run together
**Why it happens:** Reusing same browser instance across tests, storage/state persists
**How to avoid:** Launch fresh browser for each test, use try/finally for cleanup
**Warning signs:** Test order affects pass/fail, tests fail in suite but pass in isolation

## Code Examples

Verified patterns from official sources:

### Launch Browser with Extension
```javascript
// Source: https://developer.chrome.com/docs/extensions/how-to/test/puppeteer
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, '..', 'dist');

export async function launchBrowserWithExtension(options = {}) {
  const browser = await puppeteer.launch({
    headless: false, // Required for extensions
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check'
    ],
    ...options
  });

  return browser;
}
```

### Get Service Worker and Execute Code
```javascript
// Source: https://pptr.dev/guides/chrome-extensions
async function getServiceWorker(browser) {
  const workerTarget = await browser.waitForTarget(
    target =>
      target.type() === 'service_worker' &&
      target.url().endsWith('background.js'),
    { timeout: 5000 }
  );

  return await workerTarget.worker();
}

// Use in test
const worker = await getServiceWorker(browser);
const extensionId = await worker.evaluate(() => chrome.runtime.id);
```

### Test Content Script Injection
```javascript
// Source: https://pptr.dev/guides/chrome-extensions
// Content scripts inject when navigating to matching pages
const page = await browser.newPage();
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

// Wait for content script to inject DOM elements
await page.waitForSelector('[data-testid="spotlight-overlay"]', {
  visible: false, // Initially hidden
  timeout: 2000
});

// Verify element exists
const overlayExists = await page.$('[data-testid="spotlight-overlay"]') !== null;
assert.ok(overlayExists, 'Spotlight overlay should be injected');
```

### Keyboard Navigation Testing
```javascript
// Source: https://www.webshare.io/academy-article/puppeteer-waitforselector
// Note: Cannot test chrome.commands shortcuts, but can test UI keyboard nav
async function testArrowKeyNavigation(page) {
  // Focus on search input
  await page.focus('[data-testid="search-input"]');
  await page.keyboard.type('test query');

  // Wait for results
  await page.waitForSelector('[data-testid="search-result"]', {
    visible: true,
    timeout: 3000
  });

  // Arrow down to select first result
  await page.keyboard.press('ArrowDown');

  // Check first result has focus/selection class
  const firstResultSelected = await page.$eval(
    '[data-testid="search-result"]:first-child',
    el => el.classList.contains('selected')
  );

  assert.ok(firstResultSelected, 'First result should be selected');
}
```

### Complete Test Example
```javascript
// Source: Synthesized from https://developer.chrome.com/docs/extensions/how-to/test/puppeteer
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { launchBrowserWithExtension, closeBrowser } from './setup.js';

describe('Search Flow E2E', () => {
  it('should search and navigate to result', async () => {
    let browser;

    try {
      // Launch browser with extension
      browser = await launchBrowserWithExtension();

      // Wait for extension service worker
      const workerTarget = await browser.waitForTarget(
        target => target.type() === 'service_worker',
        { timeout: 5000 }
      );

      // Open page where content script injects
      const page = await browser.newPage();
      await page.goto('https://example.com');

      // Wait for spotlight overlay injection
      await page.waitForSelector('[data-testid="spotlight-overlay"]', {
        timeout: 3000
      });

      // Simulate opening spotlight (trigger via service worker)
      const worker = await workerTarget.worker();
      await worker.evaluate(() => {
        // Extension logic to show overlay
        chrome.runtime.sendMessage({ action: 'showSpotlight' });
      });

      // Wait for overlay to be visible
      await page.waitForSelector('[data-testid="spotlight-overlay"]', {
        visible: true,
        timeout: 2000
      });

      // Type search query
      await page.type('[data-testid="search-input"]', 'example');

      // Wait for results to appear
      await page.waitForSelector('[data-testid="search-result"]', {
        visible: true,
        timeout: 3000
      });

      // Verify results exist
      const resultCount = await page.$$eval(
        '[data-testid="search-result"]',
        results => results.length
      );
      assert.ok(resultCount > 0, 'Should show search results');

      // Click first result
      await page.click('[data-testid="search-result"]:first-child');

      // Verify navigation or action occurred
      // (implementation-specific verification)

    } finally {
      await closeBrowser(browser);
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for E2E | Node.js test runner | Node.js 20 (2023) | Simpler setup, faster execution, zero dependencies |
| Headless mode | New headless mode or headful | Chrome 137+ (2024) | Extensions still require headless: false |
| sinon-chrome for mocking | Real browser with Puppeteer | Puppeteer MV3 support | E2E tests use real Chrome, not mocks |
| Playwright preferred | Puppeteer equally valid | 2025-2026 | Both work; Puppeteer has better extension docs |

**Deprecated/outdated:**
- Manifest V2 background pages: MV3 uses service workers, change targeting from `background_page` to `service_worker`
- `waitForElement` in pptr-testing-library: Deprecated, use `waitForSelector` with options
- Headless mode for extensions: Never worked, but new headless mode still requires headless: false for extensions

## Open Questions

Things that couldn't be fully resolved:

1. **Keyboard Shortcut Testing Workaround**
   - What we know: chrome.commands shortcuts cannot be triggered via Puppeteer (confirmed in GitHub issue #13445, closed as "not planned")
   - What's unclear: Whether any alternative browser automation tool can trigger extension commands programmatically
   - Recommendation: Exclude keyboard shortcut testing from E2E suite, rely on manual testing for Alt+L/Alt+T shortcuts

2. **Content Script Context Access**
   - What we know: Direct evaluation in content script isolated world is not supported (Puppeteer docs state this explicitly)
   - What's unclear: Future plans to support this, or if Chrome DevTools Protocol limitations prevent it
   - Recommendation: Focus E2E tests on DOM effects (element visibility, text content, user interactions), test content script logic in unit tests

3. **CI/CD Headful Mode Performance**
   - What we know: Xvfb required for GitHub Actions, adds overhead
   - What's unclear: Whether new headless mode (Chrome 137+) will eventually support extensions
   - Recommendation: Use xvfb-action in GitHub Actions, monitor Chrome release notes for headless extension support

4. **Test Execution Speed**
   - What we know: Fresh browser per test prevents pollution but slows execution
   - What's unclear: Safe patterns for browser reuse across tests without state pollution
   - Recommendation: Keep E2E suite small (3-5 tests), accept slower execution for test isolation

## Sources

### Primary (HIGH confidence)
- Puppeteer v24.36.1 - https://github.com/puppeteer/puppeteer/releases (latest stable as of 2026-01-27)
- Chrome for Developers - https://developer.chrome.com/docs/extensions/how-to/test/puppeteer (official extension testing guide)
- Puppeteer Chrome Extensions Guide - https://pptr.dev/guides/chrome-extensions (official docs for MV3 service workers, content scripts)
- Puppeteer GitHub Issue #13445 - https://github.com/puppeteer/puppeteer/issues/13445 (keyboard shortcut limitation confirmed)

### Secondary (MEDIUM confidence)
- Puppeteer Testing Library - https://testing-library.com/docs/pptr-testing-library/intro/ (verified docs for DOM Testing Library integration)
- Puppeteer waitForSelector - https://www.webshare.io/academy-article/puppeteer-waitforselector (comprehensive guide, verified with official API docs)
- data-testid best practices - https://bugbug.io/blog/software-testing/data-testid-attributes/ (industry standard pattern, multiple sources agree)
- GitHub Actions Xvfb - https://github.com/marketplace/actions/puppeteer-headful (verified solution for CI headful mode)

### Tertiary (LOW confidence - context from search)
- Chrome extension E2E patterns - https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl (Playwright but patterns apply to Puppeteer)
- Flakiness prevention - https://engineering.contentsquare.com/2024/automating-e2e-tests-chrome-extensions/ (practical experience, verified with official patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Puppeteer 24.36.1 current version verified, official Chrome docs confirm patterns
- Architecture: HIGH - Patterns from official Puppeteer and Chrome developer documentation
- Pitfalls: HIGH - Limitations confirmed in official docs and GitHub issues (keyboard shortcuts, content script isolation)

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - Puppeteer stable, extension APIs stable)
