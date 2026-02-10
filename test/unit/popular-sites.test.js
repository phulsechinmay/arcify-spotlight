import { describe, it, expect } from 'vitest';
import { POPULAR_SITES, getAllDomains, getDisplayName, findMatchingDomains } from '../../shared/popular-sites.js';

describe('POPULAR_SITES', () => {
    it('is a non-empty object', () => {
        expect(typeof POPULAR_SITES).toBe('object');
        expect(POPULAR_SITES).not.toBeNull();
        expect(Object.keys(POPULAR_SITES).length).toBeGreaterThan(0);
    });

    it('all values are non-empty strings (display names)', () => {
        for (const [domain, displayName] of Object.entries(POPULAR_SITES)) {
            expect(typeof displayName).toBe('string');
            expect(displayName.length).toBeGreaterThan(0);
        }
    });

    it('all keys contain at least one dot (domain format)', () => {
        for (const domain of Object.keys(POPULAR_SITES)) {
            // Some entries like "apple.com/music" or "linkedin.com/learning" have paths
            // but all should have at least one dot in the domain portion
            expect(domain).toMatch(/\./);
        }
    });

    it('contains known popular site entries', () => {
        expect(POPULAR_SITES['github.com']).toBe('GitHub');
        expect(POPULAR_SITES['google.com']).toBe('Google');
        expect(POPULAR_SITES['youtube.com']).toBe('YouTube');
        expect(POPULAR_SITES['reddit.com']).toBe('Reddit');
    });
});

describe('getAllDomains', () => {
    it('returns an array', () => {
        expect(Array.isArray(getAllDomains())).toBe(true);
    });

    it('array length matches POPULAR_SITES key count', () => {
        expect(getAllDomains().length).toBe(Object.keys(POPULAR_SITES).length);
    });

    it('contains known domains', () => {
        const domains = getAllDomains();
        expect(domains).toContain('github.com');
        expect(domains).toContain('google.com');
        expect(domains).toContain('youtube.com');
    });

    it('every element is a string', () => {
        for (const domain of getAllDomains()) {
            expect(typeof domain).toBe('string');
        }
    });
});

describe('getDisplayName', () => {
    it('returns display name for known domain', () => {
        expect(getDisplayName('github.com')).toBe('GitHub');
    });

    it('returns display name for another known domain', () => {
        expect(getDisplayName('netflix.com')).toBe('Netflix');
    });

    it('returns null for unknown domain', () => {
        expect(getDisplayName('totally-unknown-domain.xyz')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(getDisplayName('')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(getDisplayName(undefined)).toBeNull();
    });
});

describe('findMatchingDomains - edge cases', () => {
    // Note: Core findMatchingDomains tests live in fuzzy-matching.test.js.
    // These test only untested edge cases to complement existing coverage.

    it('returns empty array for null input', () => {
        expect(findMatchingDomains(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
        expect(findMatchingDomains(undefined)).toEqual([]);
    });

    it('returns empty array for zero-length string', () => {
        expect(findMatchingDomains('')).toEqual([]);
    });
});
