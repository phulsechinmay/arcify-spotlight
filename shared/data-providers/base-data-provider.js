// base-data-provider.js - Abstract base class with shared business logic

import { SearchResult, ResultType } from '../search-types.js';
import { findMatchingDomains } from '../popular-sites.js';
import { BASE_SCORES, SCORE_BONUSES, SCORING_WEIGHTS, TYPE_SCORE_MAP, SCORE_SCALE, calculateRecencyScore, calculateFrequencyScore, AUTOCOMPLETE_BOOST_MAX, LOCAL_RESULT_THRESHOLD } from '../scoring-constants.js';
import { SpotlightUtils } from '../ui-utilities.js';
import { Logger } from '../../logger.js';
import { FuseSearchService } from '../fuse-search-service.js';

export class BaseDataProvider {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5000;
    }

    // ABSTRACT DATA FETCHERS (must be implemented by subclasses)
    async getOpenTabsData(query = '') { 
        throw new Error('getOpenTabsData must be implemented by subclass'); 
    }
    
    async getRecentTabsData(limit = 5) { 
        throw new Error('getRecentTabsData must be implemented by subclass'); 
    }
    
    async getBookmarksData(query) { 
        throw new Error('getBookmarksData must be implemented by subclass'); 
    }
    
    async getHistoryData(query) { 
        throw new Error('getHistoryData must be implemented by subclass'); 
    }
    
    async getTopSitesData() { 
        throw new Error('getTopSitesData must be implemented by subclass'); 
    }
    
    async getAutocompleteData(query) { 
        throw new Error('getAutocompleteData must be implemented by subclass'); 
    }
    
    async getPinnedTabsData(query = '') { 
        throw new Error('getPinnedTabsData must be implemented by subclass'); 
    }

    // FULL IMPLEMENTATIONS (shared business logic)

    // Main method to get spotlight suggestions
    async getSpotlightSuggestions(query, mode = 'current-tab') {
        const results = [];
        const trimmedQuery = query.trim().toLowerCase();

        if (!trimmedQuery) {
            return this.getDefaultResults(mode);
        }

        try {
            // Fetch all 6 data sources in parallel (PERF-01)
            // Individual source failures are caught and logged without affecting other sources
            const settled = await Promise.allSettled([
                this.getOpenTabs(trimmedQuery),
                this.getPinnedTabSuggestions(trimmedQuery),
                this.getBookmarkSuggestions(trimmedQuery),
                this.getHistorySuggestions(trimmedQuery),
                this.getTopSites(),
                this.getAutocompleteSuggestions(trimmedQuery),
            ]);

            const [openTabs, pinnedTabs, bookmarks, history, topSites, autocomplete] =
                settled.map(result => {
                    if (result.status === 'fulfilled') return result.value;
                    Logger.error('[SearchProvider] Source failed:', result.reason);
                    return [];
                });

            // Skip URL/search suggestions - these are handled by instant suggestions in the UI
            // Collect all results first
            const allResults = [];
            allResults.push(...openTabs, ...pinnedTabs, ...bookmarks, ...history, ...autocomplete);
            
            // Add top sites that match query (with fuzzy domain matching)
            const matchingTopSites = this.findMatchingTopSites(topSites, trimmedQuery);
            allResults.push(...matchingTopSites);
            
            // Add fuzzy domain matches from popular sites
            const fuzzyDomainMatches = this.getFuzzyDomainMatches(trimmedQuery);
            allResults.push(...fuzzyDomainMatches);

            // Apply comprehensive deduplication across all sources
            const deduplicatedResults = this.deduplicateResults(allResults);

            // Enrich with Arcify space info (after dedup to avoid redundant lookups)
            const enrichedResults = await this.enrichWithArcifyInfo(deduplicatedResults);

            // Score and sort results
            const finalResults = this.scoreAndSortResults(enrichedResults, trimmedQuery);
            return finalResults;
        } catch (error) {
            Logger.error('[SearchProvider] Search error:', error);
            const fallback = this.generateFallbackResult(trimmedQuery);
            return [fallback];
        }
    }

    // Get local suggestions only (fast, no autocomplete) - PERF-03 progressive rendering
    async getLocalSuggestions(query, mode = 'current-tab') {
        const trimmedQuery = query.trim().toLowerCase();

        if (!trimmedQuery) {
            return this.getDefaultResults(mode);
        }

        try {
            // Fetch 5 local data sources in parallel (no autocomplete)
            const settled = await Promise.allSettled([
                this.getOpenTabs(trimmedQuery),
                this.getPinnedTabSuggestions(trimmedQuery),
                this.getBookmarkSuggestions(trimmedQuery),
                this.getHistorySuggestions(trimmedQuery),
                this.getTopSites(),
            ]);

            const [openTabs, pinnedTabs, bookmarks, history, topSites] =
                settled.map(result => {
                    if (result.status === 'fulfilled') return result.value;
                    Logger.error('[SearchProvider] Source failed:', result.reason);
                    return [];
                });

            // Collect all local results
            const allResults = [];
            allResults.push(...openTabs, ...pinnedTabs, ...bookmarks, ...history);

            // Add top sites that match query (with fuzzy domain matching)
            const matchingTopSites = this.findMatchingTopSites(topSites, trimmedQuery);
            allResults.push(...matchingTopSites);

            // Add fuzzy domain matches from popular sites
            const fuzzyDomainMatches = this.getFuzzyDomainMatches(trimmedQuery);
            allResults.push(...fuzzyDomainMatches);

            // Apply comprehensive deduplication across all sources
            const deduplicatedResults = this.deduplicateResults(allResults);

            // Enrich with Arcify space info (after dedup to avoid redundant lookups)
            const enrichedResults = await this.enrichWithArcifyInfo(deduplicatedResults);

            // Score and sort results
            const finalResults = this.scoreAndSortResults(enrichedResults, trimmedQuery);
            return finalResults;
        } catch (error) {
            Logger.error('[SearchProvider] Local search error:', error);
            const fallback = this.generateFallbackResult(trimmedQuery);
            return [fallback];
        }
    }

    // Get default results when no query
    async getDefaultResults(mode) {
        const results = [];

        try {
            // Show all open tabs for both modes when no query
            const openTabs = await this.getOpenTabs('');
            results.push(...openTabs);
        } catch (error) {
            Logger.error('[SearchProvider] Error getting default results:', error);
        }

        // Apply deduplication to default results as well
        const deduplicatedResults = this.deduplicateResults(results);

        // Enrich with Arcify space info (so chips appear on default results too)
        const enrichedResults = await this.enrichWithArcifyInfo(deduplicatedResults);
        return enrichedResults;
    }

    // Chrome tabs API integration
    async getOpenTabs(query = '') {
        try {
            const tabsData = await this.getOpenTabsData(query);

            const results = tabsData.map(tab => new SearchResult({
                type: tab.pinned ? ResultType.PINNED_TAB : ResultType.OPEN_TAB,
                title: tab.title,
                url: tab.url,
                favicon: tab.favIconUrl,
                metadata: {
                    tabId: tab.id,
                    windowId: tab.windowId,
                    groupName: tab.groupName || null,
                    groupColor: tab.groupColor || null,
                    matchScore: tab._matchScore || null
                }
            }));
            return results;
        } catch (error) {
            Logger.error('[SearchProvider-Tabs] Error querying tabs:', error);
            return [];
        }
    }

    // Get recent tabs by activity
    async getRecentTabs(limit = 5) {
        try {
            const tabsData = await this.getRecentTabsData(limit);

            const results = tabsData.map(tab => new SearchResult({
                type: tab.pinned ? ResultType.PINNED_TAB : ResultType.OPEN_TAB,
                title: tab.title,
                url: tab.url,
                favicon: tab.favIconUrl,
                metadata: {
                    tabId: tab.id,
                    windowId: tab.windowId,
                    groupName: tab.groupName || null,
                    groupColor: tab.groupColor || null
                }
            }));
            return results;
        } catch (error) {
            Logger.error('[SearchProvider-Tabs] Error getting recent tabs:', error);
            return [];
        }
    }

    // Chrome bookmarks API integration
    async getPinnedTabSuggestions(query) {
        try {
            Logger.log('[BaseDataProvider] getPinnedTabSuggestions called with query:', query);
            const pinnedTabsData = await this.getPinnedTabsData(query);
            Logger.log('[BaseDataProvider] Got pinned tabs data:', pinnedTabsData.length, pinnedTabsData);
            
            const results = pinnedTabsData.map(pinnedTab => {
                const result = new SearchResult({
                    type: ResultType.PINNED_TAB,
                    title: pinnedTab.title,
                    url: pinnedTab.url,
                    metadata: {
                        bookmarkId: pinnedTab.id,
                        spaceId: pinnedTab.spaceId,
                        spaceName: pinnedTab.spaceName,
                        spaceColor: pinnedTab.spaceColor,
                        tabId: pinnedTab.tabId,
                        isActive: pinnedTab.isActive,
                        matchScore: pinnedTab._matchScore || null
                    }
                });
                Logger.log('[BaseDataProvider] Created PINNED_TAB SearchResult:', result);
                return result;
            });
            Logger.log('[BaseDataProvider] Returning', results.length, 'pinned tab results');
            return results;
        } catch (error) {
            Logger.error('[SearchProvider-PinnedTabs] Error getting pinned tab suggestions:', error);
            return [];
        }
    }

    async getBookmarkSuggestions(query) {
        try {
            const bookmarksData = await this.getBookmarksData(query);
            
            const results = bookmarksData.map(bookmark => new SearchResult({
                type: ResultType.BOOKMARK,
                title: bookmark.title,
                url: bookmark.url,
                metadata: { bookmarkId: bookmark.id, matchScore: bookmark._matchScore || null }
            }));
            return results;
        } catch (error) {
            Logger.error('[SearchProvider-Bookmarks] Error getting bookmark suggestions:', error);
            return [];
        }
    }

    // Chrome history API integration
    async getHistorySuggestions(query) {
        try {
            const historyData = await this.getHistoryData(query);
            
            const results = historyData.map(item => new SearchResult({
                type: ResultType.HISTORY,
                title: item.title || item.url,
                url: item.url,
                metadata: {
                    visitCount: item.visitCount,
                    lastVisitTime: item.lastVisitTime,
                    matchScore: item._matchScore || null
                }
            }));
            return results;
        } catch (error) {
            Logger.error('[SearchProvider-History] Error getting history suggestions:', error);
            return [];
        }
    }

    // Chrome topSites API integration
    async getTopSites() {
        try {
            const topSitesData = await this.getTopSitesData();
            
            const results = topSitesData.map(site => new SearchResult({
                type: ResultType.TOP_SITE,
                title: site.title,
                url: site.url
            }));
            return results;
        } catch (error) {
            Logger.error('[SearchProvider-TopSites] Error getting top sites:', error);
            return [];
        }
    }

    // Autocomplete suggestions integration
    async getAutocompleteSuggestions(query) {
        try {
            const autocompleteData = await this.getAutocompleteData(query);
            return autocompleteData; // AutocompleteProvider already returns SearchResult objects
        } catch (error) {
            Logger.error('[SearchProvider-Autocomplete] Error getting autocomplete suggestions:', error);
            return [];
        }
    }


    // Generate URL suggestion
    generateURLSuggestion(input) {
        // Import helper from ui-utilities for URL normalization
        const url = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) ? input : `https://${input}`;
        return new SearchResult({
            type: ResultType.URL_SUGGESTION,
            title: `Navigate to ${url}`,
            url: url,
            score: 95
        });
    }

    // Generate search suggestion
    generateSearchSuggestion(input) {
        return new SearchResult({
            type: ResultType.SEARCH_QUERY,
            title: `Search for "${input}"`,
            url: '',  // URL not needed since we'll use chrome.search API
            score: 80,
            metadata: { query: input }
        });
    }

    // Generate fallback result for errors
    generateFallbackResult(input) {
        if (SpotlightUtils.isURL(input)) {
            return this.generateURLSuggestion(input);
        } else {
            return this.generateSearchSuggestion(input);
        }
    }

    // Score and sort results with conditional autocomplete boost (SCORE-05)
    scoreAndSortResults(results, query) {
        // Score all results
        results.forEach(result => {
            result.score = this.calculateRelevanceScore(result, query);
        });

        // Apply conditional autocomplete boost when local results are sparse
        const localCount = results.filter(r =>
            r.type !== ResultType.AUTOCOMPLETE_SUGGESTION
        ).length;

        if (localCount < LOCAL_RESULT_THRESHOLD) {
            const boostFactor = (LOCAL_RESULT_THRESHOLD - localCount) / LOCAL_RESULT_THRESHOLD;
            results.forEach(r => {
                if (r.type === ResultType.AUTOCOMPLETE_SUGGESTION) {
                    r.score += AUTOCOMPLETE_BOOST_MAX * boostFactor;
                }
            });
        }

        // Sort by score (descending) and limit to top 8
        const sorted = results
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        return sorted;
    }

    // Weighted multi-signal relevance scoring (Phase 10)
    // Signals: type priority, match quality, recency (history), frequency (history)
    // Non-history types use redistributed weights so TYPE + MATCH still span full 0-1 range
    calculateRelevanceScore(result, query) {
        // Autocomplete results use their own scoring path (base score + position penalty)
        if (result.type === ResultType.AUTOCOMPLETE_SUGGESTION) {
            return result.score || BASE_SCORES.AUTOCOMPLETE_SUGGESTION;
        }

        // Signal 1: Type score (normalized 0-1)
        const typeScore = TYPE_SCORE_MAP[result.type] || 0;

        // Signal 2: Match quality (0-1 from Fuse.js, or synthetic from string matching)
        let matchQuality = result.metadata?.matchScore;
        if (matchQuality == null || matchQuality <= 0) {
            // Compute synthetic matchScore from string matching
            const queryLower = query.toLowerCase();
            const titleLower = (result.title || '').toLowerCase();
            const urlLower = (result.url || '').toLowerCase();

            let syntheticScore = 0.1; // Passed some filter to get here

            if (titleLower === queryLower) {
                syntheticScore = 1.0;
            } else if (titleLower.startsWith(queryLower)) {
                syntheticScore = 0.8;
            } else if (titleLower.includes(queryLower)) {
                syntheticScore = 0.6;
            }

            if (urlLower.includes(queryLower) && syntheticScore < 0.3) {
                syntheticScore = 0.3;
            }

            matchQuality = syntheticScore;
        }

        // Signal 3: Recency (0-1, history only)
        const isHistory = result.type === ResultType.HISTORY;
        const recencyScore = isHistory
            ? calculateRecencyScore(result.metadata?.lastVisitTime)
            : 0;

        // Signal 4: Frequency (0-1, history only)
        const frequencyScore = isHistory
            ? calculateFrequencyScore(result.metadata?.visitCount)
            : 0;

        // Compute weighted score with weight redistribution for non-history types
        let weightedScore;
        if (isHistory) {
            // All 4 weights apply (sum = 1.0)
            weightedScore =
                SCORING_WEIGHTS.TYPE * typeScore +
                SCORING_WEIGHTS.MATCH * matchQuality +
                SCORING_WEIGHTS.RECENCY * recencyScore +
                SCORING_WEIGHTS.FREQUENCY * frequencyScore;
        } else {
            // Only TYPE and MATCH apply, redistributed to sum to 1.0
            const weightSum = SCORING_WEIGHTS.TYPE + SCORING_WEIGHTS.MATCH;
            const effectiveTypeWeight = SCORING_WEIGHTS.TYPE / weightSum;
            const effectiveMatchWeight = SCORING_WEIGHTS.MATCH / weightSum;
            weightedScore =
                effectiveTypeWeight * typeScore +
                effectiveMatchWeight * matchQuality;
        }

        // Scale to existing score range (0-115) for backward compatibility
        return Math.max(0, weightedScore * SCORE_SCALE);
    }

    // Top sites matching using Fuse.js fuzzy search
    findMatchingTopSites(topSites, query) {
        if (!query || topSites.length === 0) return [];

        const fuseResults = FuseSearchService.search(topSites, query, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'url', weight: 1 }
            ]
        });

        return fuseResults.map(result => {
            const site = result.item;
            site.metadata = site.metadata || {};
            site.metadata.matchScore = result.matchScore;
            return site;
        });
    }

    // Get fuzzy domain matches from popular sites (Fuse.js-based)
    getFuzzyDomainMatches(query) {
        const matches = findMatchingDomains(query, 5); // Limit to top 5 matches

        return matches.map(match => new SearchResult({
            type: ResultType.TOP_SITE,
            title: match.displayName,
            url: `https://${match.domain}`,
            metadata: {
                matchScore: match.matchScore,
                originalQuery: query
            }
        }));
    }

    // Comprehensive deduplication across all result sources
    deduplicateResults(results) {
        const seen = new Map();
        const deduplicated = [];

        for (const result of results) {
            // Generate a deduplication key based on URL or title
            let key = '';
            if (result.url) {
                // Normalize URL for consistent deduplication
                key = this.normalizeUrlForDeduplication(result.url);
            } else if (result.type === 'search-query') {
                // For search queries, use the title as key
                key = `search:${result.title}`;
            } else {
                // Fallback to title for other types
                key = result.title || '';
            }

            if (!key) {
                // Skip results without identifiable keys
                continue;
            }

            const existing = seen.get(key);
            if (!existing) {
                // First occurrence - keep it
                seen.set(key, result);
                deduplicated.push(result);
            } else {
                // Duplicate found - keep the one with higher score/priority
                const existingPriority = this.getResultPriority(existing);
                const currentPriority = this.getResultPriority(result);
                
                if (currentPriority > existingPriority) {
                    // Replace with higher priority result
                    const index = deduplicated.indexOf(existing);
                    if (index !== -1) {
                        deduplicated[index] = result;
                        seen.set(key, result);
                    }
                }
                // Otherwise keep the existing one (no action needed)
            }
        }

        return deduplicated;
    }

    // Normalize URL for consistent deduplication
    // Handles: fragments (#section), trailing slashes, protocol (http/https), www prefix
    // Query parameters are intentionally preserved (different params = different pages)
    normalizeUrlForDeduplication(url) {
        if (!url) return '';

        let normalizedUrl = url.toLowerCase();

        // Remove URL fragments (anchors) - user decision: ignore fragments
        // Must be done first before other normalizations
        const fragmentIndex = normalizedUrl.indexOf('#');
        if (fragmentIndex !== -1) {
            normalizedUrl = normalizedUrl.substring(0, fragmentIndex);
        }

        // Remove trailing slashes - user decision: ignore trailing slashes
        normalizedUrl = normalizedUrl.replace(/\/+$/, '');

        // Remove protocol prefixes for comparison (http/https shouldn't matter)
        normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');

        // Remove www. prefix for comparison - user decision: ignore www prefix
        normalizedUrl = normalizedUrl.replace(/^www\./, '');

        return normalizedUrl;
    }

    /**
     * Enrich results with Arcify space metadata
     * Called after deduplication (to avoid redundant lookups) and before scoring
     *
     * For each result with a URL, checks if it belongs to an Arcify space.
     * If found, injects space metadata (isArcify, spaceName, spaceId, bookmarkId, bookmarkTitle).
     *
     * Note: null spaceInfo is expected for non-Arcify URLs - this is NOT an error.
     * Results without URLs or those already enriched (pinned tabs) are skipped.
     *
     * @param {Array<SearchResult>} results - Deduplicated results to enrich
     * @returns {Promise<Array<SearchResult>>} Same array with Arcify metadata injected
     */
    async enrichWithArcifyInfo(results) {
        // Lazy-load arcifyProvider to avoid circular dependencies
        if (!this.arcifyProvider) {
            const { arcifyProvider } = await import('./arcify-provider.js');
            this.arcifyProvider = arcifyProvider;
        }

        // Early return if no Arcify folder exists (skip compute)
        await this.arcifyProvider.ensureCacheBuilt();
        if (!this.arcifyProvider.hasData()) {
            return results;
        }

        for (const result of results) {
            // Skip if no URL
            if (!result.url) continue;

            // Skip if already has space info (e.g., pinned tabs from getPinnedTabSuggestions)
            if (result.metadata?.spaceName) continue;

            // O(1) lookup via Map.get()
            const spaceInfo = await this.arcifyProvider.getSpaceForUrl(result.url);

            // null means not in Arcify folder - this is expected, not an error
            if (spaceInfo) {
                result.metadata = result.metadata || {};
                result.metadata.isArcify = true;
                result.metadata.spaceName = spaceInfo.spaceName;
                result.metadata.spaceId = spaceInfo.spaceId;
                result.metadata.bookmarkId = spaceInfo.bookmarkId;
                result.metadata.bookmarkTitle = spaceInfo.bookmarkTitle;
                result.metadata.spaceColor = spaceInfo.spaceColor || 'grey';
            }
        }

        return results;
    }

    // Get result priority for deduplication (higher = better)
    // Priority order: open-tab > pinned-tab > bookmark > history > top-site
    // When same URL exists in multiple sources, higher priority source wins
    getResultPriority(result) {
        // Use BASE_SCORES for consistent priority hierarchy
        const typePriorities = {
            'open-tab': BASE_SCORES.OPEN_TAB,
            'pinned-tab': BASE_SCORES.PINNED_TAB,
            'bookmark': BASE_SCORES.BOOKMARK,
            'history': BASE_SCORES.HISTORY,
            'top-site': BASE_SCORES.TOP_SITE,
            'autocomplete-suggestion': BASE_SCORES.AUTOCOMPLETE_SUGGESTION,
            'search-query': BASE_SCORES.SEARCH_QUERY,
            'url-suggestion': BASE_SCORES.URL_SUGGESTION
        };

        const basePriority = typePriorities[result.type] || 0;
        
        // Add any additional score the result might have
        const additionalScore = result.score || 0;
        
        return basePriority + additionalScore;
    }
}