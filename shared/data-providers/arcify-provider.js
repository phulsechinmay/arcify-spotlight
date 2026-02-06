/**
 * Arcify Provider - URL-to-space mapping cache for Arcify bookmark detection
 *
 * Purpose: Provides O(1) lookup to determine which Arcify space a URL belongs to
 * Key Functions: getSpaceForUrl() - constant time lookup, invalidateCache() - event-triggered refresh
 * Architecture: Singleton provider with Map-based cache, persisted to chrome.storage.local
 *
 * Critical Notes:
 * - Uses chrome.storage.local (NOT session) for service worker restart recovery
 * - Uses getSubTree() for O(1) API calls during cache build
 * - Reuses BaseDataProvider.normalizeUrlForDeduplication() for consistent URL matching
 * - Import batching prevents thrashing during bulk bookmark operations
 */

import { BookmarkUtils } from '../../bookmark-utils.js';
import { BaseDataProvider } from './base-data-provider.js';
import { Logger } from '../../logger.js';

const CACHE_STORAGE_KEY = 'arcifyUrlCache';

export class ArcifyProvider {
    constructor() {
        // Cache is a Map<normalizedUrl, SpaceInfo>
        this.cache = null;
        this.arcifyFolderId = null;
        this.isBuilding = false;
        this.buildPromise = null;

        // Import batching flags - exposed for event handlers
        this.isImporting = false;
        this.pendingInvalidation = false;
    }

    /**
     * Normalize URL using existing deduplication logic
     * Reuses BaseDataProvider's normalizeUrlForDeduplication for consistency
     * Handles: lowercase, fragment removal, trailing slash, protocol, www prefix
     * @param {string} url - URL to normalize
     * @returns {string} Normalized URL for cache key
     */
    normalizeUrl(url) {
        return BaseDataProvider.prototype.normalizeUrlForDeduplication.call({}, url);
    }

    /**
     * Main lookup method - O(1) via Map.get()
     * Returns space metadata for a URL, or null if not in Arcify
     * @param {string} url - URL to look up
     * @returns {Promise<Object|null>} SpaceInfo object or null
     */
    async getSpaceForUrl(url) {
        if (!this.cache) {
            await this.ensureCacheBuilt();
        }
        const normalizedUrl = this.normalizeUrl(url);
        return this.cache?.get(normalizedUrl) || null;
    }

    /**
     * Lazy cache initialization - ensures cache is built before lookup
     * Handles concurrent build requests via buildPromise
     */
    async ensureCacheBuilt() {
        if (this.cache) return;
        if (this.buildPromise) {
            await this.buildPromise;
            return;
        }
        this.buildPromise = this.buildCache();
        await this.buildPromise;
        this.buildPromise = null;
    }

    /**
     * Build cache - tries to restore from storage first, then rebuilds if needed
     */
    async buildCache() {
        if (this.isBuilding) return;
        this.isBuilding = true;

        try {
            // Try to restore from chrome.storage.local first
            const stored = await chrome.storage.local.get(CACHE_STORAGE_KEY);
            if (stored[CACHE_STORAGE_KEY]) {
                this.cache = new Map(Object.entries(stored[CACHE_STORAGE_KEY].urlMap));
                this.arcifyFolderId = stored[CACHE_STORAGE_KEY].folderId;
                Logger.log(`[ArcifyProvider] Cache restored from storage with ${this.cache.size} URLs`);
                return;
            }

            // Build fresh cache from bookmarks
            await this.rebuildCache();
        } finally {
            this.isBuilding = false;
        }
    }

    /**
     * Rebuild cache from Chrome bookmarks API
     * Uses getSubTree() for single API call efficiency
     */
    async rebuildCache() {
        const arcifyFolder = await BookmarkUtils.findArcifyFolder();
        if (!arcifyFolder) {
            this.cache = new Map();
            this.arcifyFolderId = null;
            Logger.log('[ArcifyProvider] Arcify folder not found, cache empty');
            return;
        }

        this.arcifyFolderId = arcifyFolder.id;
        const newCache = new Map();

        // Get entire subtree in ONE API call - O(1) API calls
        const [subtree] = await chrome.bookmarks.getSubTree(arcifyFolder.id);

        // Process subtree - first level children are space folders
        for (const spaceFolder of subtree.children || []) {
            // Skip if it's a bookmark (has url), not a folder
            if (spaceFolder.url) continue;

            const spaceInfo = {
                spaceName: spaceFolder.title,
                spaceId: spaceFolder.id
            };

            // Recursively process space contents (in-memory, no API calls)
            this.processFolder(spaceFolder, spaceInfo, newCache);
        }

        this.cache = newCache;

        // Persist to storage for service worker restart recovery
        await this.persistCache();
        Logger.log(`[ArcifyProvider] Cache built with ${newCache.size} URLs`);
    }

    /**
     * Recursive folder processor - operates in-memory on getSubTree() result
     * No additional API calls during processing
     * @param {Object} folder - Bookmark folder from getSubTree()
     * @param {Object} spaceInfo - Space metadata to attach to bookmarks
     * @param {Map} cache - Cache map to populate
     */
    processFolder(folder, spaceInfo, cache) {
        for (const item of folder.children || []) {
            if (item.url) {
                // It's a bookmark - add to cache with normalized URL
                const normalizedUrl = this.normalizeUrl(item.url);
                cache.set(normalizedUrl, {
                    ...spaceInfo,
                    bookmarkId: item.id,
                    bookmarkTitle: item.title
                });
            } else {
                // It's a subfolder - recurse (still in-memory)
                this.processFolder(item, spaceInfo, cache);
            }
        }
    }

    /**
     * Persist cache to chrome.storage.local for service worker restart recovery
     * Note: Uses local (NOT session) because session does NOT survive restarts
     */
    async persistCache() {
        if (!this.cache) return;

        const storageData = {
            folderId: this.arcifyFolderId,
            urlMap: Object.fromEntries(this.cache),
            timestamp: Date.now()
        };

        await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: storageData });
    }

    /**
     * Invalidate cache - called by bookmark event handlers
     * Respects import batching to prevent thrashing
     */
    invalidateCache() {
        // If importing, defer invalidation until import completes
        if (this.isImporting) {
            this.pendingInvalidation = true;
            return;
        }

        this.cache = null;
        chrome.storage.local.remove(CACHE_STORAGE_KEY);
        Logger.log('[ArcifyProvider] Cache invalidated');
    }
}

// Singleton instance - exported for use by event handlers and message handlers
export const arcifyProvider = new ArcifyProvider();
