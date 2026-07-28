import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

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

// Shim window global before module import (message-client accesses window.arcifyCurrentTabId)
beforeAll(() => {
    globalThis.window = globalThis.window || {};
    globalThis.window.arcifyCurrentTabId = null;
});

import { SpotlightMessageClient } from '../../shared/message-client.js';
import { Logger } from '../../logger.js';

describe('SpotlightMessageClient', () => {
    beforeEach(() => {
        resetChromeMocks();
        vi.clearAllMocks();
        globalThis.window.arcifyCurrentTabId = null;
    });

    // ==========================================
    // getSuggestions
    // ==========================================
    describe('getSuggestions', () => {
        it('sends message with action getSpotlightSuggestions and trimmed query', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, results: [] });

            await SpotlightMessageClient.getSuggestions('  test query  ', 'current-tab');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'getSpotlightSuggestions',
                query: 'test query',
                mode: 'current-tab'
            });
        });

        it('returns response.results on success', async () => {
            const mockResults = [{ title: 'Result 1' }, { title: 'Result 2' }];
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, results: mockResults });

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual(mockResults);
        });

        it('returns empty array when response.success is false', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: false, error: 'Failed' });

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });

        it('returns empty array when sendMessage throws', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });

        it('returns empty array when response is null', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue(null);

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });

        it('returns empty array when response is undefined', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue(undefined);

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });
    });

    // ==========================================
    // getLocalSuggestions
    // ==========================================
    describe('getLocalSuggestions', () => {
        it('sends message with action getLocalSuggestions', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, results: [] });

            await SpotlightMessageClient.getLocalSuggestions('test', 'current-tab');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'getLocalSuggestions',
                query: 'test',
                mode: 'current-tab'
            });
        });

        it('returns response.results on success', async () => {
            const mockResults = [{ title: 'Local 1' }];
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, results: mockResults });

            const result = await SpotlightMessageClient.getLocalSuggestions('test', 'current-tab');
            expect(result).toEqual(mockResults);
        });

        it('returns empty array on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.getLocalSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });
    });

    // ==========================================
    // getAutocompleteSuggestions
    // ==========================================
    describe('getAutocompleteSuggestions', () => {
        it('sends message with action getAutocompleteSuggestions', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, results: [] });

            await SpotlightMessageClient.getAutocompleteSuggestions('test');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'getAutocompleteSuggestions',
                query: 'test'
            });
        });

        it('returns response.results on success', async () => {
            const mockResults = [{ title: 'Autocomplete 1' }];
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, results: mockResults });

            const result = await SpotlightMessageClient.getAutocompleteSuggestions('test');
            expect(result).toEqual(mockResults);
        });

        it('returns empty array on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.getAutocompleteSuggestions('test');
            expect(result).toEqual([]);
        });
    });

    // ==========================================
    // handleResult
    // ==========================================
    describe('handleResult', () => {
        it('sends message with action spotlightHandleResult', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = { url: 'https://test.com', title: 'Test' };
            await SpotlightMessageClient.handleResult(result, 'current-tab');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'spotlightHandleResult',
                result: result,
                mode: 'current-tab',
                tabId: null
            });
        });

        it('includes window.arcifyCurrentTabId in message (with null)', async () => {
            globalThis.window.arcifyCurrentTabId = null;
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            await SpotlightMessageClient.handleResult({}, 'current-tab');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ tabId: null })
            );
        });

        it('includes window.arcifyCurrentTabId in message (with real tab ID)', async () => {
            globalThis.window.arcifyCurrentTabId = 42;
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            await SpotlightMessageClient.handleResult({}, 'current-tab');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ tabId: 42 })
            );
        });

        it('returns true on success response', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = await SpotlightMessageClient.handleResult({}, 'current-tab');
            expect(result).toBe(true);
        });

        it('returns false when response.success is false', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: false, error: 'Failed' });

            const result = await SpotlightMessageClient.handleResult({}, 'current-tab');
            expect(result).toBe(false);
        });

        it('returns false when sendMessage throws', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));

            const result = await SpotlightMessageClient.handleResult({}, 'current-tab');
            expect(result).toBe(false);
        });

        it('returns false when response is null', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue(null);

            const result = await SpotlightMessageClient.handleResult({}, 'current-tab');
            expect(result).toBe(false);
        });
    });

    // ==========================================
    // getActiveSpaceColor
    // ==========================================
    describe('getActiveSpaceColor', () => {
        it('sends message with action getActiveSpaceColor', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, color: 'blue', groupName: 'Work' });

            await SpotlightMessageClient.getActiveSpaceColor();

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'getActiveSpaceColor'
            });
        });

        it('returns { color, groupName } from successful response', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, color: 'blue', groupName: 'Work' });

            const result = await SpotlightMessageClient.getActiveSpaceColor();
            expect(result).toEqual({ color: 'blue', groupName: 'Work' });
        });

        it('returns groupName as null when not provided in response', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true, color: 'blue' });

            const result = await SpotlightMessageClient.getActiveSpaceColor();
            expect(result).toEqual({ color: 'blue', groupName: null });
        });

        it('returns default { color: purple, groupName: null } on failure', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: false });

            const result = await SpotlightMessageClient.getActiveSpaceColor();
            expect(result).toEqual({ color: 'purple', groupName: null });
        });

        it('returns default when response has no color', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = await SpotlightMessageClient.getActiveSpaceColor();
            expect(result).toEqual({ color: 'purple', groupName: null });
        });

        it('returns default on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.getActiveSpaceColor();
            expect(result).toEqual({ color: 'purple', groupName: null });
        });
    });

    // ==========================================
    // notifyOpened / notifyClosed
    // ==========================================
    describe('notifyOpened / notifyClosed', () => {
        it('notifyOpened sends message with action spotlightOpened', () => {
            SpotlightMessageClient.notifyOpened();

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'spotlightOpened'
            });
        });

        it('notifyClosed sends message with action spotlightClosed', () => {
            SpotlightMessageClient.notifyClosed();

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'spotlightClosed'
            });
        });

        it('notifyOpened does not throw when sendMessage throws', () => {
            chromeMock.runtime.sendMessage.mockImplementation(() => {
                throw new Error('Extension context invalidated');
            });

            expect(() => SpotlightMessageClient.notifyOpened()).not.toThrow();
        });

        it('notifyClosed does not throw when sendMessage throws', () => {
            chromeMock.runtime.sendMessage.mockImplementation(() => {
                throw new Error('Extension context invalidated');
            });

            expect(() => SpotlightMessageClient.notifyClosed()).not.toThrow();
        });
    });

    // ==========================================
    // switchToTab
    // ==========================================
    describe('switchToTab', () => {
        it('sends message with action switchToTab and tabId/windowId', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            await SpotlightMessageClient.switchToTab(42, 1);

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'switchToTab',
                tabId: 42,
                windowId: 1
            });
        });

        it('returns true on success', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = await SpotlightMessageClient.switchToTab(42, 1);
            expect(result).toBe(true);
        });

        it('returns false on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.switchToTab(42, 1);
            expect(result).toBe(false);
        });
    });

    // ==========================================
    // navigateCurrentTab
    // ==========================================
    describe('navigateCurrentTab', () => {
        it('sends message with action navigateCurrentTab and url', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            await SpotlightMessageClient.navigateCurrentTab('https://example.com');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'navigateCurrentTab',
                url: 'https://example.com'
            });
        });

        it('returns true on success', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = await SpotlightMessageClient.navigateCurrentTab('https://example.com');
            expect(result).toBe(true);
        });

        it('returns false on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.navigateCurrentTab('https://example.com');
            expect(result).toBe(false);
        });
    });

    // ==========================================
    // openNewTab
    // ==========================================
    describe('openNewTab', () => {
        it('sends message with action openNewTab and url', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            await SpotlightMessageClient.openNewTab('https://example.com');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'openNewTab',
                url: 'https://example.com'
            });
        });

        it('returns true on success', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = await SpotlightMessageClient.openNewTab('https://example.com');
            expect(result).toBe(true);
        });

        it('returns false on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.openNewTab('https://example.com');
            expect(result).toBe(false);
        });
    });

    // ==========================================
    // performSearch
    // ==========================================
    describe('performSearch', () => {
        it('sends message with action performSearch and query/mode', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            await SpotlightMessageClient.performSearch('test query', 'current-tab');

            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                action: 'performSearch',
                query: 'test query',
                mode: 'current-tab'
            });
        });

        it('returns true on success', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

            const result = await SpotlightMessageClient.performSearch('test', 'current-tab');
            expect(result).toBe(true);
        });

        it('returns false on error', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Error'));

            const result = await SpotlightMessageClient.performSearch('test', 'current-tab');
            expect(result).toBe(false);
        });
    });

    // ==========================================
    // setupGlobalCloseListener
    // ==========================================
    describe('setupGlobalCloseListener', () => {
        it('adds listener to chrome.runtime.onMessage', () => {
            const callback = vi.fn();
            SpotlightMessageClient.setupGlobalCloseListener(callback);

            expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
        });

        it('calls onCloseCallback when closeSpotlight message received', () => {
            const callback = vi.fn();
            SpotlightMessageClient.setupGlobalCloseListener(callback);

            // Get the registered listener and call it
            const registeredListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
            registeredListener({ action: 'closeSpotlight' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('does not call callback for other message actions', () => {
            const callback = vi.fn();
            SpotlightMessageClient.setupGlobalCloseListener(callback);

            const registeredListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
            registeredListener({ action: 'someOtherAction' });

            expect(callback).not.toHaveBeenCalled();
        });

        it('returns cleanup function that removes the listener', () => {
            const callback = vi.fn();
            const cleanup = SpotlightMessageClient.setupGlobalCloseListener(callback);

            expect(typeof cleanup).toBe('function');
            cleanup();

            expect(chromeMock.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
            // The same listener that was added should be removed
            const addedListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
            const removedListener = chromeMock.runtime.onMessage.removeListener.mock.calls[0][0];
            expect(addedListener).toBe(removedListener);
        });
    });

    // ==========================================
    // runtime-unavailable scenarios
    // ==========================================
    describe('runtime-unavailable scenarios', () => {
        let savedRuntime;

        beforeEach(() => {
            savedRuntime = globalThis.chrome.runtime;
        });

        afterEach(() => {
            // Always restore chrome.runtime to prevent test contamination
            globalThis.chrome.runtime = savedRuntime;
        });

        it('getSuggestions returns empty array when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });

        it('getLocalSuggestions returns empty array when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.getLocalSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });

        it('getAutocompleteSuggestions returns empty array when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.getAutocompleteSuggestions('test');
            expect(result).toEqual([]);
        });

        it('handleResult returns false when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.handleResult({}, 'current-tab');
            expect(result).toBe(false);
        });

        it('getActiveSpaceColor returns default when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.getActiveSpaceColor();
            expect(result).toEqual({ color: 'purple', groupName: null });
        });

        it('switchToTab returns false when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.switchToTab(42, 1);
            expect(result).toBe(false);
        });

        it('navigateCurrentTab returns false when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.navigateCurrentTab('https://test.com');
            expect(result).toBe(false);
        });

        it('openNewTab returns false when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.openNewTab('https://test.com');
            expect(result).toBe(false);
        });

        it('performSearch returns false when chrome.runtime is undefined', async () => {
            globalThis.chrome.runtime = undefined;

            const result = await SpotlightMessageClient.performSearch('test', 'current-tab');
            expect(result).toBe(false);
        });

        it('handles sendMessage throwing Extension context invalidated', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));

            const result = await SpotlightMessageClient.getSuggestions('test', 'current-tab');
            expect(result).toEqual([]);
        });

        it('notifyOpened does not throw when chrome.runtime is undefined', () => {
            globalThis.chrome.runtime = undefined;

            expect(() => SpotlightMessageClient.notifyOpened()).not.toThrow();
        });

        it('notifyClosed does not throw when chrome.runtime is undefined', () => {
            globalThis.chrome.runtime = undefined;

            expect(() => SpotlightMessageClient.notifyClosed()).not.toThrow();
        });
    });
});
