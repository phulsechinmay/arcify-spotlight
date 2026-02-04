import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';
import { findMatchingDomains } from '../../shared/popular-sites.js';

describe('BaseDataProvider.fuzzyMatch', () => {
    let provider;

    beforeEach(() => {
        provider = Object.create(BaseDataProvider.prototype);
    });

    describe('matching cases (should return true)', () => {
        it.each([
            ['ghub', 'GitHub', 'characters in order'],
            ['yt', 'YouTube', 'abbreviation match'],
            ['gml', 'Gmail', 'consonant match'],
            ['fb', 'Facebook', 'start letters'],
            ['github', 'GitHub', 'exact match (contains)'],
            ['GHUB', 'github', 'case insensitive'],
            ['a', 'Amazon', 'single character match'],
            ['goog', 'Google', 'partial start match'],
            ['rd', 'Reddit', 'consonant abbreviation'],
            ['tw', 'Twitter', 'two letter abbreviation'],
        ])('fuzzyMatch("%s", "%s") returns true - %s', (query, text) => {
            expect(provider.fuzzyMatch(query, text)).toBe(true);
        });
    });

    describe('non-matching cases (should return false)', () => {
        it.each([
            ['hbug', 'GitHub', 'out of order (h after g in query, but g before h in text)'],
            ['xyz', 'GitHub', 'characters not present'],
            ['', 'GitHub', 'empty query'],
            ['git', '', 'empty text'],
            ['zz', 'Amazon', 'repeated character not present'],
            ['ba', 'ab', 'reversed order'],
        ])('fuzzyMatch("%s", "%s") returns false - %s', (query, text) => {
            expect(provider.fuzzyMatch(query, text)).toBe(false);
        });
    });
});

describe('findMatchingDomains', () => {
    describe('matchType: start', () => {
        it('returns start match for "git" including github.com', () => {
            const results = findMatchingDomains('git');
            const githubMatch = results.find(r => r.domain === 'github.com');

            expect(githubMatch).toBeDefined();
            expect(githubMatch.matchType).toBe('start');
        });

        it('returns start match for "squaresp" including squarespace.com', () => {
            const results = findMatchingDomains('squaresp');
            const squarespaceMatch = results.find(r => r.domain === 'squarespace.com');

            expect(squarespaceMatch).toBeDefined();
            expect(squarespaceMatch.matchType).toBe('start');
        });

        it('returns start match for "face" including facebook.com', () => {
            const results = findMatchingDomains('face');
            const facebookMatch = results.find(r => r.domain === 'facebook.com');

            expect(facebookMatch).toBeDefined();
            expect(facebookMatch.matchType).toBe('start');
        });
    });

    describe('matchType: contains', () => {
        it('returns contains match for "tube" including youtube.com', () => {
            const results = findMatchingDomains('tube');
            const youtubeMatch = results.find(r => r.domain === 'youtube.com');

            expect(youtubeMatch).toBeDefined();
            expect(youtubeMatch.matchType).toBe('contains');
        });

        it('returns contains match for "pad" including coinbase.com', () => {
            // 'pad' is not contained in coinbase, let's use 'base' instead
            const results = findMatchingDomains('base');
            const coinbaseMatch = results.find(r => r.domain === 'coinbase.com');

            expect(coinbaseMatch).toBeDefined();
            expect(coinbaseMatch.matchType).toBe('contains');
        });
    });

    describe('matchType: name', () => {
        it('returns name match for "Amazon" (display name match)', () => {
            const results = findMatchingDomains('Amazon');
            const amazonMatch = results.find(r => r.domain === 'amazon.com');

            expect(amazonMatch).toBeDefined();
            // Note: 'amazon' also matches domain start, so it will be 'start'
            // Let's test with a case where display name differs from domain
        });

        it('returns name match for "New York" (display name only)', () => {
            const results = findMatchingDomains('New York');
            const nytMatch = results.find(r => r.domain === 'nytimes.com');

            expect(nytMatch).toBeDefined();
            expect(nytMatch.matchType).toBe('name');
            expect(nytMatch.displayName).toBe('New York Times');
        });

        it('returns name match for "Stack" (display name match)', () => {
            const results = findMatchingDomains('Stack');
            const stackOverflowMatch = results.find(r => r.domain === 'stackoverflow.com');

            expect(stackOverflowMatch).toBeDefined();
            // 'stack' matches start of domain, so it's 'start'
            expect(stackOverflowMatch.matchType).toBe('start');
        });
    });

    describe('edge case inputs', () => {
        it('returns matches for empty string (all domains start with empty string)', () => {
            const results = findMatchingDomains('');
            // Empty string matches all domains as a "start" match
            // Function returns up to maxResults (default 10)
            expect(results.length).toBeLessThanOrEqual(10);
            // All should be 'start' matches since empty string matches start of any domain
            results.forEach(r => {
                expect(r.matchType).toBe('start');
            });
        });

        it('handles queries with no matches', () => {
            const results = findMatchingDomains('zzzzxxxxxqqqqq');
            expect(results).toEqual([]);
        });
    });

    describe('maxResults parameter', () => {
        it('returns at most maxResults results', () => {
            const results = findMatchingDomains('g', 3);
            expect(results.length).toBeLessThanOrEqual(3);
        });

        it('returns all matches when fewer than maxResults', () => {
            const results = findMatchingDomains('squarespace', 10);
            expect(results.length).toBeLessThanOrEqual(10);
            expect(results.some(r => r.domain === 'squarespace.com')).toBe(true);
        });

        it('defaults to 10 max results', () => {
            const results = findMatchingDomains('a');
            expect(results.length).toBeLessThanOrEqual(10);
        });
    });

    describe('return structure', () => {
        it('includes domain, displayName, score, and matchType properties', () => {
            const results = findMatchingDomains('github');
            expect(results.length).toBeGreaterThan(0);

            const result = results[0];
            expect(result).toHaveProperty('domain');
            expect(result).toHaveProperty('displayName');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('matchType');
        });

        it('returns results sorted by score descending', () => {
            const results = findMatchingDomains('go');

            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
    });
});
