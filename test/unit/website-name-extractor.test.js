import { describe, it, expect, vi } from 'vitest';

// Mock logger to prevent side effects (Logger auto-initializes with chrome.storage)
vi.mock('../../logger.js', () => ({
    Logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), initialize: vi.fn() }
}));

import { WebsiteNameExtractor, websiteNameExtractor } from '../../shared/website-name-extractor.js';

describe('WebsiteNameExtractor', () => {
    const extractor = new WebsiteNameExtractor();

    describe('normalizeHostname', () => {
        it.each([
            ['https://www.example.com/path', 'example.com', 'strips protocol, www, and path'],
            ['http://Example.COM', 'example.com', 'lowercases hostname'],
            ['example.com', 'example.com', 'passes through bare domain'],
            ['https://sub.example.com', 'sub.example.com', 'preserves subdomains other than www'],
            ['www.example.com', 'example.com', 'strips www without protocol'],
            ['https://example.com:8080/path?q=1', 'example.com', 'strips port, path, and query'],
            ['https://WWW.GitHub.COM/user/repo', 'github.com', 'strips www and lowercases together'],
            ['ftp://files.example.com', 'files.example.com', 'handles ftp protocol'],
        ])('normalizes %s to %s (%s)', (input, expected) => {
            expect(extractor.normalizeHostname(input)).toBe(expected);
        });

        it('returns fallback for input with spaces (invalid URL)', () => {
            const result = extractor.normalizeHostname('not a valid url at all');
            // Fallback regex captures everything before first /, ?, or #
            expect(result).toBe('not a valid url at all');
        });

        it('returns empty string for empty input', () => {
            const result = extractor.normalizeHostname('');
            // Empty string: URL('https://') throws, fallback regex returns empty
            expect(result).toBe('');
        });
    });

    describe('getCuratedName', () => {
        it('returns display name for known popular site', () => {
            expect(extractor.getCuratedName('github.com')).toBe('GitHub');
        });

        it('returns display name for google.com', () => {
            expect(extractor.getCuratedName('google.com')).toBe('Google');
        });

        it('returns null for unknown domain', () => {
            expect(extractor.getCuratedName('unknown-site.com')).toBeNull();
        });

        it('returns null for wrong case (POPULAR_SITES keys are lowercase)', () => {
            // getCuratedName does a direct lookup, no lowercasing
            expect(extractor.getCuratedName('GitHub.com')).toBeNull();
        });

        it('returns display name for subdomain-based popular site', () => {
            expect(extractor.getCuratedName('music.youtube.com')).toBe('YouTube Music');
        });
    });

    describe('parseHostnameToName', () => {
        it.each([
            ['example.com', 'Example', 'strips .com and capitalizes'],
            ['my-app.io', 'My-app', 'strips .io TLD'],
            ['sub.example.com', 'Example', 'multi-part: takes main part before TLD'],
            ['cdn.assets.example.com', 'Example', 'removes common subdomain prefix, extracts name'],
            ['example.org', 'Example', 'strips .org TLD'],
            ['example.co', 'Example', 'strips .co TLD'],
            ['localhost', 'Localhost', 'no TLD to strip, just capitalizes'],
            ['docs.example.com', 'Example', 'subdomain stripped, main part extracted'],
        ])('parses %s to %s (%s)', (input, expected) => {
            expect(extractor.parseHostnameToName(input)).toBe(expected);
        });

        it('returns null for null input', () => {
            expect(extractor.parseHostnameToName(null)).toBeNull();
        });

        it('returns null for undefined input', () => {
            expect(extractor.parseHostnameToName(undefined)).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(extractor.parseHostnameToName('')).toBeNull();
        });

        it('returns input via catch block for non-string truthy value', () => {
            // A truthy number passes !hostname guard but throws on .replace()
            // triggering the catch block which returns hostname as-is
            const result = extractor.parseHostnameToName(42);
            expect(result).toBe(42);
        });
    });

    describe('extractWebsiteName', () => {
        it('returns curated name for known popular site (Tier 1)', () => {
            expect(extractor.extractWebsiteName('https://github.com')).toBe('GitHub');
        });

        it('normalizes URL then returns curated name', () => {
            expect(extractor.extractWebsiteName('https://www.github.com/user/repo')).toBe('GitHub');
        });

        it('returns parsed hostname for unknown domain (Tier 2)', () => {
            expect(extractor.extractWebsiteName('https://my-random-site.com/page')).toBe('My-random-site');
        });

        it('handles subdomain URLs via hostname parsing', () => {
            expect(extractor.extractWebsiteName('https://docs.example.com')).toBe('Example');
        });

        it('handles input without protocol', () => {
            expect(extractor.extractWebsiteName('github.com')).toBe('GitHub');
        });

        it('returns fallback for completely invalid input', () => {
            // 'not-a-url' normalizes to hostname 'not-a-url', no curated match,
            // parseHostnameToName returns 'Not-a-url'
            const result = extractor.extractWebsiteName('not-a-url');
            expect(result).toBe('Not-a-url');
        });

        it('returns url when normalizeHostname returns empty (falsy hostname guard)', () => {
            const guardExtractor = new WebsiteNameExtractor();
            vi.spyOn(guardExtractor, 'normalizeHostname').mockReturnValue('');
            const result = guardExtractor.extractWebsiteName('some-url');
            expect(result).toBe('some-url');
            guardExtractor.normalizeHostname.mockRestore();
        });

        it('falls back via catch block when getCuratedName throws', () => {
            const errExtractor = new WebsiteNameExtractor();
            vi.spyOn(errExtractor, 'getCuratedName').mockImplementation(() => {
                throw new Error('test error');
            });
            // Catch block calls parseHostnameToName(normalizeHostname(url)) || url
            const result = errExtractor.extractWebsiteName('https://example.com');
            expect(result).toBe('Example');
            errExtractor.getCuratedName.mockRestore();
        });

        it('returns original url when catch block parseHostnameToName returns falsy', () => {
            const errExtractor = new WebsiteNameExtractor();
            vi.spyOn(errExtractor, 'getCuratedName').mockImplementation(() => {
                throw new Error('test error');
            });
            vi.spyOn(errExtractor, 'normalizeHostname').mockReturnValue('');
            // parseHostnameToName('') returns null, so || url returns original url
            const result = errExtractor.extractWebsiteName('original-url');
            expect(result).toBe('original-url');
            errExtractor.getCuratedName.mockRestore();
            errExtractor.normalizeHostname.mockRestore();
        });
    });

    describe('websiteNameExtractor singleton', () => {
        it('is an instance of WebsiteNameExtractor', () => {
            expect(websiteNameExtractor).toBeInstanceOf(WebsiteNameExtractor);
        });

        it('extracts website names correctly', () => {
            expect(websiteNameExtractor.extractWebsiteName('https://github.com')).toBe('GitHub');
        });

        it('shares the same class prototype as new instances', () => {
            expect(Object.getPrototypeOf(websiteNameExtractor)).toBe(WebsiteNameExtractor.prototype);
        });
    });
});
