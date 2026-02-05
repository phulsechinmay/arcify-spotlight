import { vi } from 'vitest';

/**
 * Chrome API mock scaffolding for unit tests
 * Each method is a vi.fn() that returns a resolved Promise with empty/default data
 */

// Private listener storage for runtime.onMessage
let runtimeMessageListeners = [];

export const chromeMock = {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    get: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },

  commands: {
    onCommand: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
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
      addListener: vi.fn((callback) => {
        runtimeMessageListeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const idx = runtimeMessageListeners.indexOf(callback);
        if (idx > -1) runtimeMessageListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((callback) => runtimeMessageListeners.includes(callback)),
      hasListeners: vi.fn(() => runtimeMessageListeners.length > 0),
      callListeners: (message, sender = {}, sendResponse = vi.fn()) => {
        let asyncResponse = false;
        for (const listener of runtimeMessageListeners) {
          const result = listener(message, sender, sendResponse);
          if (result === true) asyncResponse = true;
        }
        return { asyncResponse, sendResponse };
      },
      clearListeners: () => {
        runtimeMessageListeners = [];
      }
    },
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`)
  },

  tabGroups: {
    get: vi.fn().mockResolvedValue({ color: 'grey', title: '' }),
    TAB_GROUP_ID_NONE: -1
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
  chromeMock.tabs.sendMessage.mockClear().mockResolvedValue(undefined);
  chromeMock.tabs.onActivated.addListener.mockClear();
  chromeMock.tabs.onActivated.removeListener.mockClear();
  chromeMock.tabs.onRemoved.addListener.mockClear();
  chromeMock.tabs.onRemoved.removeListener.mockClear();

  chromeMock.commands.onCommand.addListener.mockClear();
  chromeMock.commands.onCommand.removeListener.mockClear();

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
  chromeMock.runtime.onMessage.hasListener.mockClear();
  chromeMock.runtime.onMessage.hasListeners.mockClear();
  runtimeMessageListeners = [];

  chromeMock.tabGroups.get.mockClear().mockResolvedValue({ color: 'grey', title: '' });

  chromeMock.windows.update.mockClear().mockResolvedValue({});
  chromeMock.windows.getCurrent.mockClear().mockResolvedValue({ id: 1 });

  chromeMock.search.query.mockClear().mockResolvedValue(undefined);
  chromeMock.topSites.get.mockClear().mockResolvedValue([]);
}
