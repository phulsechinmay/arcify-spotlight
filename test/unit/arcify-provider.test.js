import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';

// Mock BookmarkUtils before importing ArcifyProvider
vi.mock('../../bookmark-utils.js', () => ({
    BookmarkUtils: {
        findArcifyFolder: vi.fn().mockResolvedValue(null)
    }
}));

// Import after mock setup
import { ArcifyProvider } from '../../shared/data-providers/arcify-provider.js';
import { BookmarkUtils } from '../../bookmark-utils.js';

describe('ArcifyProvider', () => {
    let provider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new ArcifyProvider();
    });

    describe('normalizeUrl', () => {
        it('normalizes URL using BaseDataProvider logic (lowercase, strip fragments, trailing slash, protocol, www)', () => {
            expect(provider.normalizeUrl('https://WWW.Example.COM/')).toBe('example.com');
            expect(provider.normalizeUrl('https://example.com#section')).toBe('example.com');
            expect(provider.normalizeUrl('HTTP://www.GitHub.com/')).toBe('github.com');
        });

        it('handles empty string input', () => {
            expect(provider.normalizeUrl('')).toBe('');
        });

        it('handles null input', () => {
            expect(provider.normalizeUrl(null)).toBe('');
        });
    });

    describe('getSpaceForUrl', () => {
        it('returns space info for cached URL', async () => {
            const spaceInfo = { spaceName: 'Work', spaceId: 's1', spaceColor: 'blue', bookmarkId: 'b1', bookmarkTitle: 'GitHub' };
            provider.cache = new Map([['github.com', spaceInfo]]);
            provider.arcifyFolderId = 'folder-1';

            const result = await provider.getSpaceForUrl('https://github.com');
            expect(result).toEqual(spaceInfo);
        });

        it('returns null for URL not in cache', async () => {
            provider.cache = new Map([['github.com', { spaceName: 'Work' }]]);
            provider.arcifyFolderId = 'folder-1';

            const result = await provider.getSpaceForUrl('https://example.com');
            expect(result).toBeNull();
        });

        it('triggers cache build on first call if cache is null', async () => {
            // Setup mocks for cache build
            BookmarkUtils.findArcifyFolder.mockResolvedValue(null);
            chromeMock.storage.local.get.mockResolvedValue({});

            const result = await provider.getSpaceForUrl('https://example.com');
            expect(result).toBeNull();
            // Cache should now exist (empty Map since no Arcify folder)
            expect(provider.cache).toBeInstanceOf(Map);
        });

        it('normalizes URL before lookup (https://WWW.Example.COM/ matches http://example.com)', async () => {
            const spaceInfo = { spaceName: 'Work', spaceId: 's1', spaceColor: 'blue' };
            provider.cache = new Map([['example.com', spaceInfo]]);
            provider.arcifyFolderId = 'folder-1';

            const result = await provider.getSpaceForUrl('https://WWW.Example.COM/');
            expect(result).toEqual(spaceInfo);
        });
    });

    describe('rebuildCache', () => {
        const mockSubtree = [{
            id: 'arcify-folder',
            children: [
                {
                    id: 'space-1', title: 'Work',
                    children: [
                        { id: 'b1', title: 'GitHub', url: 'https://github.com' },
                        { id: 'b2', title: 'Jira', url: 'https://jira.atlassian.com' },
                        {
                            id: 'subfolder-1', title: 'Docs', children: [
                                { id: 'b3', title: 'Wiki', url: 'https://wiki.example.com' }
                            ]
                        }
                    ]
                },
                {
                    id: 'space-2', title: 'Personal',
                    children: [
                        { id: 'b4', title: 'Gmail', url: 'https://mail.google.com' }
                    ]
                }
            ]
        }];

        const mockSpaces = [
            { name: 'Work', color: 'blue' },
            { name: 'Personal', color: 'green' }
        ];

        it('builds cache from bookmark subtree with correct space metadata', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue({ id: 'arcify-folder' });
            chromeMock.bookmarks.getSubTree.mockResolvedValue(mockSubtree);
            chromeMock.storage.local.get.mockResolvedValue({ spaces: mockSpaces });

            await provider.rebuildCache();

            expect(provider.cache.size).toBe(4);
            const githubInfo = provider.cache.get('github.com');
            expect(githubInfo.spaceName).toBe('Work');
            expect(githubInfo.spaceColor).toBe('blue');
            expect(githubInfo.bookmarkId).toBe('b1');
            expect(githubInfo.bookmarkTitle).toBe('GitHub');
        });

        it('handles nested subfolders within space folders', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue({ id: 'arcify-folder' });
            chromeMock.bookmarks.getSubTree.mockResolvedValue(mockSubtree);
            chromeMock.storage.local.get.mockResolvedValue({ spaces: mockSpaces });

            await provider.rebuildCache();

            const wikiInfo = provider.cache.get('wiki.example.com');
            expect(wikiInfo).toBeDefined();
            expect(wikiInfo.spaceName).toBe('Work');
            expect(wikiInfo.spaceColor).toBe('blue');
            expect(wikiInfo.bookmarkId).toBe('b3');
        });

        it('assigns grey fallback color when space not found in storage', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue({ id: 'arcify-folder' });
            chromeMock.bookmarks.getSubTree.mockResolvedValue(mockSubtree);
            // Return empty spaces array so no color match is found
            chromeMock.storage.local.get.mockResolvedValue({ spaces: [] });

            await provider.rebuildCache();

            const githubInfo = provider.cache.get('github.com');
            expect(githubInfo.spaceColor).toBe('grey');
        });

        it('handles missing Arcify folder gracefully (empty cache, arcifyFolderId null)', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue(null);

            await provider.rebuildCache();

            expect(provider.cache).toBeInstanceOf(Map);
            expect(provider.cache.size).toBe(0);
            expect(provider.arcifyFolderId).toBeNull();
        });

        it('persists cache to chrome.storage.local after build', async () => {
            BookmarkUtils.findArcifyFolder.mockResolvedValue({ id: 'arcify-folder' });
            chromeMock.bookmarks.getSubTree.mockResolvedValue(mockSubtree);
            chromeMock.storage.local.get.mockResolvedValue({ spaces: mockSpaces });

            await provider.rebuildCache();

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    arcifyUrlCache: expect.objectContaining({
                        folderId: 'arcify-folder',
                        urlMap: expect.any(Object),
                        timestamp: expect.any(Number)
                    })
                })
            );
        });
    });

    describe('processFolder', () => {
        it('processes bookmarks in a folder and adds to cache', () => {
            const folder = {
                children: [
                    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
                    { id: 'b2', title: 'Jira', url: 'https://jira.atlassian.com' }
                ]
            };
            const spaceInfo = { spaceName: 'Work', spaceId: 'space-1', spaceColor: 'blue' };
            const cache = new Map();

            provider.processFolder(folder, spaceInfo, cache);

            expect(cache.size).toBe(2);
            expect(cache.get('github.com')).toEqual(expect.objectContaining({
                spaceName: 'Work',
                bookmarkId: 'b1',
                bookmarkTitle: 'GitHub'
            }));
        });

        it('recurses into subfolders', () => {
            const folder = {
                children: [
                    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
                    {
                        id: 'subfolder', title: 'Docs', children: [
                            { id: 'b2', title: 'Wiki', url: 'https://wiki.example.com' }
                        ]
                    }
                ]
            };
            const spaceInfo = { spaceName: 'Work', spaceId: 'space-1', spaceColor: 'blue' };
            const cache = new Map();

            provider.processFolder(folder, spaceInfo, cache);

            expect(cache.size).toBe(2);
            expect(cache.get('wiki.example.com')).toBeDefined();
        });

        it('skips items without URLs and without children', () => {
            const folder = {
                children: [
                    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
                    { id: 'empty-item', title: 'Empty' } // no url, no children
                ]
            };
            const spaceInfo = { spaceName: 'Work', spaceId: 'space-1', spaceColor: 'blue' };
            const cache = new Map();

            provider.processFolder(folder, spaceInfo, cache);

            expect(cache.size).toBe(1);
        });
    });

    describe('invalidateCache', () => {
        it('sets cache to null and removes from storage', () => {
            provider.cache = new Map([['github.com', {}]]);

            provider.invalidateCache();

            expect(provider.cache).toBeNull();
            expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('arcifyUrlCache');
        });

        it('defers invalidation during import (isImporting=true sets pendingInvalidation)', () => {
            provider.cache = new Map([['github.com', {}]]);
            provider.isImporting = true;

            provider.invalidateCache();

            // Cache should NOT be cleared during import
            expect(provider.cache).toBeInstanceOf(Map);
            expect(provider.pendingInvalidation).toBe(true);
            expect(chromeMock.storage.local.remove).not.toHaveBeenCalled();
        });

        it('does not defer when not importing', () => {
            provider.cache = new Map([['github.com', {}]]);
            provider.isImporting = false;

            provider.invalidateCache();

            expect(provider.cache).toBeNull();
            expect(provider.pendingInvalidation).toBe(false);
        });
    });

    describe('hasData', () => {
        it('returns true when cache and folderId exist', () => {
            provider.cache = new Map([['github.com', {}]]);
            provider.arcifyFolderId = 'folder-1';

            expect(provider.hasData()).toBe(true);
        });

        it('returns false when cache is null', () => {
            provider.cache = null;
            provider.arcifyFolderId = 'folder-1';

            expect(provider.hasData()).toBe(false);
        });

        it('returns false when folderId is null', () => {
            provider.cache = new Map();
            provider.arcifyFolderId = null;

            expect(provider.hasData()).toBe(false);
        });
    });
});
