# Phase 2: Unit Tests - Pure Logic - Research

**Researched:** 2026-02-04
**Domain:** Unit testing pure JavaScript logic with Vitest
**Confidence:** HIGH

## Summary

This research identifies the exact pure functions requiring unit tests in the Arcify Spotlight codebase. The codebase has a well-structured separation of concerns with pure logic functions in `shared/` that are ideal candidates for fast, deterministic unit tests. The test infrastructure from Phase 1 (Vitest 4.0.18 with Chrome API mocks) is already in place.

The primary targets are:
1. **URL utilities** in `ui-utilities.js` - URL detection (`isURL`), normalization (`normalizeURL`)
2. **Deduplication logic** in `base-data-provider.js` - URL normalization for dedup, result priority
3. **Fuzzy matching** in `base-data-provider.js` and `popular-sites.js` - character-in-sequence matching
4. **Scoring system** in `scoring-constants.js` and `base-data-provider.js` - relevance calculation
5. **Selection management** in `selection-manager.js` - navigation bounds (up/down/home/end)

**Primary recommendation:** Create focused test files for each module, testing pure functions in isolation with no DOM or Chrome API dependencies.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.18 | Test runner and assertion library | Already installed, native ESM, 10-20x faster than Jest |
| @vitest/coverage-v8 | 4.0.18 | Code coverage reporting | Already installed, V8 native coverage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vi (from vitest) | built-in | Mocking, spying, timers | Only when testing functions with external dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual assertions | chai | Not needed - Vitest's expect is sufficient |
| Chrome mocks | sinon-chrome | Manual mocks preferred per Phase 1 decisions |

**Installation:**
```bash
# Already installed - no additional packages needed
```

## Architecture Patterns

### Recommended Test File Structure
```
test/
├── mocks/
│   └── chrome.js          # Chrome API mock (already exists)
├── unit/
│   ├── url-utilities.test.js       # isURL, normalizeURL tests
│   ├── deduplication.test.js       # URL normalization, result priority
│   ├── fuzzy-matching.test.js      # fuzzyMatch, findMatchingDomains
│   ├── scoring.test.js             # relevance scoring, bonuses
│   └── selection-manager.test.js   # navigation bounds
├── setup.js               # Global setup (already exists)
└── example.test.js        # Existing placeholder
```

### Pattern 1: Pure Function Testing
**What:** Test functions that take inputs and return outputs with no side effects
**When to use:** All functions identified in this phase
**Example:**
```javascript
// Source: Vitest documentation
import { describe, it, expect } from 'vitest';
import { SpotlightUtils } from '../../shared/ui-utilities.js';

describe('isURL', () => {
  it('detects valid URLs with protocol', () => {
    expect(SpotlightUtils.isURL('https://example.com')).toBe(true);
  });

  it('rejects plain search queries', () => {
    expect(SpotlightUtils.isURL('hello world')).toBe(false);
  });
});
```

### Pattern 2: Table-Driven Tests
**What:** Use test.each for comprehensive edge case coverage
**When to use:** URL normalization, fuzzy matching with many input/output pairs
**Example:**
```javascript
// Source: Vitest documentation
import { describe, it, expect } from 'vitest';

describe('normalizeUrlForDeduplication', () => {
  it.each([
    ['https://example.com#section', 'example.com'],
    ['https://example.com/', 'example.com'],
    ['http://www.example.com', 'example.com'],
    ['https://EXAMPLE.COM', 'example.com'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeUrlForDeduplication(input)).toBe(expected);
  });
});
```

### Pattern 3: Mocking DOM for SelectionManager
**What:** Create minimal container mock for selection tests
**When to use:** SelectionManager tests that need container.querySelectorAll
**Example:**
```javascript
// Source: Vitest documentation + codebase analysis
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectionManager } from '../../shared/selection-manager.js';

describe('SelectionManager', () => {
  let mockContainer;
  let manager;

  beforeEach(() => {
    // Minimal DOM mock for selection tests
    mockContainer = {
      querySelectorAll: vi.fn().mockReturnValue([]),
      contains: vi.fn().mockReturnValue(true)
    };
    manager = new SelectionManager(mockContainer);
  });

  it('clamps selection at bounds', () => {
    manager.updateResults([{ id: 1 }, { id: 2 }, { id: 3 }]);
    manager.moveSelection('up'); // Already at 0
    expect(manager.selectedIndex).toBe(0);
  });
});
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Don't test internal state changes, test observable behavior
- **Over-mocking:** For pure functions, no mocking is needed
- **Snapshot testing everything:** Use explicit assertions for predictable logic
- **Shared state between tests:** Always reset state in beforeEach

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test assertions | Custom assert functions | Vitest expect() | Built-in matchers cover all cases |
| Mock functions | Manual tracking | vi.fn() | Automatic call tracking, return values |
| Test tables | Multiple it() blocks | it.each() | DRY, easier to add cases |
| Fake timers | setTimeout manipulation | vi.useFakeTimers() | Proper cleanup, time control |

**Key insight:** Pure function testing needs minimal infrastructure. The existing Vitest setup is sufficient.

## Common Pitfalls

### Pitfall 1: Testing Private Implementation
**What goes wrong:** Tests break when internal implementation changes
**Why it happens:** Testing how something works instead of what it does
**How to avoid:** Only test public API methods and their observable outputs
**Warning signs:** Tests reference internal variables or call private methods

### Pitfall 2: Incomplete Edge Case Coverage
**What goes wrong:** URLs with unusual formats slip through
**Why it happens:** Only testing "happy path" scenarios
**How to avoid:** Use table-driven tests with edge cases from requirements
**Warning signs:** isURL tests only have 2-3 cases

### Pitfall 3: Forgetting to Reset State
**What goes wrong:** Tests pass individually but fail in batch
**Why it happens:** SelectionManager or other classes retain state between tests
**How to avoid:** Create fresh instances in beforeEach
**Warning signs:** Tests are order-dependent

### Pitfall 4: DOM Dependencies in Pure Logic Tests
**What goes wrong:** Tests fail in Node environment
**Why it happens:** Accidentally testing functions that need document/window
**How to avoid:** Only test truly pure functions in this phase
**Warning signs:** ReferenceError: document is not defined

## Functions to Test

### 1. URL Utilities (`shared/ui-utilities.js`)

#### `SpotlightUtils.isURL(text)`
**Purpose:** Determines if user input should be treated as a URL
**Location:** Lines 33-68
**Signature:** `static isURL(text: string): boolean`

**Test Cases (UNIT-05):**
| Input | Expected | Edge Case |
|-------|----------|-----------|
| `'https://example.com'` | true | Complete URL with protocol |
| `'http://example.com'` | true | HTTP protocol |
| `'example.com'` | true | Domain without protocol |
| `'sub.example.com'` | true | Subdomain |
| `'example.co.uk'` | true | Multi-part TLD |
| `'localhost'` | true | Localhost |
| `'localhost:3000'` | true | Localhost with port |
| `'192.168.1.1'` | true | Valid IP address |
| `'192.168.1.1:8080'` | true | IP with port |
| `'999.999.999.999'` | false | Invalid IP (octets > 255) |
| `'hello world'` | false | Plain search query |
| `'github'` | false | Single word without TLD |
| `'how to code'` | false | Multi-word query |
| `'what is github.com'` | false | Query containing domain |
| `'file.txt'` | false | File extension, not domain |

#### `SpotlightUtils.normalizeURL(url)`
**Purpose:** Adds https:// protocol to URLs if missing
**Location:** Lines 23-30
**Signature:** `static normalizeURL(url: string): string`

**Test Cases (UNIT-01):**
| Input | Expected | Edge Case |
|-------|----------|-----------|
| `'example.com'` | `'https://example.com'` | No protocol |
| `'https://example.com'` | `'https://example.com'` | Already has https |
| `'http://example.com'` | `'http://example.com'` | Keep http |
| `'chrome://settings'` | `'chrome://settings'` | Chrome protocol |
| `'file:///path'` | `'file:///path'` | File protocol |

### 2. Deduplication Logic (`shared/data-providers/base-data-provider.js`)

#### `BaseDataProvider.normalizeUrlForDeduplication(url)`
**Purpose:** Normalizes URLs for consistent duplicate detection
**Location:** Lines 511-533
**Signature:** `normalizeUrlForDeduplication(url: string): string`

**Test Cases (UNIT-01):**
| Input | Expected | Edge Case |
|-------|----------|-----------|
| `'https://example.com#section'` | `'example.com'` | Fragment removed |
| `'https://example.com/'` | `'example.com'` | Trailing slash removed |
| `'https://example.com///'` | `'example.com'` | Multiple trailing slashes |
| `'http://example.com'` | `'example.com'` | Protocol removed |
| `'https://www.example.com'` | `'example.com'` | www prefix removed |
| `'HTTPS://EXAMPLE.COM'` | `'example.com'` | Lowercased |
| `'https://example.com?q=test'` | `'example.com?q=test'` | Query params preserved |
| `''` | `''` | Empty string |
| `null` | `''` | Null input |

#### `BaseDataProvider.getResultPriority(result)`
**Purpose:** Returns priority score for deduplication (higher = wins)
**Location:** Lines 538-558
**Signature:** `getResultPriority(result: SearchResult): number`

**Test Cases (UNIT-02):**
| Result Type | Expected Priority | Note |
|-------------|-------------------|------|
| `'open-tab'` | 90 | Highest - open tabs win |
| `'pinned-tab'` | 85 | Second highest |
| `'bookmark'` | 80 | Third |
| `'history'` | 70 | Fourth |
| `'top-site'` | 60 | Fifth |
| `'autocomplete-suggestion'` | 30 | Lowest |

**Deduplication Behavior Tests:**
- Same URL as open-tab AND history: open-tab should remain
- Same URL as bookmark AND history: bookmark should remain

### 3. Fuzzy Matching (`shared/data-providers/base-data-provider.js`)

#### `BaseDataProvider.fuzzyMatch(query, text)`
**Purpose:** Checks if all query characters appear in text in order
**Location:** Lines 437-457
**Signature:** `fuzzyMatch(query: string, text: string): boolean`

**Test Cases (UNIT-03):**
| Query | Text | Expected | Reason |
|-------|------|----------|--------|
| `'ghub'` | `'GitHub'` | true | Characters in order |
| `'yt'` | `'YouTube'` | true | Abbreviation match |
| `'gml'` | `'Gmail'` | true | Consonant match |
| `'fb'` | `'Facebook'` | true | Start letters |
| `'hbug'` | `'GitHub'` | false | Out of order (h after g) |
| `'xyz'` | `'GitHub'` | false | Characters not present |
| `''` | `'GitHub'` | false | Empty query |
| `'git'` | `''` | false | Empty text |
| `'github'` | `'GitHub'` | true | Exact match (contains) |
| `'GHUB'` | `'github'` | true | Case insensitive |

### 4. Popular Sites Fuzzy Matching (`shared/popular-sites.js`)

#### `findMatchingDomains(partial, maxResults)`
**Purpose:** Finds popular domains matching partial input
**Location:** Lines 223-265
**Signature:** `findMatchingDomains(partial: string, maxResults?: number): MatchResult[]`

**Test Cases (UNIT-03):**
| Partial | Expected Contains | Match Type |
|---------|-------------------|------------|
| `'git'` | `github.com`, `gitlab.com` | start |
| `'squaresp'` | `squarespace.com` | start |
| `'tube'` | `youtube.com` | contains |
| `'Amazon'` | `amazon.com` | name match |
| `''` | `[]` | Empty returns nothing |

**Return Structure:**
```javascript
{
  domain: 'github.com',
  displayName: 'GitHub',
  score: number,
  matchType: 'start' | 'contains' | 'name'
}
```

### 5. Relevance Scoring (`shared/scoring-constants.js` + `base-data-provider.js`)

#### `getAutocompleteScore(index)`
**Purpose:** Calculate decreasing score for autocomplete results by position
**Location:** `scoring-constants.js` lines 49-51
**Signature:** `getAutocompleteScore(index: number): number`

**Test Cases (UNIT-04):**
| Index | Expected Score |
|-------|----------------|
| 0 | 30 |
| 1 | 29 |
| 4 | 26 |

#### `getFuzzyMatchScore(matchType, domainLength, queryLength)`
**Purpose:** Calculate score for fuzzy domain matches
**Location:** `scoring-constants.js` lines 54-73
**Signature:** `getFuzzyMatchScore(matchType: string, domainLength?: number, queryLength?: number): number`

**Test Cases (UNIT-04):**
| Match Type | Expected Range |
|------------|----------------|
| `'start'` | ~65 (with length penalty) |
| `'contains'` | 63 |
| `'name'` | 62 |
| `'unknown'` | 60 |

#### `BaseDataProvider.calculateRelevanceScore(result, query)`
**Purpose:** Calculate total relevance score with bonuses
**Location:** `base-data-provider.js` lines 336-366
**Signature:** `calculateRelevanceScore(result: SearchResult, query: string): number`

**Test Cases (UNIT-04):**
| Scenario | Bonus Applied |
|----------|---------------|
| Title exactly matches query | +20 (EXACT_TITLE_MATCH) |
| Title starts with query | +15 (TITLE_STARTS_WITH) |
| Title contains query | +10 (TITLE_CONTAINS) |
| URL contains query | +5 (URL_CONTAINS) |

### 6. Selection Manager (`shared/selection-manager.js`)

#### Navigation Methods
**Purpose:** Handle keyboard navigation within bounds
**Location:** Lines 20-58

**Test Cases (UNIT-06):**

**moveSelection(direction):**
| Initial Index | Results Length | Direction | Expected Index |
|---------------|----------------|-----------|----------------|
| 0 | 3 | 'down' | 1 |
| 2 | 3 | 'down' | 2 (clamped) |
| 0 | 3 | 'up' | 0 (clamped) |
| 2 | 3 | 'up' | 1 |

**moveToFirst():**
| Initial Index | Results Length | Expected Index |
|---------------|----------------|----------------|
| 2 | 3 | 0 |
| 0 | 3 | 0 |

**moveToLast():**
| Initial Index | Results Length | Expected Index |
|---------------|----------------|----------------|
| 0 | 3 | 2 |
| 2 | 3 | 2 |
| 0 | 0 | 0 (edge case: empty) |

**updateResults(newResults):**
- Should reset selectedIndex to 0
- Should NOT trigger onSelectionChange callback

**getSelectedResult():**
- Should return result at selectedIndex
- Should return null if index out of bounds

## Code Examples

Verified patterns from Vitest documentation and codebase:

### Complete Test File Structure
```javascript
// test/unit/url-utilities.test.js
import { describe, it, expect } from 'vitest';
import { SpotlightUtils } from '../../shared/ui-utilities.js';

describe('SpotlightUtils.isURL', () => {
  describe('valid URLs', () => {
    it.each([
      ['https://example.com', 'complete URL with https'],
      ['http://example.com', 'complete URL with http'],
      ['example.com', 'domain without protocol'],
      ['localhost', 'localhost'],
      ['localhost:3000', 'localhost with port'],
      ['192.168.1.1', 'valid IP address'],
    ])('returns true for %s (%s)', (input) => {
      expect(SpotlightUtils.isURL(input)).toBe(true);
    });
  });

  describe('invalid URLs (search queries)', () => {
    it.each([
      ['hello world', 'space-separated words'],
      ['github', 'single word without TLD'],
      ['how to code', 'natural language query'],
    ])('returns false for %s (%s)', (input) => {
      expect(SpotlightUtils.isURL(input)).toBe(false);
    });
  });
});
```

### Testing Deduplication with Instance
```javascript
// test/unit/deduplication.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';

describe('BaseDataProvider deduplication', () => {
  let provider;

  beforeEach(() => {
    // Create testable subclass or extract pure functions
    provider = Object.create(BaseDataProvider.prototype);
  });

  describe('normalizeUrlForDeduplication', () => {
    it('removes URL fragments', () => {
      expect(provider.normalizeUrlForDeduplication('https://example.com#section'))
        .toBe('example.com');
    });
  });
});
```

### Testing SelectionManager with Mock Container
```javascript
// test/unit/selection-manager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectionManager } from '../../shared/selection-manager.js';

describe('SelectionManager', () => {
  let manager;
  let mockContainer;
  let selectionCallback;

  beforeEach(() => {
    mockContainer = {
      querySelectorAll: vi.fn().mockReturnValue([
        { classList: { toggle: vi.fn() }, scrollIntoView: vi.fn() },
        { classList: { toggle: vi.fn() }, scrollIntoView: vi.fn() },
        { classList: { toggle: vi.fn() }, scrollIntoView: vi.fn() },
      ]),
      contains: vi.fn().mockReturnValue(true)
    };
    selectionCallback = vi.fn();
    manager = new SelectionManager(mockContainer, selectionCallback);
    manager.updateResults([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  describe('moveSelection', () => {
    it('moves down within bounds', () => {
      manager.moveSelection('down');
      expect(manager.selectedIndex).toBe(1);
    });

    it('clamps at maximum index', () => {
      manager.selectedIndex = 2;
      manager.moveSelection('down');
      expect(manager.selectedIndex).toBe(2);
    });

    it('clamps at minimum index', () => {
      manager.moveSelection('up');
      expect(manager.selectedIndex).toBe(0);
    });

    it('triggers callback on change', () => {
      manager.moveSelection('down');
      expect(selectionCallback).toHaveBeenCalledWith({ id: 2 }, 1);
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest | Vitest | 2023+ | 10-20x faster, native ESM |
| sinon-chrome | Manual vi.fn() mocks | Project decision | More control, less dependency |
| Individual it() blocks | it.each() tables | Best practice | DRY, maintainable |

**Deprecated/outdated:**
- `jest.fn()` syntax: Use `vi.fn()` in Vitest

## Open Questions

Things that couldn't be fully resolved:

1. **DOM testing for updateVisualSelection**
   - What we know: It calls `querySelectorAll` and `scrollIntoView`
   - What's unclear: Whether to test visual updates in unit tests
   - Recommendation: Mock container to verify calls are made, defer visual testing to integration phase

2. **Testing deduplicateResults with full array**
   - What we know: It uses normalizeUrlForDeduplication and getResultPriority
   - What's unclear: Whether to test the full method or just its helpers
   - Recommendation: Test helpers thoroughly; full method is integration-level

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `shared/ui-utilities.js`, `shared/selection-manager.js`, `shared/data-providers/base-data-provider.js`, `shared/popular-sites.js`, `shared/scoring-constants.js`
- Existing test infrastructure: `vitest.config.js`, `test/setup.js`, `test/mocks/chrome.js`
- [Vitest GitHub](https://github.com/vitest-dev/vitest) - Official repository

### Secondary (MEDIUM confidence)
- [Unit Testing with Vitest - CS4530 Spring 2026](https://neu-se.github.io/CS4530-Spring-2026/tutorials/week1-unit-testing) - University tutorial
- [Best Techniques for Vitest - DEV Community](https://dev.to/wallacefreitas/best-techniques-to-create-tests-with-the-vitest-framework-9al)
- [Vitest Beginner's Guide - Better Stack](https://betterstack.com/community/guides/testing/vitest-explained/)

### Tertiary (LOW confidence)
- N/A - All findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already installed, verified versions
- Architecture: HIGH - Based on actual codebase structure
- Functions to test: HIGH - Direct code analysis
- Pitfalls: MEDIUM - Based on general testing best practices

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable domain)
