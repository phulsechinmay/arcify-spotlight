import { vi } from 'vitest';

/**
 * Chrome API mock scaffolding for unit tests
 * Each method is a vi.fn() that returns a resolved Promise with empty/default data
 */

export const chromeMock = {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    get: vi.fn().mockResolvedValue({})
  },

  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },

  bookmarks: {
    search: vi.fn().mockResolvedValue([])
  },

  history: {
    search: vi.fn().mockResolvedValue([])
  },

  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`)
  },

  tabGroups: {
    get: vi.fn().mockResolvedValue({ color: 'grey', title: '' })
  },

  windows: {
    update: vi.fn().mockResolvedValue({}),
    getCurrent: vi.fn().mockResolvedValue({ id: 1 })
  },

  search: {
    query: vi.fn().mockResolvedValue(undefined)
  },

  topSites: {
    get: vi.fn().mockResolvedValue([])
  }
};

/**
 * Reset all Chrome API mocks to their initial state
 */
export function resetChromeMocks() {
  chromeMock.tabs.query.mockClear().mockResolvedValue([]);
  chromeMock.tabs.update.mockClear().mockResolvedValue({});
  chromeMock.tabs.create.mockClear().mockResolvedValue({ id: 1 });
  chromeMock.tabs.get.mockClear().mockResolvedValue({});

  chromeMock.storage.local.get.mockClear().mockResolvedValue({});
  chromeMock.storage.local.set.mockClear().mockResolvedValue(undefined);
  chromeMock.storage.sync.get.mockClear().mockResolvedValue({});
  chromeMock.storage.sync.set.mockClear().mockResolvedValue(undefined);
  chromeMock.storage.onChanged.addListener.mockClear();
  chromeMock.storage.onChanged.removeListener.mockClear();

  chromeMock.bookmarks.search.mockClear().mockResolvedValue([]);

  chromeMock.history.search.mockClear().mockResolvedValue([]);

  chromeMock.runtime.sendMessage.mockClear().mockResolvedValue(undefined);
  chromeMock.runtime.onMessage.addListener.mockClear();
  chromeMock.runtime.onMessage.removeListener.mockClear();

  chromeMock.tabGroups.get.mockClear().mockResolvedValue({ color: 'grey', title: '' });

  chromeMock.windows.update.mockClear().mockResolvedValue({});
  chromeMock.windows.getCurrent.mockClear().mockResolvedValue({ id: 1 });

  chromeMock.search.query.mockClear().mockResolvedValue(undefined);
  chromeMock.topSites.get.mockClear().mockResolvedValue([]);
}
