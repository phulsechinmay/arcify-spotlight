import { describe, it, expect } from 'vitest';
import { SpotlightUtils } from '../../shared/ui-utilities.js';

describe('SpotlightUtils.isURL', () => {
    describe('valid URLs', () => {
        it.each([
            ['https://example.com', 'complete URL with https'],
            ['http://example.com', 'complete URL with http'],
            ['example.com', 'domain without protocol'],
            ['sub.example.com', 'subdomain'],
            ['example.co.uk', 'multi-part TLD'],
            ['localhost', 'localhost'],
            ['localhost:3000', 'localhost with port'],
            ['192.168.1.1', 'valid IP address'],
            ['192.168.1.1:8080', 'IP with port'],
            ['github.io', 'short domain with valid TLD'],
        ])('returns true for %s (%s)', (input) => {
            expect(SpotlightUtils.isURL(input)).toBe(true);
        });
    });

    describe('invalid URLs (search queries)', () => {
        it.each([
            ['hello world', 'space-separated words'],
            ['github', 'single word without TLD'],
            ['how to code', 'multi-word query'],
            ['what is github.com', 'query containing domain (has spaces)'],
            ['999.999.999.999', 'invalid IP (octets > 255)'],
            ['javascript tutorial', 'common search query'],
        ])('returns false for %s (%s)', (input) => {
            expect(SpotlightUtils.isURL(input)).toBe(false);
        });
    });
});

describe('SpotlightUtils.normalizeURL', () => {
    it.each([
        ['example.com', 'https://example.com', 'adds https to URL without protocol'],
        ['https://example.com', 'https://example.com', 'keeps existing https protocol'],
        ['http://example.com', 'http://example.com', 'keeps existing http protocol'],
        ['chrome://settings', 'chrome://settings', 'keeps chrome protocol'],
        ['file:///path', 'file:///path', 'keeps file protocol'],
    ])('normalizes %s to %s (%s)', (input, expected) => {
        expect(SpotlightUtils.normalizeURL(input)).toBe(expected);
    });
});
