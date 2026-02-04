import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';
import { BASE_SCORES } from '../../shared/scoring-constants.js';

describe('BaseDataProvider.normalizeUrlForDeduplication', () => {
    let provider;

    beforeEach(() => {
        provider = Object.create(BaseDataProvider.prototype);
    });

    it.each([
        ['https://example.com#section', 'example.com', 'fragment removed'],
        ['https://example.com/', 'example.com', 'trailing slash removed'],
        ['https://example.com///', 'example.com', 'multiple trailing slashes removed'],
        ['http://example.com', 'example.com', 'protocol removed'],
        ['https://www.example.com', 'example.com', 'www prefix removed'],
        ['HTTPS://EXAMPLE.COM', 'example.com', 'lowercased'],
        ['https://example.com?q=test', 'example.com?q=test', 'query params preserved'],
        ['', '', 'empty string returns empty'],
    ])('normalizes %s to %s (%s)', (input, expected) => {
        expect(provider.normalizeUrlForDeduplication(input)).toBe(expected);
    });

    it('handles null input gracefully', () => {
        expect(provider.normalizeUrlForDeduplication(null)).toBe('');
    });
});

describe('BaseDataProvider.getResultPriority', () => {
    let provider;

    beforeEach(() => {
        provider = Object.create(BaseDataProvider.prototype);
    });

    describe('priority hierarchy', () => {
        it.each([
            ['open-tab', BASE_SCORES.OPEN_TAB, 'open tabs get OPEN_TAB score (90)'],
            ['pinned-tab', BASE_SCORES.PINNED_TAB, 'pinned tabs get PINNED_TAB score (85)'],
            ['bookmark', BASE_SCORES.BOOKMARK, 'bookmarks get BOOKMARK score (80)'],
            ['history', BASE_SCORES.HISTORY, 'history gets HISTORY score (70)'],
            ['top-site', BASE_SCORES.TOP_SITE, 'top sites get TOP_SITE score (60)'],
            ['autocomplete-suggestion', BASE_SCORES.AUTOCOMPLETE_SUGGESTION, 'autocomplete gets AUTOCOMPLETE_SUGGESTION score (30)'],
        ])('%s returns base score %d (%s)', (type, expectedBaseScore) => {
            const result = { type, score: 0 };
            const priority = provider.getResultPriority(result);
            expect(priority).toBe(expectedBaseScore);
        });
    });

    describe('deduplication behavior', () => {
        it('open-tab wins over history for same URL', () => {
            const openTabResult = { type: 'open-tab', url: 'https://example.com', score: 0 };
            const historyResult = { type: 'history', url: 'https://example.com', score: 0 };

            const openTabPriority = provider.getResultPriority(openTabResult);
            const historyPriority = provider.getResultPriority(historyResult);

            expect(openTabPriority).toBeGreaterThan(historyPriority);
        });

        it('bookmark wins over history for same URL', () => {
            const bookmarkResult = { type: 'bookmark', url: 'https://example.com', score: 0 };
            const historyResult = { type: 'history', url: 'https://example.com', score: 0 };

            const bookmarkPriority = provider.getResultPriority(bookmarkResult);
            const historyPriority = provider.getResultPriority(historyResult);

            expect(bookmarkPriority).toBeGreaterThan(historyPriority);
        });

        it('pinned-tab wins over bookmark for same URL', () => {
            const pinnedTabResult = { type: 'pinned-tab', url: 'https://example.com', score: 0 };
            const bookmarkResult = { type: 'bookmark', url: 'https://example.com', score: 0 };

            const pinnedTabPriority = provider.getResultPriority(pinnedTabResult);
            const bookmarkPriority = provider.getResultPriority(bookmarkResult);

            expect(pinnedTabPriority).toBeGreaterThan(bookmarkPriority);
        });

        it('open-tab wins over pinned-tab for same URL', () => {
            const openTabResult = { type: 'open-tab', url: 'https://example.com', score: 0 };
            const pinnedTabResult = { type: 'pinned-tab', url: 'https://example.com', score: 0 };

            const openTabPriority = provider.getResultPriority(openTabResult);
            const pinnedTabPriority = provider.getResultPriority(pinnedTabResult);

            expect(openTabPriority).toBeGreaterThan(pinnedTabPriority);
        });
    });

    describe('additional score handling', () => {
        it('includes result score in priority calculation', () => {
            const resultWithScore = { type: 'history', score: 10 };
            const resultWithoutScore = { type: 'history', score: 0 };

            const priorityWithScore = provider.getResultPriority(resultWithScore);
            const priorityWithoutScore = provider.getResultPriority(resultWithoutScore);

            expect(priorityWithScore).toBe(priorityWithoutScore + 10);
        });

        it('handles undefined type gracefully', () => {
            const result = { type: 'unknown-type', score: 0 };
            const priority = provider.getResultPriority(result);
            expect(priority).toBe(0);
        });
    });
});
