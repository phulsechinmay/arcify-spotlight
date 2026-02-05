import { chromeMock, resetChromeMocks } from './mocks/chrome.js';
import { beforeEach } from 'vitest';

// Set global chrome mock
globalThis.chrome = chromeMock;

// Reset mocks before each test
beforeEach(() => {
  resetChromeMocks();
});
