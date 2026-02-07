import { describe, it, expect } from 'vitest';
import { FuseSearchService } from '../../shared/fuse-search-service.js';
import { findMatchingDomains } from '../../shared/popular-sites.js';

describe('FuseSearchService.search', () => {
    const testItems = [
        { title: 'GitHub', url: 'https://github.com' },
        { title: 'Gmail', url: 'https://mail.google.com' },
        { title: 'Google', url: 'https://google.com' },
        { title: 'Facebook', url: 'https://facebook.com' },
        { title: 'YouTube', url: 'https://youtube.com' },
        { title: 'Reddit', url: 'https://reddit.com' },
        { title: 'Twitter', url: 'https://twitter.com' },
    ];

    const searchKeys = [
        { name: 'title', weight: 2 },
        { name: 'url', weight: 1 }
    ];

    describe('basic matching with score', () => {
        it('returns results with item and matchScore properties', () => {
            const results = FuseSearchService.search(testItems, 'github', { keys: searchKeys });
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('item');
            expect(results[0]).toHaveProperty('matchScore');
        });

        it('matchScore is between 0 and 1', () => {
            const results = FuseSearchService.search(testItems, 'github', { keys: searchKeys });
            for (const result of results) {
                expect(result.matchScore).toBeGreaterThanOrEqual(0);
                expect(result.matchScore).toBeLessThanOrEqual(1);
            }
        });

        it('matchScore is close to 1 for exact matches', () => {
            const results = FuseSearchService.search(testItems, 'GitHub', { keys: searchKeys });
            const githubResult = results.find(r => r.item.title === 'GitHub');
            expect(githubResult).toBeDefined();
            expect(githubResult.matchScore).toBeGreaterThan(0.8);
        });
    });

    describe('key abbreviation patterns', () => {
        // Fuse.js uses Bitap algorithm which handles prefix/substring matching well
        // but may not match all character-order abbreviations that the old fuzzyMatch did.
        // We test what Fuse.js actually supports at threshold 0.4.

        it('"goog" matches Google', () => {
            const results = FuseSearchService.search(testItems, 'goog', { keys: searchKeys });
            const match = results.find(r => r.item.title === 'Google');
            expect(match).toBeDefined();
            expect(match.matchScore).toBeGreaterThan(0);
        });

        it('"git" matches GitHub', () => {
            const results = FuseSearchService.search(testItems, 'git', { keys: searchKeys });
            const match = results.find(r => r.item.title === 'GitHub');
            expect(match).toBeDefined();
            expect(match.matchScore).toBeGreaterThan(0);
        });

        it('"face" matches Facebook', () => {
            const results = FuseSearchService.search(testItems, 'face', { keys: searchKeys });
            const match = results.find(r => r.item.title === 'Facebook');
            expect(match).toBeDefined();
            expect(match.matchScore).toBeGreaterThan(0);
        });

        it('"red" matches Reddit', () => {
            const results = FuseSearchService.search(testItems, 'red', { keys: searchKeys });
            const match = results.find(r => r.item.title === 'Reddit');
            expect(match).toBeDefined();
            expect(match.matchScore).toBeGreaterThan(0);
        });

        it('"you" matches YouTube', () => {
            const results = FuseSearchService.search(testItems, 'you', { keys: searchKeys });
            const match = results.find(r => r.item.title === 'YouTube');
            expect(match).toBeDefined();
            expect(match.matchScore).toBeGreaterThan(0);
        });

        // Note: "ghub", "fb", "yt", "gml", "rd", "tw" are character-order abbreviations
        // that Fuse.js's Bitap algorithm does NOT support at threshold 0.4.
        // These were specific to the old fuzzyMatch's character-in-order matching.
        // Fuse.js handles prefix/substring matching, not scattered character matching.
    });

    describe('title weight > URL weight (MATCH-02)', () => {
        it('title match ranks higher than URL-only match', () => {
            const items = [
                { title: 'GitHub Dashboard', url: 'https://example.com' },
                { title: 'My Page', url: 'https://github.com/repo' },
            ];
            const results = FuseSearchService.search(items, 'github', { keys: searchKeys });
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].item.title).toBe('GitHub Dashboard');
        });
    });

    describe('short query false positive prevention (MATCH-03)', () => {
        it('does not match unrelated items with short queries', () => {
            const results = FuseSearchService.search(
                [{ title: 'xyz123', url: 'https://xyz.com' }],
                'ab',
                { keys: searchKeys }
            );
            expect(results).toEqual([]);
        });

        it('minMatchCharLength 2 prevents single-char clutter', () => {
            // Default minMatchCharLength is 2, so single char queries return nothing
            const results = FuseSearchService.search(testItems, 'g', { keys: searchKeys });
            expect(results).toEqual([]);
        });
    });

    describe('empty/null inputs', () => {
        it('returns [] for empty items array', () => {
            expect(FuseSearchService.search([], 'query', { keys: searchKeys })).toEqual([]);
        });

        it('returns [] for empty query', () => {
            expect(FuseSearchService.search(testItems, '', { keys: searchKeys })).toEqual([]);
        });

        it('returns [] for null items', () => {
            expect(FuseSearchService.search(null, 'query', { keys: searchKeys })).toEqual([]);
        });
    });

    describe('score inversion correctness', () => {
        it('exact match has matchScore close to 1.0 (not 0.0)', () => {
            const results = FuseSearchService.search(testItems, 'GitHub', { keys: searchKeys });
            const githubResult = results.find(r => r.item.title === 'GitHub');
            expect(githubResult).toBeDefined();
            // Score should be close to 1 (our inverted scale), NOT close to 0 (Fuse.js raw scale)
            expect(githubResult.matchScore).toBeGreaterThan(0.8);
        });
    });
});

describe('findMatchingDomains (Fuse.js version)', () => {
    describe('basic matching', () => {
        it('"git" finds github.com and gitlab.com', () => {
            const results = findMatchingDomains('git');
            const domains = results.map(r => r.domain);
            expect(domains).toContain('github.com');
            expect(domains).toContain('gitlab.com');
        });

        it('"squaresp" finds squarespace.com', () => {
            const results = findMatchingDomains('squaresp');
            const match = results.find(r => r.domain === 'squarespace.com');
            expect(match).toBeDefined();
        });

        it('"face" finds facebook.com', () => {
            const results = findMatchingDomains('face');
            const match = results.find(r => r.domain === 'facebook.com');
            expect(match).toBeDefined();
        });
    });

    describe('return structure', () => {
        it('results have domain, displayName, and matchScore properties', () => {
            const results = findMatchingDomains('github');
            expect(results.length).toBeGreaterThan(0);

            const result = results[0];
            expect(result).toHaveProperty('domain');
            expect(result).toHaveProperty('displayName');
            expect(result).toHaveProperty('matchScore');
        });

        it('matchScore is a number between 0 and 1', () => {
            const results = findMatchingDomains('github');
            for (const result of results) {
                expect(typeof result.matchScore).toBe('number');
                expect(result.matchScore).toBeGreaterThanOrEqual(0);
                expect(result.matchScore).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('maxResults', () => {
        it('respects maxResults parameter', () => {
            const results = findMatchingDomains('go', 3);
            expect(results.length).toBeLessThanOrEqual(3);
        });

        it('defaults to 10 max results', () => {
            const results = findMatchingDomains('google');
            expect(results.length).toBeLessThanOrEqual(10);
        });
    });

    describe('no matches', () => {
        it('returns [] for nonsense query', () => {
            const results = findMatchingDomains('zzzzxxxxxqqqqq');
            expect(results).toEqual([]);
        });
    });

    describe('empty input', () => {
        it('returns [] for empty string', () => {
            const results = findMatchingDomains('');
            expect(results).toEqual([]);
        });
    });
});
