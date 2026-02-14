// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted vi.mock calls
vi.mock('../../shared/ui-utilities.js', () => ({
    SpotlightUtils: {
        areResultsDuplicate: vi.fn().mockReturnValue(false),
        formatResult: vi.fn().mockReturnValue({ title: 'Test Title', subtitle: 'https://test.com', action: 'Switch to tab' }),
        generateSpaceChipHTML: vi.fn().mockReturnValue(''),
        escapeHtml: vi.fn((text) => text),
        getFaviconUrl: vi.fn().mockReturnValue('chrome://favicon/https://test.com'),
        setupFaviconErrorHandling: vi.fn(),
        formatDebugInfo: vi.fn().mockReturnValue(''),
        isURL: vi.fn().mockReturnValue(false)
    }
}));

import { SharedSpotlightLogic } from '../../shared/shared-component-logic.js';
import { SpotlightUtils } from '../../shared/ui-utilities.js';

describe('SharedSpotlightLogic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Restore default mock return values
        SpotlightUtils.areResultsDuplicate.mockReturnValue(false);
        SpotlightUtils.formatResult.mockReturnValue({ title: 'Test Title', subtitle: 'https://test.com', action: 'Switch to tab' });
        SpotlightUtils.generateSpaceChipHTML.mockReturnValue('');
        SpotlightUtils.escapeHtml.mockImplementation((text) => text);
        SpotlightUtils.getFaviconUrl.mockReturnValue('chrome://favicon/https://test.com');
        SpotlightUtils.formatDebugInfo.mockReturnValue('');
    });

    // ── combineResults ──────────────────────────────────────────────────
    describe('combineResults', () => {
        it('returns empty array when both instant and async are empty/null', () => {
            expect(SharedSpotlightLogic.combineResults(null, [])).toEqual([]);
        });

        it('returns only instant suggestion when async is empty', () => {
            const instant = { title: 'Instant', url: 'https://instant.com' };
            const result = SharedSpotlightLogic.combineResults(instant, []);
            expect(result).toEqual([instant]);
        });

        it('returns only async suggestions when instant is null', () => {
            const asyncResults = [
                { title: 'Async 1', url: 'https://async1.com' },
                { title: 'Async 2', url: 'https://async2.com' }
            ];
            const result = SharedSpotlightLogic.combineResults(null, asyncResults);
            expect(result).toEqual(asyncResults);
        });

        it('combines instant + async suggestions in correct order (instant first)', () => {
            const instant = { title: 'Instant', url: 'https://instant.com' };
            const asyncResults = [
                { title: 'Async 1', url: 'https://async1.com' },
                { title: 'Async 2', url: 'https://async2.com' }
            ];
            const result = SharedSpotlightLogic.combineResults(instant, asyncResults);
            expect(result).toEqual([instant, ...asyncResults]);
            expect(result[0]).toBe(instant);
        });

        it('filters out async results that duplicate the instant suggestion', () => {
            const instant = { title: 'Instant', url: 'https://test.com' };
            const asyncResults = [
                { title: 'Dup', url: 'https://test.com' },
                { title: 'Unique', url: 'https://unique.com' }
            ];
            SpotlightUtils.areResultsDuplicate
                .mockReturnValueOnce(true)   // first async matches instant
                .mockReturnValueOnce(false); // second does not
            const result = SharedSpotlightLogic.combineResults(instant, asyncResults);
            expect(result).toEqual([instant, asyncResults[1]]);
        });

        it('passes through all async results when none duplicate instant', () => {
            const instant = { title: 'Instant', url: 'https://instant.com' };
            const asyncResults = [
                { title: 'A1', url: 'https://a1.com' },
                { title: 'A2', url: 'https://a2.com' }
            ];
            SpotlightUtils.areResultsDuplicate.mockReturnValue(false);
            const result = SharedSpotlightLogic.combineResults(instant, asyncResults);
            expect(result).toHaveLength(3);
        });

        it('calls areResultsDuplicate for each async result against instant suggestion', () => {
            const instant = { title: 'Instant', url: 'https://instant.com' };
            const asyncResults = [
                { title: 'A1', url: 'https://a1.com' },
                { title: 'A2', url: 'https://a2.com' },
                { title: 'A3', url: 'https://a3.com' }
            ];
            SharedSpotlightLogic.combineResults(instant, asyncResults);
            expect(SpotlightUtils.areResultsDuplicate).toHaveBeenCalledTimes(3);
            expect(SpotlightUtils.areResultsDuplicate).toHaveBeenCalledWith(instant, asyncResults[0]);
            expect(SpotlightUtils.areResultsDuplicate).toHaveBeenCalledWith(instant, asyncResults[1]);
            expect(SpotlightUtils.areResultsDuplicate).toHaveBeenCalledWith(instant, asyncResults[2]);
        });

        it('does not call areResultsDuplicate when instant suggestion is null', () => {
            const asyncResults = [
                { title: 'A1', url: 'https://a1.com' }
            ];
            SharedSpotlightLogic.combineResults(null, asyncResults);
            expect(SpotlightUtils.areResultsDuplicate).not.toHaveBeenCalled();
        });
    });

    // ── generateResultsHTML ─────────────────────────────────────────────
    describe('generateResultsHTML', () => {
        it('returns empty-state HTML for null results', () => {
            const html = SharedSpotlightLogic.generateResultsHTML(null, 'new-tab');
            expect(html).toContain('arcify-spotlight-empty');
            expect(html).toContain('Start typing');
        });

        it('returns empty-state HTML for empty results array', () => {
            const html = SharedSpotlightLogic.generateResultsHTML([], 'new-tab');
            expect(html).toContain('arcify-spotlight-empty');
        });

        it('returns empty-state HTML for undefined results', () => {
            const html = SharedSpotlightLogic.generateResultsHTML(undefined, 'new-tab');
            expect(html).toContain('arcify-spotlight-empty');
        });

        it('generates button elements for each result with correct data-index', () => {
            const results = [
                { title: 'R1', url: 'https://r1.com' },
                { title: 'R2', url: 'https://r2.com' }
            ];
            const html = SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            expect(html).toContain('data-index="0"');
            expect(html).toContain('data-index="1"');
            expect(html).toContain('arcify-spotlight-result-item');
        });

        it('adds selected class only to first result (index 0)', () => {
            const results = [
                { title: 'R1', url: 'https://r1.com' },
                { title: 'R2', url: 'https://r2.com' }
            ];
            const html = SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            // Parse HTML to check selected state
            const container = document.createElement('div');
            container.innerHTML = html;
            const buttons = container.querySelectorAll('button');
            expect(buttons[0].classList.contains('selected')).toBe(true);
            expect(buttons[1].classList.contains('selected')).toBe(false);
        });

        it('calls SpotlightUtils.formatResult for each result with mode and activeGroupName', () => {
            const results = [
                { title: 'R1', url: 'https://r1.com' },
                { title: 'R2', url: 'https://r2.com' }
            ];
            SharedSpotlightLogic.generateResultsHTML(results, 'new-tab', 'MyGroup');
            expect(SpotlightUtils.formatResult).toHaveBeenCalledTimes(2);
            expect(SpotlightUtils.formatResult).toHaveBeenCalledWith(results[0], 'new-tab', 'MyGroup');
            expect(SpotlightUtils.formatResult).toHaveBeenCalledWith(results[1], 'new-tab', 'MyGroup');
        });

        it('calls SpotlightUtils.getFaviconUrl for each result', () => {
            const results = [
                { title: 'R1', url: 'https://r1.com' },
                { title: 'R2', url: 'https://r2.com' }
            ];
            SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            expect(SpotlightUtils.getFaviconUrl).toHaveBeenCalledTimes(2);
            expect(SpotlightUtils.getFaviconUrl).toHaveBeenCalledWith(results[0]);
            expect(SpotlightUtils.getFaviconUrl).toHaveBeenCalledWith(results[1]);
        });

        it('calls SpotlightUtils.escapeHtml for title, subtitle, and action', () => {
            const results = [{ title: 'R1', url: 'https://r1.com' }];
            SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            // escapeHtml is called for title, subtitle, and action
            const calls = SpotlightUtils.escapeHtml.mock.calls.map(c => c[0]);
            expect(calls).toContain('Test Title');
            expect(calls).toContain('https://test.com');
            expect(calls).toContain('Switch to tab');
        });

        it('includes space chip HTML when generateSpaceChipHTML returns non-empty string', () => {
            SpotlightUtils.generateSpaceChipHTML.mockReturnValue('<span class="arcify-space-chip">Work</span>');
            const results = [{ title: 'R1', url: 'https://r1.com' }];
            const html = SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            expect(html).toContain('arcify-space-chip');
            expect(html).toContain('Work');
        });

        it('wraps URL text in span with class arcify-spotlight-result-url-text when chip exists', () => {
            SpotlightUtils.generateSpaceChipHTML.mockReturnValue('<span class="arcify-space-chip">Work</span>');
            const results = [{ title: 'R1', url: 'https://r1.com' }];
            const html = SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            expect(html).toContain('arcify-spotlight-result-url-text');
        });

        it('omits URL section when subtitle is empty', () => {
            SpotlightUtils.formatResult.mockReturnValue({ title: 'Test', subtitle: '', action: 'Go' });
            const results = [{ title: 'R1', url: '' }];
            const html = SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            // urlContent should be empty string, so the url div should be empty
            const container = document.createElement('div');
            container.innerHTML = html;
            const urlDiv = container.querySelector('.arcify-spotlight-result-url');
            expect(urlDiv.innerHTML).toBe('');
        });

        it('includes data-testid="spotlight-result" on each button', () => {
            const results = [
                { title: 'R1', url: 'https://r1.com' },
                { title: 'R2', url: 'https://r2.com' }
            ];
            const html = SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            const container = document.createElement('div');
            container.innerHTML = html;
            const buttons = container.querySelectorAll('[data-testid="spotlight-result"]');
            expect(buttons).toHaveLength(2);
        });

        it('calls SpotlightUtils.formatDebugInfo for each result', () => {
            const results = [
                { title: 'R1', url: 'https://r1.com' },
                { title: 'R2', url: 'https://r2.com' }
            ];
            SharedSpotlightLogic.generateResultsHTML(results, 'new-tab');
            expect(SpotlightUtils.formatDebugInfo).toHaveBeenCalledTimes(2);
            expect(SpotlightUtils.formatDebugInfo).toHaveBeenCalledWith(results[0]);
            expect(SpotlightUtils.formatDebugInfo).toHaveBeenCalledWith(results[1]);
        });
    });

    // ── updateResultsDisplay ────────────────────────────────────────────
    describe('updateResultsDisplay', () => {
        it('sets innerHTML on resultsContainer to generated HTML', () => {
            const container = document.createElement('div');
            const results = [{ title: 'R1', url: 'https://r1.com' }];
            SharedSpotlightLogic.updateResultsDisplay(container, [], results, 'new-tab');
            expect(container.innerHTML).toContain('arcify-spotlight-result-item');
        });

        it('calls SpotlightUtils.setupFaviconErrorHandling with the container', () => {
            const container = document.createElement('div');
            SharedSpotlightLogic.updateResultsDisplay(container, [], [{ title: 'R1', url: 'https://r1.com' }], 'new-tab');
            expect(SpotlightUtils.setupFaviconErrorHandling).toHaveBeenCalledWith(container);
        });

        it('works with real DOM elements (verify innerHTML is set)', () => {
            const container = document.createElement('div');
            const results = [{ title: 'Test', url: 'https://test.com' }];
            SharedSpotlightLogic.updateResultsDisplay(container, [], results, 'new-tab');
            expect(container.innerHTML).not.toBe('');
            expect(container.querySelector('.arcify-spotlight-result-item')).not.toBeNull();
        });

        it('handles empty results array (container gets empty-state HTML)', () => {
            const container = document.createElement('div');
            SharedSpotlightLogic.updateResultsDisplay(container, [], [], 'new-tab');
            expect(container.innerHTML).toContain('arcify-spotlight-empty');
        });
    });
});
