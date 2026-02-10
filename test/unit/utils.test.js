import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';
import { getFaviconUrl, getSettings, Utils } from '../../utils.js';

describe('getFaviconUrl', () => {
    it('returns a URL containing /_favicon/ path', () => {
        const result = getFaviconUrl('https://example.com');
        expect(result).toContain('/_favicon/');
    });

    it('includes pageUrl parameter with the provided URL', () => {
        const result = getFaviconUrl('https://example.com');
        expect(result).toContain('pageUrl=https');
        expect(result).toContain('example.com');
    });

    it('defaults to size=16 when no size argument provided', () => {
        const result = getFaviconUrl('https://example.com');
        expect(result).toContain('size=16');
    });

    it('uses custom size when provided', () => {
        const result = getFaviconUrl('https://example.com', '32');
        expect(result).toContain('size=32');
    });

    it('uses chrome.runtime.getURL to build the base URL', () => {
        getFaviconUrl('https://example.com');
        expect(chromeMock.runtime.getURL).toHaveBeenCalledWith('/_favicon/');
    });

    it('returns a fully qualified chrome-extension URL', () => {
        const result = getFaviconUrl('https://example.com');
        expect(result).toMatch(/^chrome-extension:\/\//);
    });
});

describe('getSettings', () => {
    it('returns settings object from chrome.storage.sync.get', async () => {
        chromeMock.storage.sync.get.mockResolvedValue({
            enableSpotlight: true,
            colorOverrides: null,
            debugLoggingEnabled: false,
        });

        const settings = await getSettings();
        expect(settings).toEqual({
            enableSpotlight: true,
            colorOverrides: null,
            debugLoggingEnabled: false,
        });
    });

    it('passes default settings to chrome.storage.sync.get', async () => {
        await getSettings();
        expect(chromeMock.storage.sync.get).toHaveBeenCalledWith({
            enableSpotlight: true,
            colorOverrides: null,
            debugLoggingEnabled: false,
        });
    });

    it('returns custom settings when storage has overrides', async () => {
        chromeMock.storage.sync.get.mockResolvedValue({
            enableSpotlight: false,
            colorOverrides: { bg: '#000' },
            debugLoggingEnabled: true,
        });

        const settings = await getSettings();
        expect(settings.enableSpotlight).toBe(false);
        expect(settings.colorOverrides).toEqual({ bg: '#000' });
        expect(settings.debugLoggingEnabled).toBe(true);
    });
});

describe('Utils export', () => {
    it('Utils.getFaviconUrl is the same function as getFaviconUrl', () => {
        expect(Utils.getFaviconUrl).toBe(getFaviconUrl);
    });

    it('Utils.getSettings is the same function as getSettings', () => {
        expect(Utils.getSettings).toBe(getSettings);
    });
});
