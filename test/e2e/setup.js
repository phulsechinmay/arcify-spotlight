import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, '..', '..', 'dist');
const DEBUG = process.env.DEBUG === 'true';

/**
 * Launch Chrome browser with the extension loaded
 * Note: Extension must be built first (npm run build)
 *
 * @param {Object} options - Additional Puppeteer launch options
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
export async function launchBrowserWithExtension(options = {}) {
  const browser = await puppeteer.launch({
    headless: DEBUG ? false : 'new',
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
 * Get extension service worker for background script access
 * @param {Browser} browser - Puppeteer browser instance
 * @param {number} timeout - Timeout in ms (default 5000)
 * @returns {Promise<Worker>} Service worker instance
 */
export async function getServiceWorker(browser, timeout = 5000) {
  const workerTarget = await browser.waitForTarget(
    target =>
      target.type() === 'service_worker' &&
      target.url().endsWith('background.js'),
    { timeout }
  );
  return await workerTarget.worker();
}

/**
 * Wait for extension to be fully ready
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<{worker: Worker, extensionId: string}>}
 */
export async function waitForExtension(browser) {
  const worker = await getServiceWorker(browser);
  const extensionId = await worker.evaluate(() => chrome.runtime.id);
  return { worker, extensionId };
}

/**
 * Open extension's new tab page
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extensionId - Extension ID from waitForExtension
 * @returns {Promise<Page>} New tab page
 */
export async function openNewTabPage(browser, extensionId) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/newtab.html`, {
    waitUntil: 'domcontentloaded'
  });
  return page;
}
