import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';
import { SearchResult, ResultType } from '../../shared/search-types.js';

describe('BaseDataProvider.enrichWithArcifyInfo', () => {
    let provider;
    let mockArcify;

    beforeEach(() => {
        // Create a BaseDataProvider instance with a pre-set mock arcifyProvider
        // This avoids the dynamic import() inside enrichWithArcifyInfo
        mockArcify = {
            ensureCacheBuilt: vi.fn().mockResolvedValue(undefined),
            hasData: vi.fn().mockReturnValue(true),
            getSpaceForUrl: vi.fn().mockImplementation(async (url) => {
                const urlMap = {
                    'https://github.com': { spaceName: 'Work', spaceId: 's1', bookmarkId: 'b1', bookmarkTitle: 'GitHub', spaceColor: 'blue' },
                    'https://mail.google.com': { spaceName: 'Personal', spaceId: 's2', bookmarkId: 'b4', bookmarkTitle: 'Gmail', spaceColor: 'green' }
                };
                return urlMap[url] || null;
            })
        };

        provider = new BaseDataProvider();
        provider.arcifyProvider = mockArcify;
    });

    it('enriches results with Arcify space metadata when URL matches', async () => {
        const results = [
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'GitHub', url: 'https://github.com', metadata: { tabId: 1, windowId: 1 } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(enriched[0].metadata.isArcify).toBe(true);
        expect(enriched[0].metadata.spaceName).toBe('Work');
        expect(enriched[0].metadata.spaceId).toBe('s1');
        expect(enriched[0].metadata.bookmarkId).toBe('b1');
        expect(enriched[0].metadata.bookmarkTitle).toBe('GitHub');
        expect(enriched[0].metadata.spaceColor).toBe('blue');
    });

    it('does not modify results when URL has no match (spaceInfo is null)', async () => {
        const results = [
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'Example', url: 'https://example.com', metadata: { tabId: 2, windowId: 1 } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(enriched[0].metadata.isArcify).toBeUndefined();
        expect(enriched[0].metadata.spaceName).toBeUndefined();
    });

    it('skips results that already have spaceName (pinned tabs with existing space info)', async () => {
        const results = [
            new SearchResult({
                type: ResultType.PINNED_TAB,
                title: 'GitHub',
                url: 'https://github.com',
                metadata: { bookmarkId: 'b1', spaceName: 'Work', spaceColor: 'blue' }
            })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        // getSpaceForUrl should NOT be called for this result
        expect(mockArcify.getSpaceForUrl).not.toHaveBeenCalled();
        // Original metadata should be preserved unchanged
        expect(enriched[0].metadata.spaceName).toBe('Work');
    });

    it('skips results without URL (search queries, etc.)', async () => {
        const results = [
            new SearchResult({ type: ResultType.SEARCH_QUERY, title: 'Search for "test"', url: '', metadata: { query: 'test' } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(mockArcify.getSpaceForUrl).not.toHaveBeenCalled();
        expect(enriched[0].metadata.isArcify).toBeUndefined();
    });

    it('returns results unchanged when arcifyProvider.hasData() is false', async () => {
        mockArcify.hasData.mockReturnValue(false);

        const results = [
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'GitHub', url: 'https://github.com', metadata: { tabId: 1 } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(mockArcify.getSpaceForUrl).not.toHaveBeenCalled();
        expect(enriched[0].metadata.isArcify).toBeUndefined();
    });

    it('handles multiple results, enriching only matching ones', async () => {
        const results = [
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'GitHub', url: 'https://github.com', metadata: { tabId: 1, windowId: 1 } }),
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'Example', url: 'https://example.com', metadata: { tabId: 2, windowId: 1 } }),
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'Gmail', url: 'https://mail.google.com', metadata: { tabId: 3, windowId: 1 } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(enriched[0].metadata.isArcify).toBe(true);
        expect(enriched[0].metadata.spaceName).toBe('Work');
        expect(enriched[1].metadata.isArcify).toBeUndefined(); // no match
        expect(enriched[2].metadata.isArcify).toBe(true);
        expect(enriched[2].metadata.spaceName).toBe('Personal');
    });

    it('adds isArcify, spaceName, spaceId, bookmarkId, bookmarkTitle, spaceColor to metadata', async () => {
        const results = [
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'Gmail', url: 'https://mail.google.com', metadata: { tabId: 3 } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(enriched[0].metadata).toEqual(expect.objectContaining({
            isArcify: true,
            spaceName: 'Personal',
            spaceId: 's2',
            bookmarkId: 'b4',
            bookmarkTitle: 'Gmail',
            spaceColor: 'green'
        }));
    });

    it('defaults spaceColor to grey when spaceInfo has no color', async () => {
        mockArcify.getSpaceForUrl.mockResolvedValue({
            spaceName: 'NoColor', spaceId: 's3', bookmarkId: 'b5', bookmarkTitle: 'Test'
            // No spaceColor
        });

        const results = [
            new SearchResult({ type: ResultType.OPEN_TAB, title: 'Test', url: 'https://test.com', metadata: { tabId: 1 } })
        ];

        const enriched = await provider.enrichWithArcifyInfo(results);

        expect(enriched[0].metadata.spaceColor).toBe('grey');
    });

    it('creates metadata object if result has none', async () => {
        const result = new SearchResult({ type: ResultType.OPEN_TAB, title: 'GitHub', url: 'https://github.com' });
        // Forcefully remove metadata to simulate edge case
        result.metadata = null;

        const enriched = await provider.enrichWithArcifyInfo([result]);

        expect(enriched[0].metadata).toBeDefined();
        expect(enriched[0].metadata.isArcify).toBe(true);
        expect(enriched[0].metadata.spaceName).toBe('Work');
    });
});
