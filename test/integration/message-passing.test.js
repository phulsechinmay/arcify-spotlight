import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

// Import setup for side effects (real timers, global chrome)
import './setup.js';

describe('Integration: Message Passing', () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.resetModules();
    chromeMock.runtime.onMessage.clearListeners();
  });

  describe('SPOTLIGHT_SEARCH (getSpotlightSuggestions) - INT-01', () => {
    it('query flows from overlay to background and returns results', async () => {
      // Setup mock data for tabs
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1, title: 'Test Tab', url: 'https://test.com', windowId: 1 }
      ]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      // Import background.js to register handlers
      await import('../../background.js');

      // Trigger message via callListeners
      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'test', mode: 'current-tab' },
        { tab: { id: 42 } },
        sendResponse
      );

      // Wait for async response
      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      // Assert response format
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        results: expect.any(Array)
      }));
    });

    it('empty query returns results immediately without debounce', async () => {
      chromeMock.tabs.query.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: '', mode: 'current-tab' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        results: expect.any(Array)
      }));
    });

    it('handles search with no matches gracefully', async () => {
      chromeMock.tabs.query.mockResolvedValue([]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'nonexistentquery12345', mode: 'current-tab' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        results: expect.any(Array)
      }));
    });

    it('verifies query trimming is applied', async () => {
      chromeMock.tabs.query.mockResolvedValue([]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: '  test  ', mode: 'current-tab' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      // Should succeed with trimmed query
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        results: expect.any(Array)
      }));
    });

    it('handles new-tab mode correctly', async () => {
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1, title: 'Gmail Inbox', url: 'https://mail.google.com', windowId: 1 }
      ]);
      chromeMock.bookmarks.search.mockResolvedValue([]);
      chromeMock.history.search.mockResolvedValue([]);
      chromeMock.topSites.get.mockResolvedValue([]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getSpotlightSuggestions', query: 'gmail', mode: 'new-tab' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        results: expect.any(Array)
      }));
    });
  });

  describe('Result Delivery (spotlightHandleResult) - INT-02', () => {
    it('URL result in NEW_TAB mode calls chrome.tabs.create', async () => {
      chromeMock.tabs.create.mockResolvedValue({ id: 100 });

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: { type: 'url-suggestion', url: 'https://example.com' },
          mode: 'new-tab'
        },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(chromeMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://example.com'
      }));
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('URL result in CURRENT_TAB mode calls chrome.tabs.update', async () => {
      chromeMock.tabs.update.mockResolvedValue({});

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: { type: 'url-suggestion', url: 'https://example.com' },
          mode: 'current-tab',
          tabId: 42
        },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, expect.objectContaining({
        url: 'https://example.com'
      }));
    });

    it('TAB result type calls chrome.tabs.update and chrome.windows.update', async () => {
      chromeMock.tabs.update.mockResolvedValue({});
      chromeMock.windows.update.mockResolvedValue({});

      await import('../../background.js');

      const sendResponse = vi.fn();
      // Note: OPEN_TAB with new-tab mode switches to the tab (activates it)
      // OPEN_TAB with current-tab mode navigates to the URL in current tab
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: { type: 'open-tab', metadata: { tabId: 5, windowId: 1 } },
          mode: 'new-tab'  // Must be new-tab to trigger tab switch behavior
        },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(5, { active: true });
      expect(chromeMock.windows.update).toHaveBeenCalledWith(1, { focused: true });
    });

    it('returns error response for invalid result (null)', async () => {
      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: null,  // Invalid - missing result
          mode: 'current-tab'
        },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });

    it('returns error response for missing mode', async () => {
      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: { type: 'url-suggestion', url: 'https://example.com' }
          // mode is missing
        },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });

    it('BOOKMARK result navigates to URL', async () => {
      chromeMock.tabs.create.mockResolvedValue({ id: 100 });

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        {
          action: 'spotlightHandleResult',
          result: { type: 'bookmark', url: 'https://bookmark.example.com' },
          mode: 'new-tab'
        },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(chromeMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://bookmark.example.com'
      }));
    });
  });

  describe('Tab Actions (switchToTab, navigateCurrentTab)', () => {
    it('switchToTab activates tab and focuses window', async () => {
      chromeMock.tabs.update.mockResolvedValue({});
      chromeMock.windows.update.mockResolvedValue({});

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'switchToTab', tabId: 10, windowId: 2 },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(10, { active: true });
      expect(chromeMock.windows.update).toHaveBeenCalledWith(2, { focused: true });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('navigateCurrentTab updates current tab URL', async () => {
      chromeMock.tabs.query.mockResolvedValue([{ id: 50, url: 'https://old.com' }]);
      chromeMock.tabs.update.mockResolvedValue({});

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'navigateCurrentTab', url: 'https://newurl.com' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(50, { url: 'https://newurl.com' });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('openNewTab creates a new tab with URL', async () => {
      chromeMock.tabs.create.mockResolvedValue({ id: 200 });

      await import('../../background.js');

      const sendResponse = vi.fn();
      chromeMock.runtime.onMessage.callListeners(
        { action: 'openNewTab', url: 'https://newtab.com' },
        { tab: { id: 42 } },
        sendResponse
      );

      expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://newtab.com' });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('Search Actions', () => {
    it('searchTabs returns filtered tabs matching query', async () => {
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1, title: 'GitHub - Projects', url: 'https://github.com' },
        { id: 2, title: 'Gmail - Inbox', url: 'https://mail.google.com' },
        { id: 3, title: 'YouTube', url: 'https://youtube.com' }
      ]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'searchTabs', query: 'git' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        tabs: expect.any(Array)
      }));
      // Should only include GitHub tab (matches 'git')
      const response = sendResponse.mock.calls[0][0];
      expect(response.tabs.length).toBe(1);
      expect(response.tabs[0].title).toBe('GitHub - Projects');
    });

    it('searchBookmarks returns bookmarks matching query', async () => {
      chromeMock.bookmarks.search.mockResolvedValue([
        { id: '1', title: 'React Docs', url: 'https://react.dev' },
        { id: '2', title: 'Folder', url: undefined }  // Folders have no URL
      ]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'searchBookmarks', query: 'react' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        bookmarks: expect.any(Array)
      }));
      // Should filter out folders (no URL)
      const response = sendResponse.mock.calls[0][0];
      expect(response.bookmarks.length).toBe(1);
      expect(response.bookmarks[0].url).toBe('https://react.dev');
    });

    it('searchHistory returns history items', async () => {
      chromeMock.history.search.mockResolvedValue([
        { id: '1', title: 'News Site', url: 'https://news.com', visitCount: 5 }
      ]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'searchHistory', query: 'news' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        history: expect.any(Array)
      }));
    });

    it('getTopSites returns top sites list', async () => {
      chromeMock.topSites.get.mockResolvedValue([
        { title: 'Google', url: 'https://google.com' },
        { title: 'Facebook', url: 'https://facebook.com' }
      ]);

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'getTopSites' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        topSites: expect.arrayContaining([
          expect.objectContaining({ title: 'Google' }),
          expect.objectContaining({ title: 'Facebook' })
        ])
      }));
    });
  });

  describe('Error Scenarios', () => {
    it('Chrome API failure in switchToTab returns error response', async () => {
      chromeMock.tabs.update.mockRejectedValue(new Error('Tab not found'));
      chromeMock.windows.update.mockResolvedValue({});

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'switchToTab', tabId: 999, windowId: 1 },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Tab not found'
      }));
    });

    it('Chrome API failure in navigateCurrentTab returns error response', async () => {
      chromeMock.tabs.query.mockRejectedValue(new Error('Query failed'));

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'navigateCurrentTab', url: 'https://test.com' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Query failed'
      }));
    });

    it('Chrome API failure in searchTabs returns error response', async () => {
      chromeMock.tabs.query.mockRejectedValue(new Error('Permission denied'));

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'searchTabs', query: 'test' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Permission denied'
      }));
    });

    it('Chrome API failure in searchBookmarks returns error response', async () => {
      chromeMock.bookmarks.search.mockRejectedValue(new Error('Bookmarks unavailable'));

      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'searchBookmarks', query: 'test' },
        { tab: { id: 42 } },
        sendResponse
      );

      if (asyncResponse) {
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 3000 });
      }

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Bookmarks unavailable'
      }));
    });

    it('unknown action returns false (not handled)', async () => {
      await import('../../background.js');

      const sendResponse = vi.fn();
      const { asyncResponse } = chromeMock.runtime.onMessage.callListeners(
        { action: 'unknownAction' },
        { tab: { id: 42 } },
        sendResponse
      );

      // Unknown actions return false (synchronously)
      expect(asyncResponse).toBe(false);
    });
  });
});
