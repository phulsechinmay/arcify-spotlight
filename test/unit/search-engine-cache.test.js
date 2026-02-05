import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchEngine } from '../../shared/search-engine.js';
import { SpotlightTabMode } from '../../shared/search-types.js';

describe('SearchEngine.getSpotlightSuggestionsUsingCache', () => {
    let engine;
    let mockProvider;

    beforeEach(() => {
        vi.useFakeTimers();
        mockProvider = {
            isBackgroundProvider: true,
            getSpotlightSuggestions: vi.fn().mockResolvedValue([
                { type: 'open-tab', title: 'Test', url: 'https://test.com' }
            ])
        };
        engine = new SearchEngine(mockProvider);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('cache hit within TTL', () => {
        it('returns cached results without re-calling provider when within 30s TTL', async () => {
            // First call triggers provider
            const promise1 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151); // Past 150ms debounce
            const result1 = await promise1;

            // Advance 15 seconds (within 30s TTL)
            await vi.advanceTimersByTimeAsync(15000);

            // Second identical call should hit cache
            const promise2 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            // No need to advance timers for cached result - it resolves immediately
            const result2 = await promise2;

            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(result1).toEqual(result2);
        });
    });

    describe('cache miss after TTL expires', () => {
        it('triggers fresh API call when TTL (30s) has expired', async () => {
            // First call triggers provider
            const promise1 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151); // Past debounce
            await promise1;

            // Advance past 30s TTL
            await vi.advanceTimersByTimeAsync(30001);

            // Second call should trigger fresh API call (cache expired)
            const promise2 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151); // Past debounce for new call
            await promise2;

            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(2);
        });
    });

    describe('different queries cached independently', () => {
        it('caches "foo" and "bar" queries separately', async () => {
            // First query "foo"
            const promise1 = engine.getSpotlightSuggestionsUsingCache('foo', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise1;

            // Second query "bar" - different query, should trigger provider
            const promise2 = engine.getSpotlightSuggestionsUsingCache('bar', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise2;

            // Both queries should have triggered provider calls
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(2);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenNthCalledWith(1, 'foo', SpotlightTabMode.CURRENT_TAB);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenNthCalledWith(2, 'bar', SpotlightTabMode.CURRENT_TAB);
        });
    });

    describe('different modes cached independently', () => {
        it('caches same query with CURRENT_TAB and NEW_TAB modes separately', async () => {
            // Query "test" in CURRENT_TAB mode
            const promise1 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise1;

            // Same query "test" in NEW_TAB mode - different mode, should trigger provider
            const promise2 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.NEW_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise2;

            // Both should have triggered provider (cache key includes mode)
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(2);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenNthCalledWith(1, 'test', SpotlightTabMode.CURRENT_TAB);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenNthCalledWith(2, 'test', SpotlightTabMode.NEW_TAB);
        });
    });

    describe('cache key uses trimmed query', () => {
        it('treats "  test  " and "test" as same cache key', async () => {
            // First call with whitespace
            const promise1 = engine.getSpotlightSuggestionsUsingCache('  test  ', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise1;

            // Second call without whitespace - should hit cache
            const promise2 = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            const result2 = await promise2;

            // Only one provider call - second was cached
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
        });
    });

    describe('debounce behavior', () => {
        it('only triggers provider after debounce delay (150ms)', async () => {
            // Start a query but don't wait for debounce
            const promise = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);

            // Advance only 100ms (before debounce threshold)
            await vi.advanceTimersByTimeAsync(100);

            // Provider should not have been called yet
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(0);

            // Advance past debounce
            await vi.advanceTimersByTimeAsync(51);
            await promise;

            // Now provider should have been called
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
        });
    });
});
