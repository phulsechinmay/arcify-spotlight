import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';

// Mock Logger to prevent side effects
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

// Mock websiteNameExtractor
vi.mock('../../shared/website-name-extractor.js', () => ({
    websiteNameExtractor: {
        extractWebsiteName: vi.fn((url) => 'MockSiteName')
    }
}));

// Mock SpotlightUtils.isURL
vi.mock('../../shared/ui-utilities.js', () => ({
    SpotlightUtils: {
        isURL: vi.fn(() => false)
    }
}));

import { AutocompleteProvider } from '../../shared/data-providers/autocomplete-provider.js';
import { ResultType } from '../../shared/search-types.js';
import { getAutocompleteScore } from '../../shared/scoring-constants.js';
import { Logger } from '../../logger.js';
import { websiteNameExtractor } from '../../shared/website-name-extractor.js';
import { SpotlightUtils } from '../../shared/ui-utilities.js';

describe('AutocompleteProvider', () => {
    let provider;
    let mockFetch;

    beforeEach(() => {
        provider = new AutocompleteProvider();
        mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
        vi.clearAllMocks();
        // Reset mock defaults after clearAllMocks
        websiteNameExtractor.extractWebsiteName.mockReturnValue('MockSiteName');
        SpotlightUtils.isURL.mockReturnValue(false);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // Helper to create a Google suggest API response
    function createGoogleResponse(suggestions) {
        return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(['query', suggestions])
        };
    }

    // ==========================================
    // getAutocompleteSuggestions
    // ==========================================
    describe('getAutocompleteSuggestions', () => {
        it('returns empty array for empty query', async () => {
            const result = await provider.getAutocompleteSuggestions('');
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('returns empty array for whitespace-only query', async () => {
            const result = await provider.getAutocompleteSuggestions('   ');
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('returns empty array for query shorter than 2 characters', async () => {
            const result = await provider.getAutocompleteSuggestions('a');
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('calls fetch with correct Google suggest URL', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['suggestion1']));

            await provider.getAutocompleteSuggestions('test query');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const calledUrl = mockFetch.mock.calls[0][0];
            expect(calledUrl).toBe(
                `https://clients1.google.com/complete/search?client=firefox&q=${encodeURIComponent('test query')}`
            );
        });

        it('returns SearchResult array from successful response', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['suggestion1', 'suggestion2']));

            const results = await provider.getAutocompleteSuggestions('test');

            expect(results).toHaveLength(2);
            expect(results[0].type).toBe(ResultType.AUTOCOMPLETE_SUGGESTION);
            expect(results[0].title).toBe('suggestion1');
            expect(results[1].title).toBe('suggestion2');
        });

        it('caches results for 30 seconds (fetch called once for two rapid calls)', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['cached']));

            await provider.getAutocompleteSuggestions('cache test');
            const result2 = await provider.getAutocompleteSuggestions('cache test');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result2).toHaveLength(1);
            expect(result2[0].title).toBe('cached');
        });

        it('returns stale cache after TTL expiry (fetch called twice)', async () => {
            vi.useFakeTimers();
            try {
                mockFetch.mockResolvedValue(createGoogleResponse(['fresh']));

                await provider.getAutocompleteSuggestions('ttl test');
                expect(mockFetch).toHaveBeenCalledTimes(1);

                // Advance past the 30s TTL
                vi.advanceTimersByTime(31000);

                mockFetch.mockResolvedValue(createGoogleResponse(['refreshed']));
                await provider.getAutocompleteSuggestions('ttl test');
                expect(mockFetch).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('deduplicates concurrent identical requests (fetch called once, both resolve)', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['deduped']));

            const [result1, result2] = await Promise.all([
                provider.getAutocompleteSuggestions('same query'),
                provider.getAutocompleteSuggestions('same query')
            ]);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result1).toHaveLength(1);
            expect(result2).toHaveLength(1);
            expect(result1[0].title).toBe('deduped');
            expect(result2[0].title).toBe('deduped');
        });

        it('returns empty array on fetch error', async () => {
            mockFetch.mockRejectedValue(new Error('Network failure'));

            const result = await provider.getAutocompleteSuggestions('error test');
            expect(result).toEqual([]);
        });

        it('returns empty array on HTTP non-ok status', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            });

            const result = await provider.getAutocompleteSuggestions('rate limited');
            expect(result).toEqual([]);
        });

        it('returns empty array on AbortError / timeout', async () => {
            const abortError = new DOMException('The operation was aborted', 'AbortError');
            mockFetch.mockRejectedValue(abortError);

            const result = await provider.getAutocompleteSuggestions('timeout test');
            expect(result).toEqual([]);
        });

        it('logs warning on AbortError, logs error on other errors', async () => {
            // AbortError -> Logger.warn
            const abortError = new DOMException('The operation was aborted', 'AbortError');
            mockFetch.mockRejectedValue(abortError);

            await provider.getAutocompleteSuggestions('abort test');
            expect(Logger.warn).toHaveBeenCalledWith('[AutocompleteProvider] Request timeout');

            vi.clearAllMocks();
            websiteNameExtractor.extractWebsiteName.mockReturnValue('MockSiteName');
            SpotlightUtils.isURL.mockReturnValue(false);

            // Other error -> Logger.error
            const otherError = new Error('Network failure');
            mockFetch.mockRejectedValue(otherError);

            provider.clearCache();
            await provider.getAutocompleteSuggestions('error test');
            expect(Logger.error).toHaveBeenCalledWith(
                '[AutocompleteProvider] Fetch error:',
                otherError
            );
        });

        it('limits results to max 5 suggestions', async () => {
            const manySuggestions = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
            mockFetch.mockResolvedValue(createGoogleResponse(manySuggestions));

            const results = await provider.getAutocompleteSuggestions('many results');
            expect(results).toHaveLength(5);
        });
    });

    // ==========================================
    // fetchAutocompleteSuggestions
    // ==========================================
    describe('fetchAutocompleteSuggestions', () => {
        it('handles unexpected response format - non-array response', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue('not an array')
            });

            const result = await provider.fetchAutocompleteSuggestions('test');
            expect(result).toEqual([]);
            expect(Logger.warn).toHaveBeenCalled();
        });

        it('handles unexpected response format - missing data[1]', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(['query'])
            });

            const result = await provider.fetchAutocompleteSuggestions('test');
            expect(result).toEqual([]);
        });

        it('handles unexpected response format - data[1] not array', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(['query', 'not-an-array'])
            });

            const result = await provider.fetchAutocompleteSuggestions('test');
            expect(result).toEqual([]);
        });

        it('creates SearchResult with correct type (ResultType.AUTOCOMPLETE_SUGGESTION)', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['test suggestion']));

            const results = await provider.fetchAutocompleteSuggestions('test');
            expect(results[0].type).toBe(ResultType.AUTOCOMPLETE_SUGGESTION);
        });

        it('sets URL to google search URL for non-URL suggestions (isURL returns false)', async () => {
            SpotlightUtils.isURL.mockReturnValue(false);
            mockFetch.mockResolvedValue(createGoogleResponse(['hello world']));

            const results = await provider.fetchAutocompleteSuggestions('hello');
            expect(results[0].url).toBe(
                `https://www.google.com/search?q=${encodeURIComponent('hello world')}`
            );
        });

        it('sets URL to normalized suggestion for URL suggestions (isURL returns true)', async () => {
            SpotlightUtils.isURL.mockReturnValue(true);
            mockFetch.mockResolvedValue(createGoogleResponse(['example.com']));

            const results = await provider.fetchAutocompleteSuggestions('example');
            expect(results[0].url).toBe('https://example.com');
        });

        it('calls extractWebsiteName for URL suggestions as title', async () => {
            SpotlightUtils.isURL.mockReturnValue(true);
            websiteNameExtractor.extractWebsiteName.mockReturnValue('Example');
            mockFetch.mockResolvedValue(createGoogleResponse(['example.com']));

            const results = await provider.fetchAutocompleteSuggestions('example');
            expect(results[0].title).toBe('Example');
            expect(websiteNameExtractor.extractWebsiteName).toHaveBeenCalledWith('example.com');
        });

        it('assigns scores from getAutocompleteScore (score descends with index)', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['a', 'b', 'c']));

            const results = await provider.fetchAutocompleteSuggestions('test');
            expect(results[0].score).toBe(getAutocompleteScore(0));
            expect(results[1].score).toBe(getAutocompleteScore(1));
            expect(results[2].score).toBe(getAutocompleteScore(2));
            expect(results[0].score).toBeGreaterThan(results[1].score);
            expect(results[1].score).toBeGreaterThan(results[2].score);
        });
    });

    // ==========================================
    // extractWebsiteName
    // ==========================================
    describe('extractWebsiteName', () => {
        it('delegates to websiteNameExtractor.extractWebsiteName', () => {
            websiteNameExtractor.extractWebsiteName.mockReturnValue('GitHub');

            const result = provider.extractWebsiteName('https://github.com');
            expect(websiteNameExtractor.extractWebsiteName).toHaveBeenCalledWith('https://github.com');
            expect(result).toBe('GitHub');
        });

        it('falls back to hostname parsing when extractWebsiteName throws', () => {
            websiteNameExtractor.extractWebsiteName.mockImplementation(() => {
                throw new Error('Extraction failed');
            });

            const result = provider.extractWebsiteName('https://example.com/path');
            expect(result).toBe('Example.com');
        });

        it('strips www. prefix from fallback hostname', () => {
            websiteNameExtractor.extractWebsiteName.mockImplementation(() => {
                throw new Error('Extraction failed');
            });

            const result = provider.extractWebsiteName('https://www.github.com');
            expect(result).toBe('Github.com');
        });

        it('capitalizes first letter of fallback hostname', () => {
            websiteNameExtractor.extractWebsiteName.mockImplementation(() => {
                throw new Error('Extraction failed');
            });

            const result = provider.extractWebsiteName('https://docs.google.com');
            expect(result).toBe('Docs.google.com');
        });

        it('returns original URL when all parsing fails', () => {
            websiteNameExtractor.extractWebsiteName.mockImplementation(() => {
                throw new Error('Extraction failed');
            });

            const result = provider.extractWebsiteName('not-a-valid-url-://[broken');
            expect(result).toBe('not-a-valid-url-://[broken');
        });
    });

    // ==========================================
    // normalizeURL
    // ==========================================
    describe('normalizeURL', () => {
        it('returns URL as-is if it has http:// protocol', () => {
            expect(provider.normalizeURL('http://example.com')).toBe('http://example.com');
        });

        it('returns URL as-is if it has https:// protocol', () => {
            expect(provider.normalizeURL('https://example.com')).toBe('https://example.com');
        });

        it('returns URL as-is if it has chrome:// protocol', () => {
            expect(provider.normalizeURL('chrome://settings')).toBe('chrome://settings');
        });

        it('prepends https:// to URLs without protocol', () => {
            expect(provider.normalizeURL('example.com')).toBe('https://example.com');
        });

        it('prepends https:// to URLs with path but no protocol', () => {
            expect(provider.normalizeURL('example.com/path')).toBe('https://example.com/path');
        });
    });

    // ==========================================
    // clearCache / getCacheStats
    // ==========================================
    describe('clearCache / getCacheStats', () => {
        it('clearCache empties both cache and pendingRequests maps', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['cached']));
            await provider.getAutocompleteSuggestions('cache entry');

            expect(provider.cache.size).toBeGreaterThan(0);
            provider.clearCache();
            expect(provider.cache.size).toBe(0);
            expect(provider.pendingRequests.size).toBe(0);
        });

        it('getCacheStats returns correct cache size and entries', async () => {
            mockFetch.mockResolvedValue(createGoogleResponse(['result']));
            await provider.getAutocompleteSuggestions('stats query');

            const stats = provider.getCacheStats();
            expect(stats.cacheSize).toBe(1);
            expect(stats.pendingRequests).toBe(0);
            expect(stats.cacheEntries).toContain('stats query');
        });
    });
});
