// test/integration/setup.js
// Integration test setup - uses REAL timers (per user decision)
// This is different from unit test setup which uses fake timers
import { beforeEach, afterEach, vi } from 'vitest';
import { chromeMock, resetChromeMocks } from '../mocks/chrome.js';

// IMPORTANT: Do NOT call vi.useFakeTimers() here
// Integration tests use real timers for realistic behavior

// Set global chrome mock
globalThis.chrome = chromeMock;

// Reset state between tests
beforeEach(() => {
  resetChromeMocks();
  vi.resetModules(); // Clear module cache for fresh imports
});

afterEach(() => {
  chromeMock.runtime.onMessage.clearListeners();
});
