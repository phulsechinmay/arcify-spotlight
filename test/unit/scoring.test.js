import { describe, it, expect, beforeEach } from 'vitest';
import {
    BASE_SCORES,
    SCORE_BONUSES,
    getAutocompleteScore,
    getFuzzyMatchScore
} from '../../shared/scoring-constants.js';
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';

// Note: getFuzzyMatchScore is deprecated but still exported from scoring-constants.js.
// It is no longer used by base-data-provider.js (replaced by Fuse.js matchScore integration).

describe('getAutocompleteScore', () => {
    it('returns BASE_SCORES.AUTOCOMPLETE_SUGGESTION for index 0', () => {
        expect(getAutocompleteScore(0)).toBe(BASE_SCORES.AUTOCOMPLETE_SUGGESTION);
    });

    it('returns 30 for index 0 (explicit value)', () => {
        expect(getAutocompleteScore(0)).toBe(30);
    });

    it('returns 29 for index 1', () => {
        expect(getAutocompleteScore(1)).toBe(29);
    });

    it('returns 26 for index 4', () => {
        expect(getAutocompleteScore(4)).toBe(26);
    });

    it('decreases by 1 per position', () => {
        for (let i = 0; i < 5; i++) {
            expect(getAutocompleteScore(i)).toBe(30 - i);
        }
    });

    it('can return negative scores for large indices', () => {
        expect(getAutocompleteScore(50)).toBe(30 - 50);
    });
});

describe('getFuzzyMatchScore (DEPRECATED - replaced by Fuse.js matchScore)', () => {
    describe('matchType scores', () => {
        it.each([
            ['start', 'returns score >= 62 (minimum is FUZZY_MATCH_NAME)'],
            ['contains', 'returns 63 (FUZZY_MATCH_CONTAINS)'],
            ['name', 'returns 62 (FUZZY_MATCH_NAME)'],
            ['unknown', 'returns >= 60 (at least FUZZY_MATCH_DEFAULT due to minimum)'],
        ])('matchType "%s" - %s', (matchType) => {
            const score = getFuzzyMatchScore(matchType);
            expect(score).toBeGreaterThanOrEqual(BASE_SCORES.FUZZY_MATCH_NAME);
        });
    });

    describe('specific matchType values', () => {
        it('returns FUZZY_MATCH_CONTAINS (63) for contains match', () => {
            expect(getFuzzyMatchScore('contains')).toBe(BASE_SCORES.FUZZY_MATCH_CONTAINS);
        });

        it('returns FUZZY_MATCH_NAME (62) for name match', () => {
            expect(getFuzzyMatchScore('name')).toBe(BASE_SCORES.FUZZY_MATCH_NAME);
        });

        it('returns at least FUZZY_MATCH_NAME (62) for unknown matchType', () => {
            // Default score is 60, but function ensures minimum of FUZZY_MATCH_NAME (62)
            expect(getFuzzyMatchScore('unknown')).toBeGreaterThanOrEqual(BASE_SCORES.FUZZY_MATCH_NAME);
        });
    });

    describe('start match with length penalty', () => {
        it('longer domains get lower scores for start matches', () => {
            const shortDomainScore = getFuzzyMatchScore('start', 6, 3);  // 6 char domain
            const longDomainScore = getFuzzyMatchScore('start', 10, 3); // 10 char domain

            expect(shortDomainScore).toBeGreaterThan(longDomainScore);
        });

        it('penalty is 0.1 per extra character beyond query length', () => {
            // For matchType 'start': score = 65 - (domainLength - queryLength) * 0.1
            // With domainLength=10, queryLength=3: penalty = 7 * 0.1 = 0.7
            // Score = 65 - 0.7 = 64.3
            const score = getFuzzyMatchScore('start', 10, 3);
            expect(score).toBeCloseTo(65 - (10 - 3) * 0.1, 1);
        });

        it('start match never falls below FUZZY_MATCH_NAME minimum', () => {
            // Even with very long domain, minimum is enforced
            const score = getFuzzyMatchScore('start', 100, 3);
            expect(score).toBeGreaterThanOrEqual(BASE_SCORES.FUZZY_MATCH_NAME);
        });
    });
});

describe('BaseDataProvider.calculateRelevanceScore', () => {
    let provider;

    beforeEach(() => {
        provider = Object.create(BaseDataProvider.prototype);
    });

    describe('base scores by result type', () => {
        it('returns OPEN_TAB base score (90) for open-tab type', () => {
            const result = { type: 'open-tab', title: 'Test', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            expect(score).toBe(BASE_SCORES.OPEN_TAB);
        });

        it('returns BOOKMARK base score (80) for bookmark type', () => {
            const result = { type: 'bookmark', title: 'Test', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            expect(score).toBe(BASE_SCORES.BOOKMARK);
        });

        it('returns HISTORY base score (70) for history type', () => {
            const result = { type: 'history', title: 'Test', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            expect(score).toBe(BASE_SCORES.HISTORY);
        });

        it('returns PINNED_TAB base score (85) for pinned-tab type', () => {
            const result = { type: 'pinned-tab', title: 'Test', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            expect(score).toBe(BASE_SCORES.PINNED_TAB);
        });

        it('returns TOP_SITE base score (60) for top-site type', () => {
            const result = { type: 'top-site', title: 'Test', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            expect(score).toBe(BASE_SCORES.TOP_SITE);
        });
    });

    describe('title match bonuses', () => {
        it('adds EXACT_TITLE_MATCH bonus (20) for exact title match', () => {
            const result = { type: 'history', title: 'github', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.EXACT_TITLE_MATCH);
        });

        it('adds TITLE_STARTS_WITH bonus (15) when title starts with query', () => {
            const result = { type: 'history', title: 'github repo', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.TITLE_STARTS_WITH);
        });

        it('adds TITLE_CONTAINS bonus (10) when title contains query', () => {
            const result = { type: 'history', title: 'my github page', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.TITLE_CONTAINS);
        });
    });

    describe('URL match bonuses', () => {
        it('adds URL_CONTAINS bonus (5) when URL contains query', () => {
            const result = { type: 'history', title: 'Test Page', url: 'https://github.com/repo' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.URL_CONTAINS);
        });

        it('no URL bonus when URL does not contain query', () => {
            const result = { type: 'history', title: 'Test Page', url: 'https://example.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY);
        });
    });

    describe('combined bonuses', () => {
        it('combines exact title match + URL contains (20 + 5 = 25 bonus)', () => {
            const result = { type: 'history', title: 'github', url: 'https://github.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            const expectedScore = BASE_SCORES.HISTORY + SCORE_BONUSES.EXACT_TITLE_MATCH + SCORE_BONUSES.URL_CONTAINS;
            expect(score).toBe(expectedScore);
        });

        it('combines title starts with + URL contains (15 + 5 = 20 bonus)', () => {
            const result = { type: 'bookmark', title: 'github profile', url: 'https://github.com/user' };
            const score = provider.calculateRelevanceScore(result, 'github');
            const expectedScore = BASE_SCORES.BOOKMARK + SCORE_BONUSES.TITLE_STARTS_WITH + SCORE_BONUSES.URL_CONTAINS;
            expect(score).toBe(expectedScore);
        });

        it('combines title contains + URL contains (10 + 5 = 15 bonus)', () => {
            const result = { type: 'open-tab', title: 'My github repo', url: 'https://github.com/repo' };
            const score = provider.calculateRelevanceScore(result, 'github');
            const expectedScore = BASE_SCORES.OPEN_TAB + SCORE_BONUSES.TITLE_CONTAINS + SCORE_BONUSES.URL_CONTAINS;
            expect(score).toBe(expectedScore);
        });
    });

    describe('matchScore integration', () => {
        it('adds matchScore bonus when matchScore is present in metadata', () => {
            const result = {
                type: 'open-tab',
                title: 'GitHub',
                url: 'https://github.com',
                metadata: { matchScore: 0.9 }
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.OPEN_TAB + 0.9 * 25);
        });

        it('perfect matchScore gives maximum bonus', () => {
            const result = {
                type: 'bookmark',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 1.0 }
            };
            const score = provider.calculateRelevanceScore(result, 'test');
            expect(score).toBe(BASE_SCORES.BOOKMARK + 25);
        });

        it('low matchScore gives small bonus', () => {
            const result = {
                type: 'history',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0.2 }
            };
            const score = provider.calculateRelevanceScore(result, 'test');
            expect(score).toBe(BASE_SCORES.HISTORY + 0.2 * 25);
        });

        it('skips string matching bonuses when matchScore is present', () => {
            const result = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: { matchScore: 0.95 }
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            // Should use matchScore bonus (23.75), NOT string bonuses (20+5=25)
            expect(score).toBe(BASE_SCORES.HISTORY + 0.95 * 25);
        });

        it('falls back to string matching when matchScore is null', () => {
            const result = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: { matchScore: null }
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.EXACT_TITLE_MATCH + SCORE_BONUSES.URL_CONTAINS);
        });

        it('falls back to string matching when metadata has no matchScore', () => {
            const result = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: {}
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.EXACT_TITLE_MATCH + SCORE_BONUSES.URL_CONTAINS);
        });

        it('preserves type hierarchy even with matchScore', () => {
            const tabResult = {
                type: 'open-tab',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0.5 }
            };
            const bookmarkResult = {
                type: 'bookmark',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0.5 }
            };
            const tabScore = provider.calculateRelevanceScore(tabResult, 'test');
            const bookmarkScore = provider.calculateRelevanceScore(bookmarkResult, 'test');
            expect(tabScore).toBeGreaterThan(bookmarkScore);
        });

        it('does not add bonus when matchScore is 0', () => {
            const result = {
                type: 'history',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0 }
            };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            // matchScore is 0, so falls through to string matching path
            expect(score).toBe(BASE_SCORES.HISTORY);
        });
    });

    describe('case insensitivity', () => {
        it('matches title regardless of case', () => {
            const result = { type: 'history', title: 'GitHub', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.EXACT_TITLE_MATCH);
        });

        it('matches URL regardless of case', () => {
            const result = { type: 'history', title: 'Test', url: 'https://GITHUB.com' };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBe(BASE_SCORES.HISTORY + SCORE_BONUSES.URL_CONTAINS);
        });
    });

    describe('minimum score enforcement', () => {
        it('never returns negative score', () => {
            const result = { type: 'unknown-type', title: 'Test', url: 'https://test.com' };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('BASE_SCORES constants', () => {
    it('has correct hierarchy (higher types rank first)', () => {
        expect(BASE_SCORES.OPEN_TAB).toBeGreaterThan(BASE_SCORES.BOOKMARK);
        expect(BASE_SCORES.BOOKMARK).toBeGreaterThan(BASE_SCORES.HISTORY);
        expect(BASE_SCORES.HISTORY).toBeGreaterThan(BASE_SCORES.TOP_SITE);
        expect(BASE_SCORES.TOP_SITE).toBeGreaterThan(BASE_SCORES.AUTOCOMPLETE_SUGGESTION);
    });

    it('places pinned tabs between open tabs and bookmarks', () => {
        expect(BASE_SCORES.PINNED_TAB).toBeLessThan(BASE_SCORES.OPEN_TAB);
        expect(BASE_SCORES.PINNED_TAB).toBeGreaterThan(BASE_SCORES.BOOKMARK);
    });

    it('places fuzzy matches between history and autocomplete', () => {
        expect(BASE_SCORES.FUZZY_MATCH_START).toBeLessThan(BASE_SCORES.HISTORY);
        expect(BASE_SCORES.FUZZY_MATCH_START).toBeGreaterThan(BASE_SCORES.AUTOCOMPLETE_SUGGESTION);
    });
});

describe('SCORE_BONUSES constants', () => {
    it('has correct bonus hierarchy', () => {
        expect(SCORE_BONUSES.EXACT_TITLE_MATCH).toBeGreaterThan(SCORE_BONUSES.TITLE_STARTS_WITH);
        expect(SCORE_BONUSES.TITLE_STARTS_WITH).toBeGreaterThan(SCORE_BONUSES.TITLE_CONTAINS);
        expect(SCORE_BONUSES.TITLE_CONTAINS).toBeGreaterThan(SCORE_BONUSES.URL_CONTAINS);
    });
});
