import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, '..', 'dist');

/**
 * Launch Chrome browser with the extension loaded
 * Note: Extension must be built first (npm run build)
 *
 * @param {Object} options - Additional Puppeteer launch options
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
export async function launchBrowserWithExtension(options = {}) {
  const browser = await puppeteer.launch({
    headless: false, // Required for Chrome extensions
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check'
    ],
    ...options
  });

  return browser;
}

/**
 * Clean up browser instance
 * @param {Browser} browser - Puppeteer browser instance to close
 */
export async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

/**
 * Wait for extension to be ready by checking for service worker
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<void>}
 */
export async function waitForExtension(browser) {
  // Give the extension a moment to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
}
