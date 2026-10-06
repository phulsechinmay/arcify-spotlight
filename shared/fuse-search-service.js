/**
 * Fuse Search Service - Centralized Fuse.js wrapper with shared configuration
 *
 * Purpose: Provides consistent fuzzy matching across all data sources using Fuse.js
 * Key Functions: FuseSearchService.search() with standardized options and score inversion
 * Architecture: Static utility class wrapping Fuse.js with shared defaults
 *
 * Critical Notes:
 * - Score inversion: Fuse.js returns 0=perfect, we return 1=perfect (matchScore = 1 - fuseScore)
 * - ignoreLocation: true is CRITICAL for URL matching (matches can appear anywhere in string)
 * - Do NOT add `keys` to defaults -- each data source passes its own keys via optionOverrides
 * - Indexes are cached by collection identity; callers must replace arrays when data changes
 * - Result counts are bounded before downstream enrichment and rendering
 */

import Fuse from 'fuse.js';

// Shared configuration for all data sources
// Note: `keys` is intentionally omitted -- varies per data source
export const FUSE_DEFAULT_OPTIONS = {
    threshold: 0.4,            // 0.0=exact, 1.0=match anything. 0.4 balances fuzziness vs false positives
    ignoreLocation: true,      // CRITICAL: URLs and titles can have matches anywhere, not just near index 0
    includeScore: true,        // REQUIRED: We need the 0-1 score for match quality (MATCH-04)
    isCaseSensitive: false,    // Case-insensitive matching (matches current behavior)
    minMatchCharLength: 2,     // Prevent single-char queries from matching everything
    shouldSort: true,          // Let Fuse sort by match quality
    findAllMatches: false,     // Stop at first good match per item (performance)
    fieldNormWeight: 1,        // Default. Shorter fields (titles) naturally score higher than longer fields (URLs)
};

export class FuseSearchService {
    static indexCache = new WeakMap();

    /**
     * Search a collection of items using Fuse.js
     * @param {Array} items - Array of objects to search through
     * @param {string} query - Search query
     * @param {Object} optionOverrides - Override default options (must include `keys` for the data source)
     * @returns {Array<{item: Object, matchScore: number}>} Results with matchScore 0-1 (1=perfect match)
     */
    static search(items, query, optionOverrides = {}, limit = 20) {
        if (!items || items.length === 0 || !query) return [];

        const mergedOptions = { ...FUSE_DEFAULT_OPTIONS, ...optionOverrides };
        const optionKey = JSON.stringify(mergedOptions);
        let cached = FuseSearchService.indexCache.get(items);
        if (!cached || cached.optionKey !== optionKey) {
            cached = { optionKey, fuse: new Fuse(items, mergedOptions) };
            FuseSearchService.indexCache.set(items, cached);
        }
        const searchOptions = Number.isInteger(limit) && limit >= 0 ? { limit } : undefined;
        const results = cached.fuse.search(query, searchOptions);

        // Convert Fuse score (0=perfect, 1=mismatch) to our format (1=perfect, 0=mismatch)
        return results.map(result => ({
            item: result.item,
            matchScore: 1 - result.score
        }));
    }
}
