import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchEngine } from '../../shared/search-engine.js';
import { ResultType, SpotlightTabMode } from '../../shared/search-types.js';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

describe('SearchEngine.handleResultAction', () => {
    let engine;

    beforeEach(() => {
        resetChromeMocks();
        engine = new SearchEngine({
            isBackgroundProvider: true,
            getSpotlightSuggestions: vi.fn()
        });
    });

    describe('OPEN_TAB result type', () => {
        it('NEW_TAB mode activates tab and focuses window', async () => {
            const result = {
                type: ResultType.OPEN_TAB,
                url: 'https://example.com',
                metadata: { tabId: 42, windowId: 1 }
            };

            await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { active: true });
            expect(chromeMock.windows.update).toHaveBeenCalledWith(1, { focused: true });
        });

        it('NEW_TAB mode without windowId only activates tab', async () => {
            const result = {
                type: ResultType.OPEN_TAB,
                url: 'https://example.com',
                metadata: { tabId: 42 }
            };

            await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { active: true });
            expect(chromeMock.windows.update).not.toHaveBeenCalled();
        });

        it('CURRENT_TAB mode with currentTabId navigates existing tab', async () => {
            const result = {
                type: ResultType.OPEN_TAB,
                url: 'https://example.com',
                metadata: { tabId: 42, windowId: 1 }
            };

            await engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB, 99);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(99, { url: 'https://example.com' });
            expect(chromeMock.tabs.query).not.toHaveBeenCalled();
        });

        it('CURRENT_TAB mode without currentTabId queries for active tab', async () => {
            chromeMock.tabs.query.mockResolvedValue([{ id: 88 }]);

            const result = {
                type: ResultType.OPEN_TAB,
                url: 'https://example.com',
                metadata: { tabId: 42, windowId: 1 }
            };

            await engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB);

            expect(chromeMock.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
            expect(chromeMock.tabs.update).toHaveBeenCalledWith(88, { url: 'https://example.com' });
        });
    });

    describe('URL-based result types (URL_SUGGESTION, BOOKMARK, HISTORY, TOP_SITE)', () => {
        const urlResultTypes = [
            [ResultType.URL_SUGGESTION],
            [ResultType.BOOKMARK],
            [ResultType.HISTORY],
            [ResultType.TOP_SITE]
        ];

        it.each(urlResultTypes)('%s in NEW_TAB mode calls chrome.tabs.create', async (resultType) => {
            const result = {
                type: resultType,
                url: 'https://test.com'
            };

            await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

            expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://test.com' });
        });

        it.each(urlResultTypes)('%s in CURRENT_TAB mode with currentTabId calls chrome.tabs.update', async (resultType) => {
            const result = {
                type: resultType,
                url: 'https://test.com'
            };

            await engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB, 123);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(123, { url: 'https://test.com' });
        });

        it.each(urlResultTypes)('%s in CURRENT_TAB mode without currentTabId queries active tab', async (resultType) => {
            chromeMock.tabs.query.mockResolvedValue([{ id: 55 }]);

            const result = {
                type: resultType,
                url: 'https://test.com'
            };

            await engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB);

            expect(chromeMock.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
            expect(chromeMock.tabs.update).toHaveBeenCalledWith(55, { url: 'https://test.com' });
        });
    });

    describe('AUTOCOMPLETE_SUGGESTION result type', () => {
        it('NEW_TAB mode calls chrome.tabs.create', async () => {
            const result = {
                type: ResultType.AUTOCOMPLETE_SUGGESTION,
                url: 'https://autocomplete.com'
            };

            await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

            expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://autocomplete.com' });
        });

        it('CURRENT_TAB mode with currentTabId calls chrome.tabs.update', async () => {
            const result = {
                type: ResultType.AUTOCOMPLETE_SUGGESTION,
                url: 'https://autocomplete.com'
            };

            await engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB, 77);

            expect(chromeMock.tabs.update).toHaveBeenCalledWith(77, { url: 'https://autocomplete.com' });
        });
    });

    describe('SEARCH_QUERY result type', () => {
        it('NEW_TAB mode calls chrome.search.query with disposition NEW_TAB', async () => {
            const result = {
                type: ResultType.SEARCH_QUERY,
                metadata: { query: 'test search' }
            };

            await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

            expect(chromeMock.search.query).toHaveBeenCalledWith({
                text: 'test search',
                disposition: 'NEW_TAB'
            });
        });

        it('CURRENT_TAB mode calls chrome.search.query with disposition CURRENT_TAB', async () => {
            const result = {
                type: ResultType.SEARCH_QUERY,
                metadata: { query: 'another search' }
            };

            await engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB);

            expect(chromeMock.search.query).toHaveBeenCalledWith({
                text: 'another search',
                disposition: 'CURRENT_TAB'
            });
        });

        it('preserves query with special characters', async () => {
            const result = {
                type: ResultType.SEARCH_QUERY,
                metadata: { query: 'how to use C++ vectors?' }
            };

            await engine.handleResultAction(result, SpotlightTabMode.NEW_TAB);

            expect(chromeMock.search.query).toHaveBeenCalledWith({
                text: 'how to use C++ vectors?',
                disposition: 'NEW_TAB'
            });
        });
    });

    describe('error cases', () => {
        it('OPEN_TAB without tabId in NEW_TAB mode throws', async () => {
            const result = {
                type: ResultType.OPEN_TAB,
                url: 'https://example.com',
                metadata: {}
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('OPEN_TAB result missing tabId in metadata');
        });

        it('OPEN_TAB without URL in CURRENT_TAB mode throws', async () => {
            const result = {
                type: ResultType.OPEN_TAB,
                metadata: { tabId: 42 }
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB))
                .rejects.toThrow('OPEN_TAB result missing URL for current tab navigation');
        });

        it('URL_SUGGESTION without url throws', async () => {
            const result = {
                type: ResultType.URL_SUGGESTION
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('url-suggestion result missing URL');
        });

        it('BOOKMARK without url throws', async () => {
            const result = {
                type: ResultType.BOOKMARK
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('bookmark result missing URL');
        });

        it('HISTORY without url throws', async () => {
            const result = {
                type: ResultType.HISTORY
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('history result missing URL');
        });

        it('TOP_SITE without url throws', async () => {
            const result = {
                type: ResultType.TOP_SITE
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('top-site result missing URL');
        });

        it('SEARCH_QUERY without metadata.query throws', async () => {
            const result = {
                type: ResultType.SEARCH_QUERY,
                metadata: {}
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('SEARCH_QUERY result missing query in metadata');
        });

        it('SEARCH_QUERY without metadata throws', async () => {
            const result = {
                type: ResultType.SEARCH_QUERY
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('SEARCH_QUERY result missing query in metadata');
        });

        it('unknown result type throws', async () => {
            const result = {
                type: 'unknown-type',
                url: 'https://example.com'
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.NEW_TAB))
                .rejects.toThrow('Unknown result type: unknown-type');
        });

        it('CURRENT_TAB mode without active tab found throws', async () => {
            chromeMock.tabs.query.mockResolvedValue([]);

            const result = {
                type: ResultType.URL_SUGGESTION,
                url: 'https://example.com'
            };

            await expect(engine.handleResultAction(result, SpotlightTabMode.CURRENT_TAB))
                .rejects.toThrow('No active tab found');
        });
    });
});
