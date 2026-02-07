/**
 * Integration Regression Tests (REG-02)
 *
 * Validates behavioral contracts after v2.0 migration (Phases 9-11):
 * - Deduplication across data sources (same URL, multiple sources -> one result)
 * - Arcify enrichment in full pipeline (isArcify metadata on matching URLs)
 * - Action routing contracts (correct Chrome API called per result type)
 *
 * Architecture: TestDataProvider extends BaseDataProvider, overriding ONLY
 * the abstract data fetcher methods. All real business logic runs:
 * getSpotlightSuggestions, getLocalSuggestions, deduplicateResults,
 * enrichWithArcifyInfo, scoreAndSortResults, calculateRelevanceScore.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseDataProvider } from '../../shared/data-providers/base-data-provider.js';
import { SearchResult, ResultType, SpotlightTabMode } from '../../shared/search-types.js';
import { SearchEngine } from '../../shared/search-engine.js';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

/**
 * TestDataProvider - extends BaseDataProvider with controllable data sources.
 * Only abstract fetcher methods are overridden; all pipeline logic is production code.
 */
class TestDataProvider extends BaseDataProvider {
    constructor() {
        super();
        this._openTabs = [];
        this._bookmarks = [];
        this._history = [];
        this._topSites = [];
        this._autocomplete = [];
        this._pinnedTabs = [];
        this._recentTabs = [];
    }

    async getOpenTabsData(query = '') {
        return this._openTabs;
    }

    async getBookmarksData(query) {
        return this._bookmarks;
    }

    async getHistoryData(query) {
        return this._history;
    }

    async getTopSitesData() {
        return this._topSites;
    }

    async getAutocompleteData(query) {
        return this._autocomplete;
    }

    async getPinnedTabsData(query = '') {
        return this._pinnedTabs;
    }

    async getRecentTabsData(limit = 5) {
        return this._recentTabs;
    }
}

// ============================================================
// REG-02: Deduplication across data sources
// ============================================================
describe('REG-02: Deduplication across data sources', () => {
    let provider;

    beforeEach(() => {
        provider = new TestDataProvider();
        // Mock arcifyProvider to skip dynamic import and return no matches
        provider.arcifyProvider = {
            ensureCacheBuilt: vi.fn().mockResolvedValue(undefined),
            hasData: vi.fn().mockReturnValue(false),
            getSpaceForUrl: vi.fn().mockResolvedValue(null)
        };
    });

    it('same URL from history + open tabs produces exactly 1 result with type open-tab', async () => {
        const sharedUrl = 'https://github.com/dashboard';

        provider._openTabs = [
            { id: 10, windowId: 1, title: 'GitHub Dashboard', url: sharedUrl, favIconUrl: '', _matchScore: 0.9 }
        ];
        provider._history = [
            { title: 'GitHub Dashboard', url: sharedUrl, visitCount: 5, lastVisitTime: Date.now() - 3600000, _matchScore: 0.85 }
        ];

        const results = await provider.getSpotlightSuggestions('github');

        const githubResults = results.filter(r => r.url === sharedUrl);
        expect(githubResults).toHaveLength(1);
        expect(githubResults[0].type).toBe(ResultType.OPEN_TAB);
    });

    it('same URL from bookmark + history produces exactly 1 result with type bookmark', async () => {
        const sharedUrl = 'https://docs.python.org/3/';

        provider._bookmarks = [
            { id: 'bk1', title: 'Python Docs', url: sharedUrl, _matchScore: 0.8 }
        ];
        provider._history = [
            { title: 'Python Docs', url: sharedUrl, visitCount: 10, lastVisitTime: Date.now() - 7200000, _matchScore: 0.75 }
        ];

        const results = await provider.getSpotlightSuggestions('python');

        const pythonResults = results.filter(r =>
            provider.normalizeUrlForDeduplication(r.url) === provider.normalizeUrlForDeduplication(sharedUrl)
        );
        expect(pythonResults).toHaveLength(1);
        expect(pythonResults[0].type).toBe(ResultType.BOOKMARK);
    });

    it('URL normalization: https://www.example.com/ and http://example.com deduplicate to 1 result', async () => {
        provider._openTabs = [
            { id: 20, windowId: 1, title: 'Example', url: 'https://www.example.com/', favIconUrl: '', _matchScore: 0.9 }
        ];
        provider._history = [
            { title: 'Example', url: 'http://example.com', visitCount: 3, lastVisitTime: Date.now() - 1800000, _matchScore: 0.7 }
        ];

        const results = await provider.getSpotlightSuggestions('example');

        const exampleResults = results.filter(r =>
            provider.normalizeUrlForDeduplication(r.url) === 'example.com'
        );
        expect(exampleResults).toHaveLength(1);
    });

    it('different URLs from different sources are all preserved (no false dedup)', async () => {
        provider._openTabs = [
            { id: 30, windowId: 1, title: 'GitHub', url: 'https://github.com', favIconUrl: '', _matchScore: 0.9 }
        ];
        provider._bookmarks = [
            { id: 'bk2', title: 'GitLab', url: 'https://gitlab.com', _matchScore: 0.85 }
        ];
        provider._history = [
            { title: 'Gitea', url: 'https://gitea.io', visitCount: 2, lastVisitTime: Date.now() - 3600000, _matchScore: 0.7 }
        ];

        const results = await provider.getSpotlightSuggestions('git');

        const urls = results.map(r => provider.normalizeUrlForDeduplication(r.url));
        // All three unique URLs should be present (may include top-site/domain matches too)
        expect(urls).toContain('github.com');
        expect(urls).toContain('gitlab.com');
        expect(urls).toContain('gitea.io');
    });

    it('getLocalSuggestions deduplicates same URL from tabs + bookmarks to 1 result', async () => {
        const sharedUrl = 'https://stackoverflow.com/questions';

        provider._openTabs = [
            { id: 40, windowId: 1, title: 'Stack Overflow', url: sharedUrl, favIconUrl: '', _matchScore: 0.95 }
        ];
        provider._bookmarks = [
            { id: 'bk3', title: 'Stack Overflow Questions', url: sharedUrl, _matchScore: 0.8 }
        ];

        // getLocalSuggestions uses the same dedup pipeline (PERF-03 progressive rendering)
        const results = await provider.getLocalSuggestions('stackoverflow');

        const soResults = results.filter(r =>
            provider.normalizeUrlForDeduplication(r.url) === provider.normalizeUrlForDeduplication(sharedUrl)
        );
        expect(soResults).toHaveLength(1);
        expect(soResults[0].type).toBe(ResultType.OPEN_TAB);
    });
});

// ============================================================
// REG-02: Arcify enrichment in pipeline
// ============================================================
describe('REG-02: Arcify enrichment in pipeline', () => {
    let provider;
    let mockArcify;

    beforeEach(() => {
        provider = new TestDataProvider();

        mockArcify = {
            ensureCacheBuilt: vi.fn().mockResolvedValue(undefined),
            hasData: vi.fn().mockReturnValue(true),
            getSpaceForUrl: vi.fn().mockImplementation(async (url) => {
                const urlMap = {
                    'https://github.com/dashboard': {
                        spaceName: 'Dev',
                        spaceId: 'space-1',
                        bookmarkId: 'bm-1',
                        bookmarkTitle: 'GitHub',
                        spaceColor: 'blue'
                    }
                };
                return urlMap[url] || null;
            })
        };

        provider.arcifyProvider = mockArcify;
    });

    it('open tab matching Arcify URL has isArcify, spaceName, spaceColor in metadata', async () => {
        provider._openTabs = [
            { id: 50, windowId: 1, title: 'GitHub Dashboard', url: 'https://github.com/dashboard', favIconUrl: '', _matchScore: 0.9 }
        ];

        const results = await provider.getSpotlightSuggestions('github');

        const ghResult = results.find(r => r.url === 'https://github.com/dashboard');
        expect(ghResult).toBeDefined();
        expect(ghResult.metadata.isArcify).toBe(true);
        expect(ghResult.metadata.spaceName).toBe('Dev');
        expect(ghResult.metadata.spaceColor).toBe('blue');
    });

    it('open tab NOT matching Arcify has no isArcify metadata', async () => {
        provider._openTabs = [
            { id: 51, windowId: 1, title: 'Stack Overflow', url: 'https://stackoverflow.com', favIconUrl: '', _matchScore: 0.85 }
        ];

        const results = await provider.getSpotlightSuggestions('stackoverflow');

        const soResult = results.find(r => r.url === 'https://stackoverflow.com');
        expect(soResult).toBeDefined();
        expect(soResult.metadata.isArcify).toBeUndefined();
    });

    it('enrichment happens after dedup: duplicate URL from tabs + history, only surviving result gets enriched', async () => {
        const arcifyUrl = 'https://github.com/dashboard';

        provider._openTabs = [
            { id: 52, windowId: 1, title: 'GitHub Dashboard', url: arcifyUrl, favIconUrl: '', _matchScore: 0.9 }
        ];
        provider._history = [
            { title: 'GitHub Dashboard', url: arcifyUrl, visitCount: 10, lastVisitTime: Date.now() - 3600000, _matchScore: 0.8 }
        ];

        const results = await provider.getSpotlightSuggestions('github');

        // Only one result should survive dedup
        const ghResults = results.filter(r => r.url === arcifyUrl);
        expect(ghResults).toHaveLength(1);

        // The surviving result (open-tab) should be enriched
        expect(ghResults[0].type).toBe(ResultType.OPEN_TAB);
        expect(ghResults[0].metadata.isArcify).toBe(true);
        expect(ghResults[0].metadata.spaceName).toBe('Dev');

        // getSpaceForUrl called only once (after dedup, not for both duplicates)
        const arcifyCalls = mockArcify.getSpaceForUrl.mock.calls.filter(
            call => call[0] === arcifyUrl
        );
        expect(arcifyCalls).toHaveLength(1);
    });
});

// ============================================================
// REG-02: Action routing contracts
// ============================================================
describe('REG-02: Action routing contracts', () => {
    let engine;

    beforeEach(() => {
        resetChromeMocks();
        engine = new SearchEngine({
            isBackgroundProvider: true,
            getSpotlightSuggestions: vi.fn()
        });
    });

    it('open tab result in NEW_TAB mode calls chrome.tabs.update + chrome.windows.update', async () => {
        const result = {
            type: ResultType.OPEN_TAB,
            url: 'https://example.com',
            metadata: { tabId: 100, windowId: 2 }
        };

        await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

        expect(chromeMock.tabs.update).toHaveBeenCalledWith(100, { active: true });
        expect(chromeMock.windows.update).toHaveBeenCalledWith(2, { focused: true });
    });

    it('URL suggestion in NEW_TAB mode calls chrome.tabs.create with URL', async () => {
        const result = {
            type: ResultType.URL_SUGGESTION,
            url: 'https://new-site.com'
        };

        await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

        expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://new-site.com' });
    });

    it('bookmark result in NEW_TAB mode calls chrome.tabs.create with URL', async () => {
        const result = {
            type: ResultType.BOOKMARK,
            url: 'https://bookmarked-site.com'
        };

        await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

        expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://bookmarked-site.com' });
    });
});
