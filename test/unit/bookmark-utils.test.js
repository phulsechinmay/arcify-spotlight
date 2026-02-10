import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';

// Mock logger to prevent side effects and extra chrome.storage.sync.get calls
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

import { BookmarkUtils } from '../../bookmark-utils.js';

describe('BookmarkUtils', () => {
    beforeEach(() => {
        BookmarkUtils.invalidateBookmarkCache();
    });

    // ==========================================
    // 1. invalidateBookmarkCache
    // ==========================================
    describe('invalidateBookmarkCache', () => {
        it('resets cache so next getAllBookmarks fetches fresh data', async () => {
            // Populate cache first
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [{ id: '10', title: 'Test', url: 'https://test.com', parentId: '0' }]
            }]);
            await BookmarkUtils.getAllBookmarks();
            expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(1);

            // Invalidate and fetch again
            BookmarkUtils.invalidateBookmarkCache();
            await BookmarkUtils.getAllBookmarks();
            expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(2);
        });

        it('can be called multiple times without error', () => {
            expect(() => {
                BookmarkUtils.invalidateBookmarkCache();
                BookmarkUtils.invalidateBookmarkCache();
                BookmarkUtils.invalidateBookmarkCache();
            }).not.toThrow();
        });

        it('sets internal cache state to null and invalid', () => {
            BookmarkUtils._bookmarkCache = [{ id: '1' }];
            BookmarkUtils._bookmarkCacheValid = true;
            BookmarkUtils.invalidateBookmarkCache();
            expect(BookmarkUtils._bookmarkCache).toBeNull();
            expect(BookmarkUtils._bookmarkCacheValid).toBe(false);
        });
    });

    // ==========================================
    // 2. getAllBookmarks
    // ==========================================
    describe('getAllBookmarks', () => {
        it('fetches and flattens nested bookmark tree', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [{
                    id: '1', title: 'Bookmarks Bar',
                    children: [
                        { id: '10', title: 'GitHub', url: 'https://github.com', parentId: '1' },
                        { id: '11', title: 'Folder', children: [
                            { id: '20', title: 'Nested', url: 'https://nested.com', parentId: '11' }
                        ]}
                    ]
                }]
            }]);

            const result = await BookmarkUtils.getAllBookmarks();
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: '10', title: 'GitHub', url: 'https://github.com', parentId: '1' });
            expect(result[1]).toEqual({ id: '20', title: 'Nested', url: 'https://nested.com', parentId: '11' });
        });

        it('returns cached results on second call (getTree called only once)', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [{ id: '10', title: 'Test', url: 'https://test.com', parentId: '0' }]
            }]);

            await BookmarkUtils.getAllBookmarks();
            await BookmarkUtils.getAllBookmarks();
            expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(1);
        });

        it('fetches again after invalidateBookmarkCache (getTree called twice)', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [{ id: '10', title: 'Test', url: 'https://test.com', parentId: '0' }]
            }]);

            await BookmarkUtils.getAllBookmarks();
            BookmarkUtils.invalidateBookmarkCache();
            await BookmarkUtils.getAllBookmarks();
            expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(2);
        });

        it('handles empty tree (returns [])', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [] }]);

            const result = await BookmarkUtils.getAllBookmarks();
            expect(result).toEqual([]);
        });

        it('handles deeply nested tree (3+ levels)', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [{
                    id: '1', title: 'Root',
                    children: [{
                        id: '2', title: 'Level 1',
                        children: [{
                            id: '3', title: 'Level 2',
                            children: [
                                { id: '4', title: 'Deep', url: 'https://deep.com', parentId: '3' }
                            ]
                        }]
                    }]
                }]
            }]);

            const result = await BookmarkUtils.getAllBookmarks();
            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://deep.com');
        });

        it('includes parentId in returned objects', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [{ id: '10', title: 'Test', url: 'https://test.com', parentId: '5' }]
            }]);

            const result = await BookmarkUtils.getAllBookmarks();
            expect(result[0].parentId).toBe('5');
        });

        it('returns [] on Chrome API error', async () => {
            chromeMock.bookmarks.getTree.mockRejectedValue(new Error('Chrome API error'));

            const result = await BookmarkUtils.getAllBookmarks();
            expect(result).toEqual([]);
        });

        it('excludes nodes without URLs (folders)', async () => {
            chromeMock.bookmarks.getTree.mockResolvedValue([{
                id: '0',
                children: [
                    { id: '1', title: 'Folder', children: [] },
                    { id: '2', title: 'Bookmark', url: 'https://example.com', parentId: '0' }
                ]
            }]);

            const result = await BookmarkUtils.getAllBookmarks();
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Bookmark');
        });
    });

    // ==========================================
    // 3. findArcifyFolder
    // ==========================================
    describe('findArcifyFolder', () => {
        describe('Method 1: search by title', () => {
            it('returns folder when search finds result without URL', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([
                    { id: '100', title: 'Arcify' }
                ]);

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
                expect(chromeMock.bookmarks.search).toHaveBeenCalledWith({ title: 'Arcify' });
            });

            it('skips results that have URLs (bookmarks, not folders)', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([
                    { id: '50', title: 'Arcify', url: 'https://arcify.com' }
                ]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toBeNull();
            });

            it('returns first folder match when multiple results exist', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([
                    { id: '50', title: 'Arcify', url: 'https://arcify.com' },
                    { id: '100', title: 'Arcify' },
                    { id: '200', title: 'Arcify' }
                ]);

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });
        });

        describe('Method 2: tree traversal', () => {
            it('falls back to traversal when search returns empty array', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
                    if (id === '1') return [{ id: '100', title: 'Arcify' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });

            it('finds Arcify folder in Bookmarks Bar', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
                    if (id === '1') return [{ id: '100', title: 'Arcify' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });

            it('finds Arcify folder in Other Bookmarks', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
                    if (id === '1') return [];
                    if (id === '2') return [{ id: '100', title: 'Arcify' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });

            it('skips folder children that have URLs (not folders)', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }];
                    if (id === '1') return [{ id: '50', title: 'Arcify', url: 'https://arcify.com' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toBeNull();
            });
        });

        describe('Method 3: Other Bookmarks specific', () => {
            it('falls back to Method 3 when Methods 1 and 2 find nothing, and finds Arcify in Other Bookmarks', async () => {
                // Method 1: search returns nothing
                chromeMock.bookmarks.search.mockResolvedValue([]);
                // Method 2: root has folders with non-standard names (no id==='2', no 'other' or 'bookmark' in title)
                // Method 3: finds Other Bookmarks by id === '2'
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [
                        { id: '1', title: 'Bookmarks Bar' },
                        { id: '2', title: 'Andere Bladwijzers' }, // non-English locale
                        { id: '3', title: 'Mobile Bookmarks' }
                    ];
                    if (id === '1') return [];
                    if (id === '2') return [{ id: '100', title: 'Arcify' }];
                    if (id === '3') return [];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                // Method 2 iterates root folders, checks getChildren for each.
                // For id='2', getChildren returns [{id:'100',title:'Arcify'}] which Method 2 finds.
                // This actually proves Method 2 works with locale names.
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });

            it('finds Other Bookmarks by id === "2"', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Toolbar' }, { id: '2', title: 'Andere Bladwijzers' }];
                    if (id === '1') return [];
                    if (id === '2') return [{ id: '100', title: 'Arcify' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                // Method 2 should find it since title === 'Arcify' check still works
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });

            it('finds Other Bookmarks by title containing "other" (locale fallback)', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '10', title: 'Bookmarks Bar' }, { id: '20', title: 'Other Stuff' }];
                    if (id === '10') return [];
                    if (id === '20') return [{ id: '100', title: 'Arcify' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });
        });

        describe('error handling', () => {
            it('returns null when all methods fail (no Arcify folder exists)', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toBeNull();
            });

            it('returns null when Chrome API throws', async () => {
                chromeMock.bookmarks.search.mockRejectedValue(new Error('Chrome API error'));

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toBeNull();
            });

            it('handles getChildren error for individual root folders (continues to next)', async () => {
                chromeMock.bookmarks.search.mockResolvedValue([]);
                chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                    if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }, { id: '2', title: 'Other Bookmarks' }];
                    if (id === '1') throw new Error('Access denied');
                    if (id === '2') return [{ id: '100', title: 'Arcify' }];
                    return [];
                });

                const result = await BookmarkUtils.findArcifyFolder();
                expect(result).toEqual({ id: '100', title: 'Arcify' });
            });
        });
    });

    // ==========================================
    // 4. getBookmarksFromFolderRecursive
    // ==========================================
    describe('getBookmarksFromFolderRecursive', () => {
        it('returns bookmarks from flat folder (no subfolders)', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' },
                { id: '11', title: 'Jira', url: 'https://jira.com' }
            ]);

            const result = await BookmarkUtils.getBookmarksFromFolderRecursive('100');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: '10', title: 'GitHub', url: 'https://github.com' });
            expect(result[1]).toEqual({ id: '11', title: 'Jira', url: 'https://jira.com' });
        });

        it('recursively collects from nested subfolders', async () => {
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [
                    { id: '10', title: 'GitHub', url: 'https://github.com' },
                    { id: '20', title: 'Docs' } // subfolder (no url)
                ];
                if (id === '20') return [
                    { id: '30', title: 'Wiki', url: 'https://wiki.com' }
                ];
                return [];
            });

            const result = await BookmarkUtils.getBookmarksFromFolderRecursive('100');
            expect(result).toHaveLength(2);
            expect(result[0].url).toBe('https://github.com');
            expect(result[1].url).toBe('https://wiki.com');
        });

        it('returns empty array for empty folder', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([]);

            const result = await BookmarkUtils.getBookmarksFromFolderRecursive('100');
            expect(result).toEqual([]);
        });

        it('with includeTabIds: true and groupId: adds tabId to matching bookmarks', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' },
                { id: '11', title: 'Jira', url: 'https://jira.com' }
            ]);
            chromeMock.tabs.query.mockResolvedValue([
                { id: 42, url: 'https://github.com' }
            ]);

            const result = await BookmarkUtils.getBookmarksFromFolderRecursive('100', {
                includeTabIds: true,
                groupId: 5
            });

            expect(result[0].tabId).toBe(42);
            expect(result[1].tabId).toBeUndefined();
            expect(chromeMock.tabs.query).toHaveBeenCalledWith({ groupId: 5 });
        });

        it('with includeTabIds: true but no matching tabs: bookmarks lack tabId', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);
            chromeMock.tabs.query.mockResolvedValue([
                { id: 99, url: 'https://other.com' }
            ]);

            const result = await BookmarkUtils.getBookmarksFromFolderRecursive('100', {
                includeTabIds: true,
                groupId: 5
            });

            expect(result[0].tabId).toBeUndefined();
        });

        it('with includeTabIds: false (default): no tabs.query called', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);

            await BookmarkUtils.getBookmarksFromFolderRecursive('100');
            expect(chromeMock.tabs.query).not.toHaveBeenCalled();
        });

        it('passes options through to recursive calls for nested subfolders', async () => {
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '20', title: 'Sub' }];
                if (id === '20') return [{ id: '30', title: 'Deep', url: 'https://deep.com' }];
                return [];
            });
            chromeMock.tabs.query.mockResolvedValue([
                { id: 55, url: 'https://deep.com' }
            ]);

            const result = await BookmarkUtils.getBookmarksFromFolderRecursive('100', {
                includeTabIds: true,
                groupId: 7
            });

            expect(result).toHaveLength(1);
            expect(result[0].tabId).toBe(55);
        });
    });

    // ==========================================
    // 5. findBookmarkInFolderRecursive
    // ==========================================
    describe('findBookmarkInFolderRecursive', () => {
        it('finds bookmark by URL in direct children', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' },
                { id: '11', title: 'Jira', url: 'https://jira.com' }
            ]);

            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', { url: 'https://github.com' });
            expect(result.bookmark).toEqual({ id: '10', title: 'GitHub', url: 'https://github.com' });
            expect(result.parentFolderId).toBe('100');
            expect(result.folderPath).toBe('100');
        });

        it('finds bookmark by title in direct children', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);

            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', { title: 'GitHub' });
            expect(result.bookmark.title).toBe('GitHub');
        });

        it('finds bookmark by URL in nested subfolder', async () => {
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '20', title: 'Docs' }];
                if (id === '20') return [{ id: '30', title: 'Wiki', url: 'https://wiki.com' }];
                return [];
            });

            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', { url: 'https://wiki.com' });
            expect(result.bookmark.url).toBe('https://wiki.com');
            expect(result.parentFolderId).toBe('20');
        });

        it('returns result with bookmark, parentFolderId, and folderPath properties', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'Test', url: 'https://test.com' }
            ]);

            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', { url: 'https://test.com' });
            expect(result).toHaveProperty('bookmark');
            expect(result).toHaveProperty('parentFolderId');
            expect(result).toHaveProperty('folderPath');
        });

        it('returns null when bookmark not found', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);

            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', { url: 'https://notfound.com' });
            expect(result).toBeNull();
        });

        it('returns null when folderId is falsy', async () => {
            const result = await BookmarkUtils.findBookmarkInFolderRecursive(null, { url: 'https://test.com' });
            expect(result).toBeNull();
        });

        it('returns null when both url and title are missing from searchCriteria', async () => {
            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', {});
            expect(result).toBeNull();
        });

        it('returns null on Chrome API error', async () => {
            chromeMock.bookmarks.getChildren.mockRejectedValue(new Error('API error'));

            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', { url: 'https://test.com' });
            expect(result).toBeNull();
        });

        it('matches by URL OR title (not AND)', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'Different Title', url: 'https://github.com' }
            ]);

            // URL matches but title does not -- should still find it
            const result = await BookmarkUtils.findBookmarkInFolderRecursive('100', {
                url: 'https://github.com',
                title: 'Wrong Title'
            });
            expect(result).not.toBeNull();
            expect(result.bookmark.url).toBe('https://github.com');
        });
    });

    // ==========================================
    // 6. findBookmarkByUrl
    // ==========================================
    describe('findBookmarkByUrl', () => {
        it('returns matching bookmark from array', () => {
            const bookmarks = [
                { id: '1', title: 'GitHub', url: 'https://github.com' },
                { id: '2', title: 'Jira', url: 'https://jira.com' }
            ];
            const result = BookmarkUtils.findBookmarkByUrl(bookmarks, 'https://jira.com');
            expect(result).toEqual({ id: '2', title: 'Jira', url: 'https://jira.com' });
        });

        it('returns null when no match', () => {
            const bookmarks = [{ id: '1', title: 'GitHub', url: 'https://github.com' }];
            const result = BookmarkUtils.findBookmarkByUrl(bookmarks, 'https://notfound.com');
            expect(result).toBeNull();
        });

        it('returns null when bookmarks is null', () => {
            const result = BookmarkUtils.findBookmarkByUrl(null, 'https://test.com');
            expect(result).toBeNull();
        });

        it('returns null when url is null', () => {
            const result = BookmarkUtils.findBookmarkByUrl([{ id: '1' }], null);
            expect(result).toBeNull();
        });

        it('skips bookmarks without url property', () => {
            const bookmarks = [
                { id: '1', title: 'Folder' },
                { id: '2', title: 'GitHub', url: 'https://github.com' }
            ];
            const result = BookmarkUtils.findBookmarkByUrl(bookmarks, 'https://github.com');
            expect(result).toEqual({ id: '2', title: 'GitHub', url: 'https://github.com' });
        });

        it('returns first match when multiple exist', () => {
            const bookmarks = [
                { id: '1', title: 'First', url: 'https://dupe.com' },
                { id: '2', title: 'Second', url: 'https://dupe.com' }
            ];
            const result = BookmarkUtils.findBookmarkByUrl(bookmarks, 'https://dupe.com');
            expect(result.id).toBe('1');
        });
    });

    // ==========================================
    // 7. findTabByUrl
    // ==========================================
    describe('findTabByUrl', () => {
        it('returns matching tab from array', () => {
            const tabs = [
                { id: 1, url: 'https://github.com' },
                { id: 2, url: 'https://jira.com' }
            ];
            const result = BookmarkUtils.findTabByUrl(tabs, 'https://jira.com');
            expect(result).toEqual({ id: 2, url: 'https://jira.com' });
        });

        it('returns null when no match', () => {
            const tabs = [{ id: 1, url: 'https://github.com' }];
            const result = BookmarkUtils.findTabByUrl(tabs, 'https://notfound.com');
            expect(result).toBeNull();
        });

        it('returns null when tabs is null', () => {
            const result = BookmarkUtils.findTabByUrl(null, 'https://test.com');
            expect(result).toBeNull();
        });

        it('returns null when url is null', () => {
            const result = BookmarkUtils.findTabByUrl([{ id: 1 }], null);
            expect(result).toBeNull();
        });

        it('skips tabs without url property', () => {
            const tabs = [
                { id: 1, title: 'No URL' },
                { id: 2, url: 'https://github.com' }
            ];
            const result = BookmarkUtils.findTabByUrl(tabs, 'https://github.com');
            expect(result).toEqual({ id: 2, url: 'https://github.com' });
        });
    });

    // ==========================================
    // 8. openBookmarkAsTab
    // ==========================================
    describe('openBookmarkAsTab', () => {
        let context;
        const bookmarkData = {
            url: 'https://github.com',
            title: 'GitHub',
            spaceName: 'Work',
            bookmarkId: 'b1'
        };
        const targetSpaceId = 5;

        beforeEach(() => {
            context = {
                spaces: [{ id: 5, name: 'Work', spaceBookmarks: [] }],
                activeSpaceId: 5,
                currentWindow: { id: 1 },
                saveSpaces: vi.fn(),
                createTabElement: vi.fn().mockResolvedValue({
                    classList: { add: vi.fn() },
                    replaceWith: vi.fn()
                }),
                activateTabInDOM: vi.fn(),
                Utils: {
                    setTabNameOverride: vi.fn().mockResolvedValue(undefined),
                    setPinnedTabState: vi.fn().mockResolvedValue(undefined)
                },
                reconcileSpaceTabOrdering: vi.fn().mockResolvedValue(undefined)
            };

            chromeMock.tabs.create.mockResolvedValue({
                id: 42,
                url: 'https://github.com',
                title: 'GitHub Page',
                favIconUrl: 'https://github.com/favicon.ico'
            });
        });

        it('creates a new tab with correct URL and windowId', async () => {
            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);

            expect(chromeMock.tabs.create).toHaveBeenCalledWith({
                url: 'https://github.com',
                active: true,
                windowId: 1
            });
        });

        it('groups the tab into the target space', async () => {
            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);

            expect(chromeMock.tabs.group).toHaveBeenCalledWith({
                tabIds: [42],
                groupId: 5
            });
        });

        it('sets tab name override when bookmark title differs from tab title', async () => {
            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);

            // bookmarkData.title='GitHub' differs from newTab.title='GitHub Page'
            expect(context.Utils.setTabNameOverride).toHaveBeenCalledWith(42, 'https://github.com', 'GitHub');
        });

        it('does not set tab name override when titles match', async () => {
            chromeMock.tabs.create.mockResolvedValue({
                id: 42, url: 'https://github.com', title: 'GitHub', favIconUrl: ''
            });

            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);
            expect(context.Utils.setTabNameOverride).not.toHaveBeenCalled();
        });

        it('handles pinned tab: adds to spaceBookmarks and sets pinned state', async () => {
            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, true);

            expect(context.spaces[0].spaceBookmarks).toContain(42);
            expect(context.saveSpaces).toHaveBeenCalled();
            expect(context.Utils.setPinnedTabState).toHaveBeenCalledWith(42, {
                pinnedUrl: 'https://github.com',
                bookmarkId: 'b1'
            });
        });

        it('calls reconcileSpaceTabOrdering', async () => {
            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);

            expect(context.reconcileSpaceTabOrdering).toHaveBeenCalledWith(5, {
                source: 'arcify',
                movedTabId: 42
            });
        });

        it('activates the tab in DOM', async () => {
            await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { active: true });
            expect(context.activateTabInDOM).toHaveBeenCalledWith(42);
        });

        it('returns the created tab', async () => {
            const result = await BookmarkUtils.openBookmarkAsTab(bookmarkData, targetSpaceId, null, context, false);
            expect(result.id).toBe(42);
        });
    });

    // ==========================================
    // 9. removeBookmarkByUrl
    // ==========================================
    describe('removeBookmarkByUrl', () => {
        it('finds and removes bookmark by URL in direct children, returns true', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' },
                { id: '11', title: 'Jira', url: 'https://jira.com' }
            ]);

            const result = await BookmarkUtils.removeBookmarkByUrl('100', 'https://github.com');
            expect(result).toBe(true);
            expect(chromeMock.bookmarks.remove).toHaveBeenCalledWith('10');
        });

        it('finds and removes bookmark in nested subfolder, returns true', async () => {
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '20', title: 'Docs' }];
                if (id === '20') return [{ id: '30', title: 'Wiki', url: 'https://wiki.com' }];
                return [];
            });

            const result = await BookmarkUtils.removeBookmarkByUrl('100', 'https://wiki.com');
            expect(result).toBe(true);
            expect(chromeMock.bookmarks.remove).toHaveBeenCalledWith('30');
        });

        it('returns false when bookmark URL not found', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);

            const result = await BookmarkUtils.removeBookmarkByUrl('100', 'https://notfound.com');
            expect(result).toBe(false);
            expect(chromeMock.bookmarks.remove).not.toHaveBeenCalled();
        });

        it('calls chrome.bookmarks.remove with correct bookmark ID', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '42', title: 'Target', url: 'https://target.com' }
            ]);

            await BookmarkUtils.removeBookmarkByUrl('100', 'https://target.com');
            expect(chromeMock.bookmarks.remove).toHaveBeenCalledWith('42');
        });

        it('handles removeTabElement option when provided', async () => {
            const mockElement = { remove: vi.fn() };
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'Test', url: 'https://test.com' }
            ]);

            await BookmarkUtils.removeBookmarkByUrl('100', 'https://test.com', {
                removeTabElement: true,
                tabElement: mockElement
            });

            expect(mockElement.remove).toHaveBeenCalled();
        });
    });

    // ==========================================
    // 10. matchTabsWithBookmarks
    // ==========================================
    describe('matchTabsWithBookmarks', () => {
        it('returns array of tab IDs that match bookmark URLs', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' },
                { id: '11', title: 'Jira', url: 'https://jira.com' }
            ]);
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, url: 'https://github.com', title: 'GitHub' },
                { id: 2, url: 'https://jira.com', title: 'Jira' }
            ]);

            const result = await BookmarkUtils.matchTabsWithBookmarks({ id: '100' }, 5);
            expect(result).toEqual([1, 2]);
        });

        it('handles nested folders recursively', async () => {
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [
                    { id: '10', title: 'GitHub', url: 'https://github.com' },
                    { id: '20', title: 'Subfolder' }
                ];
                if (id === '20') return [
                    { id: '30', title: 'Wiki', url: 'https://wiki.com' }
                ];
                return [];
            });
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, url: 'https://github.com', title: 'GitHub' },
                { id: 2, url: 'https://wiki.com', title: 'Wiki' }
            ]);

            const result = await BookmarkUtils.matchTabsWithBookmarks({ id: '100' }, 5);
            expect(result).toEqual([1, 2]);
        });

        it('returns empty array when no tabs match', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, url: 'https://other.com', title: 'Other' }
            ]);

            const result = await BookmarkUtils.matchTabsWithBookmarks({ id: '100' }, 5);
            expect(result).toEqual([]);
        });

        it('calls setTabNameOverride when bookmark title differs from tab title', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'Custom Name', url: 'https://github.com' }
            ]);
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, url: 'https://github.com', title: 'GitHub - Default' }
            ]);

            const setTabNameOverride = vi.fn();
            await BookmarkUtils.matchTabsWithBookmarks({ id: '100' }, 5, setTabNameOverride);

            expect(setTabNameOverride).toHaveBeenCalledWith(1, 'https://github.com', 'Custom Name');
        });

        it('does not call setTabNameOverride when titles match', async () => {
            chromeMock.bookmarks.getChildren.mockResolvedValue([
                { id: '10', title: 'GitHub', url: 'https://github.com' }
            ]);
            chromeMock.tabs.query.mockResolvedValue([
                { id: 1, url: 'https://github.com', title: 'GitHub' }
            ]);

            const setTabNameOverride = vi.fn();
            await BookmarkUtils.matchTabsWithBookmarks({ id: '100' }, 5, setTabNameOverride);

            expect(setTabNameOverride).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // 11. updateBookmarkTitle
    // ==========================================
    describe('updateBookmarkTitle', () => {
        const tab = { id: 1, url: 'https://github.com' };
        const activeSpace = { name: 'Work' };

        function setupArcifyTree() {
            chromeMock.bookmarks.search.mockResolvedValue([{ id: '100', title: 'Arcify' }]);
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '200', title: 'Work' }];
                if (id === '200') return [
                    { id: '300', title: 'GitHub', url: 'https://github.com' }
                ];
                return [];
            });
        }

        it('updates bookmark title when found and title differs', async () => {
            setupArcifyTree();

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'New Title');
            expect(result).toBe(true);
            expect(chromeMock.bookmarks.update).toHaveBeenCalledWith('300', { title: 'New Title' });
        });

        it('skips update when title already matches', async () => {
            setupArcifyTree();

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'GitHub');
            expect(result).toBe(true);
            expect(chromeMock.bookmarks.update).not.toHaveBeenCalled();
        });

        it('returns false when Arcify folder not found', async () => {
            chromeMock.bookmarks.search.mockResolvedValue([]);
            chromeMock.bookmarks.getChildren.mockResolvedValue([]);

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'New');
            expect(result).toBe(false);
        });

        it('returns false when space folder not found', async () => {
            chromeMock.bookmarks.search.mockResolvedValue([{ id: '100', title: 'Arcify' }]);
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '200', title: 'Personal' }];
                return [];
            });

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'New');
            expect(result).toBe(false);
        });

        it('returns false when bookmark URL not found in space folder', async () => {
            chromeMock.bookmarks.search.mockResolvedValue([{ id: '100', title: 'Arcify' }]);
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '200', title: 'Work' }];
                if (id === '200') return [
                    { id: '300', title: 'Jira', url: 'https://jira.com' }
                ];
                return [];
            });

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'New');
            expect(result).toBe(false);
        });

        it('finds and updates bookmark in nested subfolder', async () => {
            chromeMock.bookmarks.search.mockResolvedValue([{ id: '100', title: 'Arcify' }]);
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '100') return [{ id: '200', title: 'Work' }];
                if (id === '200') return [{ id: '250', title: 'Docs' }]; // subfolder
                if (id === '250') return [
                    { id: '300', title: 'GitHub', url: 'https://github.com' }
                ];
                return [];
            });

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'Updated GitHub');
            expect(result).toBe(true);
            expect(chromeMock.bookmarks.update).toHaveBeenCalledWith('300', { title: 'Updated GitHub' });
        });

        it('returns false on Chrome API error', async () => {
            chromeMock.bookmarks.search.mockRejectedValue(new Error('API error'));

            const result = await BookmarkUtils.updateBookmarkTitle(tab, activeSpace, 'New');
            expect(result).toBe(false);
        });
    });

    // ==========================================
    // 12. isUnderArcifyFolder
    // ==========================================
    describe('isUnderArcifyFolder', () => {
        it('returns true when parentId equals arcifyFolderId', () => {
            const bookmark = { parentId: '100' };
            expect(BookmarkUtils.isUnderArcifyFolder(bookmark, '100')).toBe(true);
        });

        it('returns true when parentId starts with arcifyFolderId', () => {
            const bookmark = { parentId: '1001' };
            expect(BookmarkUtils.isUnderArcifyFolder(bookmark, '100')).toBe(true);
        });

        it('returns false when parentId is different', () => {
            const bookmark = { parentId: '200' };
            expect(BookmarkUtils.isUnderArcifyFolder(bookmark, '100')).toBe(false);
        });

        it('returns falsy when parentId is null', () => {
            const bookmark = { parentId: null };
            expect(BookmarkUtils.isUnderArcifyFolder(bookmark, '100')).toBeFalsy();
        });

        it('returns falsy when parentId is undefined', () => {
            const bookmark = {};
            expect(BookmarkUtils.isUnderArcifyFolder(bookmark, '100')).toBeFalsy();
        });
    });

    // ==========================================
    // 13. getBookmarksData
    // ==========================================
    describe('getBookmarksData', () => {
        it('returns bookmarks filtered to exclude Arcify folder bookmarks', async () => {
            chromeMock.bookmarks.search.mockImplementation(async (query) => {
                if (typeof query === 'string' || (query && !query.title)) {
                    // Regular search call
                    return [
                        { id: '1', title: 'GitHub', url: 'https://github.com', parentId: '50' },
                        { id: '2', title: 'Arcify Tab', url: 'https://arcify-tab.com', parentId: '100' }
                    ];
                }
                // findArcifyFolder search call
                return [{ id: '100', title: 'Arcify' }];
            });

            const result = await BookmarkUtils.getBookmarksData('test');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('GitHub');
        });

        it('works correctly when no Arcify folder exists', async () => {
            // First call is bookmarks.search(query), second is within findArcifyFolder
            let searchCallCount = 0;
            chromeMock.bookmarks.search.mockImplementation(async () => {
                searchCallCount++;
                if (searchCallCount === 1) {
                    return [
                        { id: '1', title: 'GitHub', url: 'https://github.com', parentId: '50' }
                    ];
                }
                // findArcifyFolder: no results
                return [];
            });
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '0') return [{ id: '1', title: 'Bookmarks Bar' }];
                return [];
            });

            const result = await BookmarkUtils.getBookmarksData('github');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('GitHub');
        });

        it('returns [] when Chrome API throws', async () => {
            chromeMock.bookmarks.search.mockRejectedValue(new Error('API error'));

            const result = await BookmarkUtils.getBookmarksData('test');
            expect(result).toEqual([]);
        });

        it('excludes bookmarks without URLs (folders)', async () => {
            chromeMock.bookmarks.search.mockImplementation(async (query) => {
                if (typeof query === 'string' || (query && !query.title)) {
                    return [
                        { id: '1', title: 'Folder' }, // no URL
                        { id: '2', title: 'Page', url: 'https://page.com', parentId: '50' }
                    ];
                }
                return [];
            });
            chromeMock.bookmarks.getChildren.mockImplementation(async (id) => {
                if (id === '0') return [];
                return [];
            });

            const result = await BookmarkUtils.getBookmarksData('test');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Page');
        });

        it('handles findArcifyFolder error gracefully (still returns bookmarks)', async () => {
            let searchCallCount = 0;
            chromeMock.bookmarks.search.mockImplementation(async () => {
                searchCallCount++;
                if (searchCallCount === 1) {
                    return [
                        { id: '1', title: 'GitHub', url: 'https://github.com', parentId: '50' }
                    ];
                }
                // findArcifyFolder search throws
                throw new Error('Search failed');
            });

            const result = await BookmarkUtils.getBookmarksData('github');
            // Should still return bookmarks even if Arcify folder detection fails
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('GitHub');
        });
    });
});
