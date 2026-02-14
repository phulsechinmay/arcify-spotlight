import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';

// Mock Logger to prevent side effects during import
vi.mock('../../logger.js', () => ({
    Logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        initialize: vi.fn()
    }
}));

// Mock BookmarkUtils for isolation
vi.mock('../../bookmark-utils.js', () => ({
    BookmarkUtils: {
        getAllBookmarks: vi.fn().mockResolvedValue([]),
        findArcifyFolder: vi.fn().mockResolvedValue(null),
        getBookmarksFromFolderRecursive: vi.fn().mockResolvedValue([]),
        isUnderArcifyFolder: vi.fn().mockReturnValue(false),
        findTabByUrl: vi.fn().mockReturnValue(null),
        invalidateBookmarkCache: vi.fn()
    }
}));

import { BackgroundDataProvider } from '../../shared/data-providers/background-data-provider.js';
import { BookmarkUtils } from '../../bookmark-utils.js';

describe('BackgroundDataProvider', () => {
    let provider;

    beforeEach(() => {
        provider = new BackgroundDataProvider();
        // Pre-set arcifyProvider to avoid dynamic import() in enrichWithArcifyInfo
        provider.arcifyProvider = {
            ensureCacheBuilt: vi.fn().mockResolvedValue(undefined),
            hasData: vi.fn().mockReturnValue(false),
            getSpaceForUrl: vi.fn().mockResolvedValue(null)
        };
        // Spy on autocompleteProvider to control its output
        vi.spyOn(provider.autocompleteProvider, 'getAutocompleteSuggestions')
            .mockResolvedValue([]);
    });

    // ==========================================
    // 1. getOpenTabsData
    // ==========================================
    describe('getOpenTabsData', () => {
        it('returns all valid tabs when no query', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'GitHub - Code', url: 'https://github.com', groupId: -1, windowId: 1 },
                { id: 2, title: 'Google Search', url: 'https://google.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);

            const result = await provider.getOpenTabsData();

            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('GitHub - Code');
            expect(result[1].title).toBe('Google Search');
        });

        it('filters out tabs without title or url', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Valid Tab', url: 'https://valid.com', groupId: -1, windowId: 1 },
                { id: 2, title: '', url: 'https://empty-title.com', groupId: -1, windowId: 1 },
                { id: 3, title: 'No URL', url: '', groupId: -1, windowId: 1 },
                { id: 4, title: null, url: 'https://null-title.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);

            const result = await provider.getOpenTabsData();

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Valid Tab');
        });

        it('enriches tabs with group info from tabGroups', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Tab in Group', url: 'https://example.com', groupId: 10, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([
                { id: 10, title: 'Work Group', color: 'blue' }
            ]);

            const result = await provider.getOpenTabsData();

            expect(result).toHaveLength(1);
            expect(result[0].groupName).toBe('Work Group');
            expect(result[0].groupColor).toBe('blue');
        });

        it('does not attach group info when groupId is -1', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Ungrouped Tab', url: 'https://example.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([
                { id: 10, title: 'Work Group', color: 'blue' }
            ]);

            const result = await provider.getOpenTabsData();

            expect(result).toHaveLength(1);
            expect(result[0].groupName).toBeUndefined();
            expect(result[0].groupColor).toBeUndefined();
        });

        it('uses FuseSearchService for fuzzy matching when query provided', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'GitHub - Code Repository', url: 'https://github.com', groupId: -1, windowId: 1 },
                { id: 2, title: 'Google Maps Navigation', url: 'https://maps.google.com', groupId: -1, windowId: 1 },
                { id: 3, title: 'Totally Unrelated Page', url: 'https://unrelated.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);

            const result = await provider.getOpenTabsData('github');

            // Fuse.js should match the GitHub tab
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0].title).toBe('GitHub - Code Repository');
        });

        it('attaches _matchScore to fuzzy-matched results', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'GitHub - Code Repository', url: 'https://github.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);

            const result = await provider.getOpenTabsData('github');

            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0]._matchScore).toBeDefined();
            expect(typeof result[0]._matchScore).toBe('number');
            expect(result[0]._matchScore).toBeGreaterThan(0);
        });

        it('returns empty array on Chrome API error', async () => {
            chromeMock.tabs.query.mockRejectedValue(new Error('Chrome API unavailable'));
            chromeMock.tabGroups.query.mockResolvedValue([]);

            const result = await provider.getOpenTabsData();

            expect(result).toEqual([]);
        });

        it('handles group with empty title gracefully', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Tab in Group', url: 'https://example.com', groupId: 10, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([
                { id: 10, title: '', color: 'red' }
            ]);

            const result = await provider.getOpenTabsData();

            expect(result[0].groupName).toBe('');
            expect(result[0].groupColor).toBe('red');
        });
    });

    // ==========================================
    // 2. getRecentTabsData
    // ==========================================
    describe('getRecentTabsData', () => {
        it('returns tabs sorted by lastActivity descending', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Old Tab', url: 'https://old.com', groupId: -1, windowId: 1 },
                { id: 2, title: 'Recent Tab', url: 'https://recent.com', groupId: -1, windowId: 1 },
                { id: 3, title: 'Middle Tab', url: 'https://middle.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);
            chromeMock.storage.local.get.mockResolvedValue({
                tabLastActivity: { 1: 1000, 2: 3000, 3: 2000 }
            });

            const result = await provider.getRecentTabsData(5);

            expect(result).toHaveLength(3);
            expect(result[0].title).toBe('Recent Tab');
            expect(result[0].lastActivity).toBe(3000);
            expect(result[1].title).toBe('Middle Tab');
            expect(result[1].lastActivity).toBe(2000);
            expect(result[2].title).toBe('Old Tab');
            expect(result[2].lastActivity).toBe(1000);
        });

        it('uses activity data from chrome.storage.local', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Tab A', url: 'https://a.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);
            chromeMock.storage.local.get.mockResolvedValue({
                tabLastActivity: { 1: 99999 }
            });

            const result = await provider.getRecentTabsData(5);

            expect(result[0].lastActivity).toBe(99999);
            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['tabLastActivity']);
        });

        it('defaults to 0 for tabs without activity data', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Active Tab', url: 'https://active.com', groupId: -1, windowId: 1 },
                { id: 2, title: 'Unknown Tab', url: 'https://unknown.com', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);
            chromeMock.storage.local.get.mockResolvedValue({
                tabLastActivity: { 1: 5000 }
            });

            const result = await provider.getRecentTabsData(5);

            expect(result[0].title).toBe('Active Tab');
            expect(result[1].lastActivity).toBe(0);
        });

        it('respects limit parameter (default 5)', async () => {
            const tabs = Array.from({ length: 10 }, (_, i) => ({
                id: i + 1, title: `Tab ${i + 1}`, url: `https://tab${i + 1}.com`, groupId: -1, windowId: 1
            }));
            chromeMock.tabs.query.mockResolvedValue(tabs);
            chromeMock.tabGroups.query.mockResolvedValue([]);
            const activityData = {};
            tabs.forEach(t => { activityData[t.id] = t.id * 100; });
            chromeMock.storage.local.get.mockResolvedValue({ tabLastActivity: activityData });

            const result = await provider.getRecentTabsData();

            expect(result).toHaveLength(5);
        });

        it('respects custom limit parameter', async () => {
            const tabs = Array.from({ length: 10 }, (_, i) => ({
                id: i + 1, title: `Tab ${i + 1}`, url: `https://tab${i + 1}.com`, groupId: -1, windowId: 1
            }));
            chromeMock.tabs.query.mockResolvedValue(tabs);
            chromeMock.tabGroups.query.mockResolvedValue([]);
            const activityData = {};
            tabs.forEach(t => { activityData[t.id] = t.id * 100; });
            chromeMock.storage.local.get.mockResolvedValue({ tabLastActivity: activityData });

            const result = await provider.getRecentTabsData(3);

            expect(result).toHaveLength(3);
        });

        it('enriches with group info from tabGroups', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Grouped Tab', url: 'https://grouped.com', groupId: 5, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([
                { id: 5, title: 'Dev Group', color: 'green' }
            ]);
            chromeMock.storage.local.get.mockResolvedValue({ tabLastActivity: { 1: 1000 } });

            const result = await provider.getRecentTabsData(5);

            expect(result[0].groupName).toBe('Dev Group');
            expect(result[0].groupColor).toBe('green');
        });

        it('returns empty array on error', async () => {
            chromeMock.tabs.query.mockRejectedValue(new Error('Chrome API error'));

            const result = await provider.getRecentTabsData();

            expect(result).toEqual([]);
        });

        it('filters out tabs without title or url', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'Valid Tab', url: 'https://valid.com', groupId: -1, windowId: 1 },
                { id: 2, title: '', url: 'https://no-title.com', groupId: -1, windowId: 1 },
                { id: 3, title: 'No URL', url: '', groupId: -1, windowId: 1 }
            ]);
            chromeMock.tabGroups.query.mockResolvedValue([]);
            chromeMock.storage.local.get.mockResolvedValue({ tabLastActivity: {} });

            const result = await provider.getRecentTabsData(5);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Valid Tab');
        });
    });

    // ==========================================
    // 3. getBookmarksData
    // ==========================================
    describe('getBookmarksData', () => {
        it('calls BookmarkUtils.getAllBookmarks and filters with FuseSearchService', async () => {
            BookmarkUtils.getAllBookmarks.mockResolvedValue([
                { id: '1', title: 'GitHub Repository', url: 'https://github.com', parentId: '0' },
                { id: '2', title: 'Totally Unrelated Site', url: 'https://unrelated.com', parentId: '0' }
            ]);

            const result = await provider.getBookmarksData('github');

            expect(BookmarkUtils.getAllBookmarks).toHaveBeenCalled();
            // Fuse.js should match 'github' in the title
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0].title).toBe('GitHub Repository');
        });

        it('excludes bookmarks under Arcify folder', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue({ id: '100', title: 'Arcify' });
            BookmarkUtils.isUnderArcifyFolder.mockImplementation((b, arcifyId) => {
                return b.parentId === arcifyId;
            });
            BookmarkUtils.getAllBookmarks.mockResolvedValue([
                { id: '1', title: 'GitHub Repository', url: 'https://github.com', parentId: '0' },
                { id: '2', title: 'GitHub Arcify Tab', url: 'https://github.com/arcify', parentId: '100' }
            ]);

            const result = await provider.getBookmarksData('github');

            // The Arcify bookmark should be excluded
            const urls = result.map(r => r.url);
            expect(urls).not.toContain('https://github.com/arcify');
        });

        it('includes all bookmarks when no Arcify folder exists', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue(null);
            BookmarkUtils.getAllBookmarks.mockResolvedValue([
                { id: '1', title: 'GitHub Repository', url: 'https://github.com', parentId: '0' },
                { id: '2', title: 'GitHub Pages', url: 'https://pages.github.com', parentId: '0' }
            ]);

            const result = await provider.getBookmarksData('github');

            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('attaches _matchScore from Fuse results', async () => {
            BookmarkUtils.getAllBookmarks.mockResolvedValue([
                { id: '1', title: 'GitHub Repository', url: 'https://github.com', parentId: '0' }
            ]);

            const result = await provider.getBookmarksData('github');

            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0]._matchScore).toBeDefined();
            expect(typeof result[0]._matchScore).toBe('number');
        });

        it('returns empty array on error', async () => {
            BookmarkUtils.getAllBookmarks.mockRejectedValue(new Error('Chrome API error'));

            const result = await provider.getBookmarksData('test');

            expect(result).toEqual([]);
        });

        it('handles findArcifyFolder throwing without crashing (inner try/catch)', async () => {
            BookmarkUtils.findArcifyFolder.mockRejectedValue(new Error('findArcifyFolder failed'));
            BookmarkUtils.getAllBookmarks.mockResolvedValue([
                { id: '1', title: 'GitHub Repository', url: 'https://github.com', parentId: '0' }
            ]);

            const result = await provider.getBookmarksData('github');

            // Should still return results despite findArcifyFolder error
            expect(result.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ==========================================
    // 4. getHistoryData
    // ==========================================
    describe('getHistoryData', () => {
        it('calls chrome.history.search with correct params', async () => {
            chromeMock.history.search.mockResolvedValue([
                { title: 'GitHub History', url: 'https://github.com', visitCount: 10, lastVisitTime: Date.now() }
            ]);

            await provider.getHistoryData('github');

            expect(chromeMock.history.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'github',
                    maxResults: 20
                })
            );
            // Verify startTime is approximately 7 days ago
            const callArgs = chromeMock.history.search.mock.calls[0][0];
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            expect(callArgs.startTime).toBeGreaterThan(Date.now() - sevenDaysMs - 1000);
            expect(callArgs.startTime).toBeLessThanOrEqual(Date.now() - sevenDaysMs + 1000);
        });

        it('re-ranks results with FuseSearchService', async () => {
            chromeMock.history.search.mockResolvedValue([
                { title: 'Unrelated Page', url: 'https://unrelated.com', visitCount: 5, lastVisitTime: Date.now() },
                { title: 'GitHub History Page', url: 'https://github.com/history', visitCount: 10, lastVisitTime: Date.now() }
            ]);

            const result = await provider.getHistoryData('github');

            // Fuse.js should rank GitHub higher
            if (result.length > 0) {
                expect(result[0].title).toBe('GitHub History Page');
            }
        });

        it('limits to 10 results (sliced after Fuse scoring)', async () => {
            const historyItems = Array.from({ length: 20 }, (_, i) => ({
                title: `GitHub Page ${i + 1}`,
                url: `https://github.com/page${i + 1}`,
                visitCount: 5,
                lastVisitTime: Date.now()
            }));
            chromeMock.history.search.mockResolvedValue(historyItems);

            const result = await provider.getHistoryData('github');

            expect(result.length).toBeLessThanOrEqual(10);
        });

        it('attaches _matchScore', async () => {
            chromeMock.history.search.mockResolvedValue([
                { title: 'GitHub History', url: 'https://github.com', visitCount: 10, lastVisitTime: Date.now() }
            ]);

            const result = await provider.getHistoryData('github');

            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0]._matchScore).toBeDefined();
            expect(typeof result[0]._matchScore).toBe('number');
        });

        it('returns empty array when history returns empty', async () => {
            chromeMock.history.search.mockResolvedValue([]);

            const result = await provider.getHistoryData('nonexistent');

            expect(result).toEqual([]);
        });

        it('returns empty array when history returns null', async () => {
            chromeMock.history.search.mockResolvedValue(null);

            const result = await provider.getHistoryData('test');

            expect(result).toEqual([]);
        });

        it('returns empty array on error', async () => {
            chromeMock.history.search.mockRejectedValue(new Error('History API error'));

            const result = await provider.getHistoryData('test');

            expect(result).toEqual([]);
        });
    });

    // ==========================================
    // 5. getTopSitesData
    // ==========================================
    describe('getTopSitesData', () => {
        it('calls chrome.topSites.get and returns results', async () => {
            const topSites = [
                { title: 'Google', url: 'https://google.com' },
                { title: 'YouTube', url: 'https://youtube.com' }
            ];
            chromeMock.topSites.get.mockResolvedValue(topSites);

            const result = await provider.getTopSitesData();

            expect(chromeMock.topSites.get).toHaveBeenCalled();
            expect(result).toEqual(topSites);
        });

        it('returns empty array on error', async () => {
            chromeMock.topSites.get.mockRejectedValue(new Error('TopSites API error'));

            const result = await provider.getTopSitesData();

            expect(result).toEqual([]);
        });
    });

    // ==========================================
    // 6. getAutocompleteData
    // ==========================================
    describe('getAutocompleteData', () => {
        it('delegates to this.autocompleteProvider.getAutocompleteSuggestions', async () => {
            const mockSuggestions = [{ title: 'Suggestion 1', url: 'https://suggestion1.com' }];
            provider.autocompleteProvider.getAutocompleteSuggestions.mockResolvedValue(mockSuggestions);

            const result = await provider.getAutocompleteData('test');

            expect(provider.autocompleteProvider.getAutocompleteSuggestions).toHaveBeenCalledWith('test');
            expect(result).toEqual(mockSuggestions);
        });

        it('returns empty array when autocompleteProvider throws', async () => {
            provider.autocompleteProvider.getAutocompleteSuggestions.mockRejectedValue(
                new Error('Autocomplete failed')
            );

            const result = await provider.getAutocompleteData('test');

            expect(result).toEqual([]);
        });
    });

    // ==========================================
    // 7. getPinnedTabsData
    // ==========================================
    describe('getPinnedTabsData', () => {
        const mockSpaces = [
            { id: 's1', name: 'Work', color: 'blue' },
            { id: 's2', name: 'Personal', color: 'green' }
        ];

        const mockArcifyFolder = { id: '100', title: 'Arcify' };

        const mockSpaceFolders = [
            { id: '200', title: 'Work' },
            { id: '300', title: 'Personal' }
        ];

        function setupPinnedTabMocks() {
            chromeMock.storage.local.get.mockResolvedValue({ spaces: mockSpaces });
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, title: 'GitHub', url: 'https://github.com', groupId: -1, windowId: 1 }
            ]);
            BookmarkUtils.findArcifyFolder.mockResolvedValue(mockArcifyFolder);
            chromeMock.bookmarks.getChildren.mockResolvedValue(mockSpaceFolders);
            BookmarkUtils.getBookmarksFromFolderRecursive.mockImplementation(async (folderId) => {
                if (folderId === '200') {
                    return [
                        { id: 'b1', title: 'GitHub Work', url: 'https://github.com' },
                        { id: 'b2', title: 'Jira Work', url: 'https://jira.com' }
                    ];
                }
                if (folderId === '300') {
                    return [
                        { id: 'b3', title: 'Gmail Personal', url: 'https://mail.google.com' }
                    ];
                }
                return [];
            });
        }

        it('collects candidates from all space folders', async () => {
            setupPinnedTabMocks();
            BookmarkUtils.findTabByUrl.mockReturnValue(null);

            const result = await provider.getPinnedTabsData();

            expect(result).toHaveLength(3);
        });

        it('attaches spaceId, spaceName, spaceColor from matching spaces', async () => {
            setupPinnedTabMocks();
            BookmarkUtils.findTabByUrl.mockReturnValue(null);

            const result = await provider.getPinnedTabsData();

            const workTab = result.find(t => t.title === 'GitHub Work');
            expect(workTab.spaceId).toBe('s1');
            expect(workTab.spaceName).toBe('Work');
            expect(workTab.spaceColor).toBe('blue');

            const personalTab = result.find(t => t.title === 'Gmail Personal');
            expect(personalTab.spaceId).toBe('s2');
            expect(personalTab.spaceName).toBe('Personal');
            expect(personalTab.spaceColor).toBe('green');
        });

        it('marks isActive true when BookmarkUtils.findTabByUrl finds matching tab', async () => {
            setupPinnedTabMocks();
            BookmarkUtils.findTabByUrl.mockImplementation((tabs, url) => {
                if (url === 'https://github.com') return { id: 1 };
                return null;
            });

            const result = await provider.getPinnedTabsData();

            const githubTab = result.find(t => t.title === 'GitHub Work');
            expect(githubTab.isActive).toBe(true);
            expect(githubTab.tabId).toBe(1);

            const jiraTab = result.find(t => t.title === 'Jira Work');
            expect(jiraTab.isActive).toBe(false);
            expect(jiraTab.tabId).toBeNull();
        });

        it('applies FuseSearchService filtering when query provided', async () => {
            setupPinnedTabMocks();
            BookmarkUtils.findTabByUrl.mockReturnValue(null);

            const result = await provider.getPinnedTabsData('github');

            // Fuse.js should match GitHub-related items
            expect(result.length).toBeGreaterThanOrEqual(1);
            const titles = result.map(t => t.title);
            expect(titles).toContain('GitHub Work');
        });

        it('returns all candidates when no query', async () => {
            setupPinnedTabMocks();
            BookmarkUtils.findTabByUrl.mockReturnValue(null);

            const result = await provider.getPinnedTabsData('');

            expect(result).toHaveLength(3);
        });

        it('returns empty array when no Arcify folder exists', async () => {
            chromeMock.storage.local.get.mockResolvedValue({ spaces: mockSpaces });
            chromeMock.tabs.query.mockResolvedValue([]);
            BookmarkUtils.findArcifyFolder.mockResolvedValue(null);

            const result = await provider.getPinnedTabsData();

            expect(result).toEqual([]);
        });

        it('returns empty array on error', async () => {
            chromeMock.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const result = await provider.getPinnedTabsData();

            expect(result).toEqual([]);
        });

        it('skips space folders that do not match any space in storage', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                spaces: [{ id: 's1', name: 'Work', color: 'blue' }]
            });
            chromeMock.tabs.query.mockResolvedValue([]);
            BookmarkUtils.findArcifyFolder.mockResolvedValue(mockArcifyFolder);
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '200', title: 'Work' },
                { id: '300', title: 'UnknownSpace' } // No matching space in storage
            ]);
            BookmarkUtils.getBookmarksFromFolderRecursive.mockImplementation(async (folderId) => {
                if (folderId === '200') {
                    return [{ id: 'b1', title: 'GitHub Work', url: 'https://github.com' }];
                }
                if (folderId === '300') {
                    return [{ id: 'b2', title: 'Unknown Tab', url: 'https://unknown.com' }];
                }
                return [];
            });
            BookmarkUtils.findTabByUrl.mockReturnValue(null);

            const result = await provider.getPinnedTabsData();

            // Only Work space's bookmarks should be included
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('GitHub Work');
        });
    });

    // ==========================================
    // Constructor
    // ==========================================
    describe('constructor', () => {
        it('sets isBackgroundProvider to true', () => {
            const p = new BackgroundDataProvider();
            expect(p.isBackgroundProvider).toBe(true);
        });

        it('creates an autocompleteProvider instance', () => {
            const p = new BackgroundDataProvider();
            expect(p.autocompleteProvider).toBeDefined();
            expect(typeof p.autocompleteProvider.getAutocompleteSuggestions).toBe('function');
        });
    });
});
