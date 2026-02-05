import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchEngine } from '../../shared/search-engine.js';
import { SpotlightTabMode } from '../../shared/search-types.js';

describe('SearchEngine debouncing', () => {
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

    describe('rapid query coalescing', () => {
        it('rapid queries within debounce window trigger only one API call', async () => {
            // Fire queries "t", "te", "tes", "test" with 50ms gaps
            engine.getSpotlightSuggestionsUsingCache('t', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(50);

            engine.getSpotlightSuggestionsUsingCache('te', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(50);

            engine.getSpotlightSuggestionsUsingCache('tes', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(50);

            const promise = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151); // Past 150ms debounce
            await promise;

            // Only the final "test" query should trigger provider
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('test', SpotlightTabMode.CURRENT_TAB);
        });

        it('multiple rapid queries in quick succession only call provider once', async () => {
            // Fire 10 queries within debounce window
            for (let i = 1; i <= 10; i++) {
                engine.getSpotlightSuggestionsUsingCache(`query${i}`, SpotlightTabMode.CURRENT_TAB);
                await vi.advanceTimersByTimeAsync(10); // 10ms between each
            }

            // Advance past debounce to trigger final query
            await vi.advanceTimersByTimeAsync(151);

            // Only final query should trigger provider
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('query10', SpotlightTabMode.CURRENT_TAB);
        });
    });

    describe('query cancellation', () => {
        it('new query cancels pending debounced query', async () => {
            // Fire "first" query
            engine.getSpotlightSuggestionsUsingCache('first', SpotlightTabMode.CURRENT_TAB);

            // Advance 100ms (partial debounce - still pending)
            await vi.advanceTimersByTimeAsync(100);

            // Fire "second" query - should cancel pending "first"
            const promise = engine.getSpotlightSuggestionsUsingCache('second', SpotlightTabMode.CURRENT_TAB);

            // Advance past full debounce for second query
            await vi.advanceTimersByTimeAsync(151);
            await promise;

            // Only "second" should trigger provider - "first" was cancelled
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('second', SpotlightTabMode.CURRENT_TAB);
        });

        it('query at exact debounce boundary is cancelled by immediate new query', async () => {
            // Fire first query
            engine.getSpotlightSuggestionsUsingCache('first', SpotlightTabMode.CURRENT_TAB);

            // Advance to just before debounce threshold
            await vi.advanceTimersByTimeAsync(149);

            // Fire second query - should cancel first even at last millisecond
            const promise = engine.getSpotlightSuggestionsUsingCache('second', SpotlightTabMode.CURRENT_TAB);

            await vi.advanceTimersByTimeAsync(151);
            await promise;

            // Only "second" should be called
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('second', SpotlightTabMode.CURRENT_TAB);
        });
    });

    describe('separate debounce windows', () => {
        it('query after debounce delay triggers separately', async () => {
            // Fire "first" query
            const promise1 = engine.getSpotlightSuggestionsUsingCache('first', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151); // Triggers first
            await promise1;

            // Fire "second" query after first completed
            const promise2 = engine.getSpotlightSuggestionsUsingCache('second', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151); // Triggers second
            await promise2;

            // Both queries should have triggered provider calls
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(2);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenNthCalledWith(1, 'first', SpotlightTabMode.CURRENT_TAB);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenNthCalledWith(2, 'second', SpotlightTabMode.CURRENT_TAB);
        });

        it('queries separated by exactly debounce delay both trigger', async () => {
            // First query
            const promise1 = engine.getSpotlightSuggestionsUsingCache('alpha', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(150); // Exact debounce delay
            await vi.advanceTimersByTimeAsync(1); // One more ms to trigger
            await promise1;

            // Second query right after first triggered
            const promise2 = engine.getSpotlightSuggestionsUsingCache('beta', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise2;

            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(2);
        });
    });

    describe('empty query handling', () => {
        it('empty query still debounces', async () => {
            // Fire empty query
            const promise = engine.getSpotlightSuggestionsUsingCache('', SpotlightTabMode.CURRENT_TAB);

            // Provider should not be called before debounce
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(0);

            await vi.advanceTimersByTimeAsync(151);
            await promise;

            // Provider should be called with empty string after debounce
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('', SpotlightTabMode.CURRENT_TAB);
        });

        it('empty query cancels pending non-empty query', async () => {
            // Fire non-empty query
            engine.getSpotlightSuggestionsUsingCache('something', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(100);

            // Fire empty query - should cancel pending
            const promise = engine.getSpotlightSuggestionsUsingCache('', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise;

            // Only empty query should trigger
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('', SpotlightTabMode.CURRENT_TAB);
        });
    });

    describe('mode handling with debounce', () => {
        it('same query different mode during debounce triggers last mode only', async () => {
            // Fire query in CURRENT_TAB mode
            engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.CURRENT_TAB);
            await vi.advanceTimersByTimeAsync(50);

            // Fire same query in NEW_TAB mode - should cancel previous
            const promise = engine.getSpotlightSuggestionsUsingCache('test', SpotlightTabMode.NEW_TAB);
            await vi.advanceTimersByTimeAsync(151);
            await promise;

            // Only NEW_TAB mode call should happen
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledTimes(1);
            expect(mockProvider.getSpotlightSuggestions).toHaveBeenCalledWith('test', SpotlightTabMode.NEW_TAB);
        });
    });
});
