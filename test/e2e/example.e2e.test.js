import { describe, it } from 'node:test';
import assert from 'node:assert';
import { launchBrowserWithExtension, closeBrowser, waitForExtension } from './setup.js';

describe('E2E Setup', () => {
  it('launches browser with extension and loads a page', async () => {
    let browser;

    try {
      browser = await launchBrowserWithExtension();
      await waitForExtension(browser);

      const page = await browser.newPage();
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

      const title = await page.title();
      assert.ok(title, 'Page should have a title');
      assert.ok(title.length > 0, 'Page title should not be empty');

    } finally {
      await closeBrowser(browser);
    }
  });
});
