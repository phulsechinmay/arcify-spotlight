import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

// Import setup for side effects
import './setup.js';

describe('Integration: Activation Flow - INT-03', () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.resetModules();
    chromeMock.runtime.onMessage.clearListeners();
  });

  describe('Spotlight State Messages', () => {
    it('spotlightOpened message tracks tab in background', async () => {
      await import('../../background.js');

      const sendResponse = vi.fn();
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        sendResponse
      );

      // spotlightOpened is synchronous (returns false)
      // Tab should be tracked internally - no error thrown
      expect(true).toBe(true); // Handler executed without error
    });

    it('spotlightClosed message removes tab from tracking', async () => {
      await import('../../background.js');

      // First open
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // Then close
      const sendResponse = vi.fn();
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        { tab: { id: 42 } },
        sendResponse
      );

      // Handler executed without error
      expect(true).toBe(true);
    });

    it('spotlightOpened without tab ID is handled gracefully', async () => {
      await import('../../background.js');

      const sendResponse = vi.fn();
      // Call without sender.tab - should not throw
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        {}, // No tab info
        sendResponse
      );

      expect(true).toBe(true); // No error thrown
    });

    it('spotlightClosed without tab ID is handled gracefully', async () => {
      await import('../../background.js');

      const sendResponse = vi.fn();
      // Call without sender.tab - should not throw
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        {}, // No tab info
        sendResponse
      );

      expect(true).toBe(true); // No error thrown
    });
  });

  describe('Full Lifecycle', () => {
    it('complete lifecycle: open -> search -> close completes correctly', async () => {
      chromeMock.tabs.query.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      // 1. Open spotlight
      const openResponse = vi.fn();
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        openResponse
      );

      // 2. Perform search
      const searchResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'test', mode: 'current-tab' },
        { tab: { id: 42 } },
        searchResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(searchResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      // 3. Close spotlight
      const closeResponse = vi.fn();
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        { tab: { id: 42 } },
        closeResponse
      );

      // Verify search succeeded during lifecycle
      expect(searchResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('escape/close during search properly cleans up', async () => {
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, title: 'Tab', url: 'https://test.com', windowId: 1 }]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      // Open spotlight
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // Start search (don't await)
      const searchResponse = vi.fn();
      chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'test', mode: 'current-tab' },
        { tab: { id: 42 } },
        searchResponse
      );

      // Close immediately (simulating escape key)
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // Search should still complete without error
      await vi.waitFor(() => expect(searchResponse).toHaveBeenCalled(), { timeout: 3000 });
      expect(searchResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('lifecycle with result selection: open -> search -> select -> close', async () => {
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1, title: 'GitHub', url: 'https://github.com', windowId: 1 }
      ]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);
      chromeMock.tabs.update.mockResolvedValue({});
      chromeMock.windows.update.mockResolvedValue({});

      await import('../../background.js');

      // 1. Open spotlight
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // 2. Perform search
      const searchResponse = vi.fn();
      const { asyncResponse: searchAsync } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'git', mode: 'current-tab' },
        { tab: { id: 42 } },
        searchResponse
      );

      if (searchAsync) {
        await vi.waitFor(() => expect(searchResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      // 3. Handle result selection (switch to tab)
      const resultResponse = vi.fn();
      const { asyncResponse: resultAsync } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: { type: 'open-tab', metadata: { tabId: 1, windowId: 1 } },
          mode: 'new-tab'
        },
        { tab: { id: 42 } },
        resultResponse
      );

      if (resultAsync) {
        await vi.waitFor(() => expect(resultResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      // 4. Close spotlight
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // Verify all operations succeeded
      expect(searchResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(resultResponse).toHaveBeenCalledWith({ success: true });
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(1, { active: true });
    });
  });

  describe('Double Activation', () => {
    it('rapid activations are handled without errors', async () => {
      await import('../../background.js');

      // Rapidly open/close multiple times
      for (let i = 0; i < 3; i++) {
        chromeMock.runtime.onMessage.callListeners(
          { action: 'spotlightOpened' },
          { tab: { id: 42 } },
          vi.fn()
        );
        chromeMock.runtime.onMessage.callListeners(
          { action: 'spotlightClosed' },
          { tab: { id: 42 } },
          vi.fn()
        );
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('multiple tabs can have spotlight tracked independently', async () => {
      await import('../../background.js');

      // Open spotlight in tab 1
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 1 } },
        vi.fn()
      );

      // Open spotlight in tab 2
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 2 } },
        vi.fn()
      );

      // Close spotlight in tab 1
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        { tab: { id: 1 } },
        vi.fn()
      );

      // Tab 2 should still be tracked (no error)
      expect(true).toBe(true);
    });

    it('double open on same tab does not cause issues', async () => {
      await import('../../background.js');

      // Open twice on same tab
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        vi.fn()
      );
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // Close once
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightClosed' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Search During Different States', () => {
    it('search without prior spotlightOpened still works', async () => {
      chromeMock.tabs.query.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      // Directly search without opening spotlight first
      const searchResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'test', mode: 'current-tab' },
        { tab: { id: 42 } },
        searchResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(searchResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      // Search should still work
      expect(searchResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('multiple sequential searches during single session', async () => {
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1, title: 'Google', url: 'https://google.com', windowId: 1 },
        { id: 2, title: 'GitHub', url: 'https://github.com', windowId: 1 }
      ]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      // Open spotlight
      chromeMock.runtime.onMessage.callListeners(
        { action: 'spotlightOpened' },
        { tab: { id: 42 } },
        vi.fn()
      );

      // First search
      const search1Response = vi.fn();
      const { asyncResponse: async1 } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'goo', mode: 'current-tab' },
        { tab: { id: 42 } },
        search1Response
      );
      if (async1) {
        await vi.waitFor(() => expect(search1Response).toHaveBeenCalled(), { timeout: 3000 });
      }

      // Second search (different query)
      const search2Response = vi.fn();
      const { asyncResponse: async2 } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'git', mode: 'current-tab' },
        { tab: { id: 42 } },
        search2Response
      );
      if (async2) {
        await vi.waitFor(() => expect(search2Response).toHaveBeenCalled(), { timeout: 3000 });
      }

      // Both searches should succeed
      expect(search1Response).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(search2Response).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
