import { describe, it, expect, beforeEach } from 'vitest';
import {
    BASE_SCORES,
    SCORE_BONUSES,
    SCORING_WEIGHTS,
    TYPE_SCORE_MAP,
    SCORE_SCALE,
    calculateRecencyScore,
    calculateFrequencyScore,
    AUTOCOMPLETE_BOOST_MAX,
    LOCAL_RESULT_THRESHOLD,
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
        // With the new weighted formula, results without matchScore get a synthetic
        // matchScore. Query 'nomatch' does not match title 'Test' or url 'test.com',
        // so synthetic = 0.1 (baseline). Verify type hierarchy is preserved and
        // scores are within valid range, rather than exact values.

        it('preserves non-history type hierarchy: open-tab > pinned-tab > bookmark > top-site', () => {
            // Non-history types use redistributed weights (TYPE+MATCH only)
            // so hierarchy is preserved with same synthetic matchScore
            const types = ['open-tab', 'pinned-tab', 'bookmark', 'top-site'];
            const scores = types.map(type => {
                const result = { type, title: 'Test', url: 'https://test.com' };
                return provider.calculateRelevanceScore(result, 'nomatch');
            });

            for (let i = 0; i < scores.length - 1; i++) {
                expect(scores[i]).toBeGreaterThan(scores[i + 1]);
            }
        });

        it('history without recency/frequency scores lower than with', () => {
            // History uses all 4 weights; without recency/frequency data,
            // those signals contribute 0, giving a lower score
            const withSignals = {
                type: 'history', title: 'Test', url: 'https://test.com',
                metadata: { lastVisitTime: Date.now() - 60000, visitCount: 10 }
            };
            const withoutSignals = { type: 'history', title: 'Test', url: 'https://test.com' };

            const withScore = provider.calculateRelevanceScore(withSignals, 'nomatch');
            const withoutScore = provider.calculateRelevanceScore(withoutSignals, 'nomatch');

            expect(withScore).toBeGreaterThan(withoutScore);
        });

        it('all type scores are positive', () => {
            const types = ['open-tab', 'pinned-tab', 'bookmark', 'history', 'top-site'];
            types.forEach(type => {
                const result = { type, title: 'Test', url: 'https://test.com' };
                const score = provider.calculateRelevanceScore(result, 'nomatch');
                expect(score).toBeGreaterThan(0);
            });
        });

        it('all type scores are within SCORE_SCALE', () => {
            const types = ['open-tab', 'pinned-tab', 'bookmark', 'history', 'top-site'];
            types.forEach(type => {
                const result = { type, title: 'Test', url: 'https://test.com' };
                const score = provider.calculateRelevanceScore(result, 'nomatch');
                expect(score).toBeLessThanOrEqual(SCORE_SCALE);
            });
        });
    });

    describe('title match bonuses (synthetic matchScore)', () => {
        // With the new formula, string matching produces a synthetic matchScore.
        // Verify RELATIVE ordering: exact > starts with > contains > URL only > no match

        it('exact title match scores higher than title starts with', () => {
            const exact = { type: 'history', title: 'github', url: 'https://test.com' };
            const startsWith = { type: 'history', title: 'github repo', url: 'https://test.com' };
            const exactScore = provider.calculateRelevanceScore(exact, 'github');
            const startsWithScore = provider.calculateRelevanceScore(startsWith, 'github');
            expect(exactScore).toBeGreaterThan(startsWithScore);
        });

        it('title starts with scores higher than title contains', () => {
            const startsWith = { type: 'history', title: 'github repo', url: 'https://test.com' };
            const contains = { type: 'history', title: 'my github page', url: 'https://test.com' };
            const startsWithScore = provider.calculateRelevanceScore(startsWith, 'github');
            const containsScore = provider.calculateRelevanceScore(contains, 'github');
            expect(startsWithScore).toBeGreaterThan(containsScore);
        });

        it('title contains scores higher than no match', () => {
            const contains = { type: 'history', title: 'my github page', url: 'https://test.com' };
            const noMatch = { type: 'history', title: 'Test Page', url: 'https://test.com' };
            const containsScore = provider.calculateRelevanceScore(contains, 'github');
            const noMatchScore = provider.calculateRelevanceScore(noMatch, 'github');
            expect(containsScore).toBeGreaterThan(noMatchScore);
        });
    });

    describe('URL match bonuses (synthetic matchScore)', () => {
        it('URL contains query scores higher than no match at all', () => {
            const urlMatch = { type: 'history', title: 'Test Page', url: 'https://github.com/repo' };
            const noMatch = { type: 'history', title: 'Test Page', url: 'https://example.com' };
            const urlScore = provider.calculateRelevanceScore(urlMatch, 'github');
            const noMatchScore = provider.calculateRelevanceScore(noMatch, 'github');
            expect(urlScore).toBeGreaterThan(noMatchScore);
        });

        it('title match outranks URL-only match', () => {
            const titleMatch = { type: 'history', title: 'my github page', url: 'https://test.com' };
            const urlMatch = { type: 'history', title: 'Test Page', url: 'https://github.com/repo' };
            const titleScore = provider.calculateRelevanceScore(titleMatch, 'github');
            const urlScore = provider.calculateRelevanceScore(urlMatch, 'github');
            expect(titleScore).toBeGreaterThan(urlScore);
        });
    });

    describe('combined match quality', () => {
        it('exact title + URL match scores highest for same type', () => {
            const combined = { type: 'history', title: 'github', url: 'https://github.com' };
            const titleOnly = { type: 'history', title: 'github', url: 'https://test.com' };
            // Both have exact title match (synthetic=1.0), and the combined also has URL match
            // but exact title match already gives synthetic=1.0, so URL match does not increase further
            const combinedScore = provider.calculateRelevanceScore(combined, 'github');
            const titleOnlyScore = provider.calculateRelevanceScore(titleOnly, 'github');
            // Both should be equal since exact title match gives max synthetic score
            expect(combinedScore).toBe(titleOnlyScore);
        });

        it('URL match provides score when title does not match', () => {
            const urlMatch = { type: 'bookmark', title: 'My Profile', url: 'https://github.com/user' };
            const noMatch = { type: 'bookmark', title: 'My Profile', url: 'https://example.com' };
            const urlScore = provider.calculateRelevanceScore(urlMatch, 'github');
            const noMatchScore = provider.calculateRelevanceScore(noMatch, 'github');
            expect(urlScore).toBeGreaterThan(noMatchScore);
        });
    });

    describe('matchScore integration', () => {
        it('uses Fuse.js matchScore in weighted formula', () => {
            const result = {
                type: 'open-tab',
                title: 'GitHub',
                url: 'https://github.com',
                metadata: { matchScore: 0.9 }
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            // Non-history: (effectiveTypeW * typeScore + effectiveMatchW * matchScore) * SCORE_SCALE
            // effectiveTypeW = 0.40/0.75 = 0.533, effectiveMatchW = 0.35/0.75 = 0.467
            // (0.533 * 1.0 + 0.467 * 0.9) * 115
            const weightSum = SCORING_WEIGHTS.TYPE + SCORING_WEIGHTS.MATCH;
            const expected = (SCORING_WEIGHTS.TYPE / weightSum * TYPE_SCORE_MAP['open-tab'] +
                             SCORING_WEIGHTS.MATCH / weightSum * 0.9) * SCORE_SCALE;
            expect(score).toBeCloseTo(expected, 0);
        });

        it('perfect matchScore gives maximum score for type', () => {
            const result = {
                type: 'bookmark',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 1.0 }
            };
            const score = provider.calculateRelevanceScore(result, 'test');
            const weightSum = SCORING_WEIGHTS.TYPE + SCORING_WEIGHTS.MATCH;
            const expected = (SCORING_WEIGHTS.TYPE / weightSum * TYPE_SCORE_MAP['bookmark'] +
                             SCORING_WEIGHTS.MATCH / weightSum * 1.0) * SCORE_SCALE;
            expect(score).toBeCloseTo(expected, 0);
        });

        it('low matchScore gives lower score than high matchScore for same type', () => {
            const low = {
                type: 'history',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0.2 }
            };
            const high = {
                type: 'history',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0.8, lastVisitTime: Date.now() - 3600000, visitCount: 5 }
            };
            const lowScore = provider.calculateRelevanceScore(low, 'test');
            const highScore = provider.calculateRelevanceScore(high, 'test');
            expect(highScore).toBeGreaterThan(lowScore);
        });

        it('skips string matching bonuses when matchScore is present', () => {
            const withMatchScore = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: { matchScore: 0.95 }
            };
            const withoutMatchScore = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: {}
            };
            const scoreWithMs = provider.calculateRelevanceScore(withMatchScore, 'github');
            const scoreWithoutMs = provider.calculateRelevanceScore(withoutMatchScore, 'github');
            // Different paths should produce different scores (matchScore=0.95 vs synthetic=1.0)
            expect(scoreWithMs).not.toBe(scoreWithoutMs);
        });

        it('falls back to synthetic matchScore when matchScore is null', () => {
            const result = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: { matchScore: null }
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            // Should still get a reasonable score via synthetic path (exact title match = 1.0)
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(SCORE_SCALE);
        });

        it('falls back to synthetic matchScore when metadata has no matchScore', () => {
            const result = {
                type: 'history',
                title: 'github',
                url: 'https://github.com',
                metadata: {}
            };
            const score = provider.calculateRelevanceScore(result, 'github');
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(SCORE_SCALE);
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

        it('matchScore 0 falls to synthetic path but still produces positive score', () => {
            const result = {
                type: 'history',
                title: 'Test',
                url: 'https://test.com',
                metadata: { matchScore: 0 }
            };
            const score = provider.calculateRelevanceScore(result, 'nomatch');
            // matchScore=0 triggers synthetic path, synthetic=0.1 (no match)
            // Score should be > 0 because type weight still contributes
            expect(score).toBeGreaterThan(0);
        });
    });

    describe('case insensitivity', () => {
        it('matches title regardless of case (same score for different case)', () => {
            const upper = { type: 'history', title: 'GitHub', url: 'https://test.com' };
            const lower = { type: 'history', title: 'github', url: 'https://test.com' };
            const upperScore = provider.calculateRelevanceScore(upper, 'github');
            const lowerScore = provider.calculateRelevanceScore(lower, 'github');
            expect(upperScore).toBe(lowerScore);
        });

        it('matches URL regardless of case', () => {
            const upper = { type: 'history', title: 'Test', url: 'https://GITHUB.com' };
            const lower = { type: 'history', title: 'Test', url: 'https://github.com' };
            const upperScore = provider.calculateRelevanceScore(upper, 'github');
            const lowerScore = provider.calculateRelevanceScore(lower, 'github');
            expect(upperScore).toBe(lowerScore);
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
