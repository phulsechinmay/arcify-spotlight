/**
 * Scoring Constants - Centralized scoring system for all spotlight results
 *
 * Purpose: Defines the base scoring hierarchy for all result types in the spotlight system
 * Key Functions: Provides consistent scoring across all data providers and result types
 * Architecture: Simple constants export with clear hierarchy documentation
 *
 * Critical Notes:
 * - Higher scores appear first in search results
 * - Instant suggestions always get the highest priority (1000)
 * - User content (bookmarks, history) prioritized over external suggestions
 * - Fuzzy matches positioned strategically between history and top sites
 * - Weighted multi-signal formula combines type, match quality, recency, and frequency
 */

import { ResultType } from './search-types.js';

// Base scores for each result type (higher = appears first)
export const BASE_SCORES = {
    // Instant suggestions (always first)
    INSTANT_SEARCH_QUERY: 1000,
    INSTANT_URL_SUGGESTION: 1000,

    // Regular search results hierarchy
    SEARCH_QUERY: 100,
    URL_SUGGESTION: 95,
    OPEN_TAB: 90,
    PINNED_TAB: 85,  // Pinned tabs ranked between open tabs and bookmarks
    BOOKMARK: 80,
    HISTORY: 70,
    TOP_SITE: 60,

    // Top site Fuzzy match scores (positioned above autocomplete, between history and top sites)
    FUZZY_MATCH_START: 65,      // Exact start matches (e.g., "squaresp" → "squarespace.com")
    FUZZY_MATCH_CONTAINS: 63,   // Contains matches (e.g., "space" → "squarespace.com")
    FUZZY_MATCH_NAME: 62,       // Display name matches (e.g., "square" → "Squarespace")
    FUZZY_MATCH_DEFAULT: 60,    // Default fuzzy match score


    AUTOCOMPLETE_SUGGESTION: 30    // Moved below fuzzy matches
};

// Score bonuses for relevance matching
export const SCORE_BONUSES = {
    EXACT_TITLE_MATCH: 20,      // Title exactly matches query
    TITLE_STARTS_WITH: 15,      // Title starts with query
    TITLE_CONTAINS: 10,         // Title contains query
    URL_CONTAINS: 5             // URL contains query
};

// Autocomplete score calculation (decreasing by position)
export const getAutocompleteScore = (index) => {
    return BASE_SCORES.AUTOCOMPLETE_SUGGESTION - index;
};

// Fuzzy match score calculation with domain length penalty
export const getFuzzyMatchScore = (matchType, domainLength = 0, queryLength = 0) => {
    let score = BASE_SCORES.FUZZY_MATCH_DEFAULT;

    switch (matchType) {
        case 'start':
            // Prefer shorter domains for start matches
            score = BASE_SCORES.FUZZY_MATCH_START - (domainLength - queryLength) * 0.1;
            break;
        case 'contains':
            score = BASE_SCORES.FUZZY_MATCH_CONTAINS;
            break;
        case 'name':
            score = BASE_SCORES.FUZZY_MATCH_NAME;
            break;
        default:
            score = BASE_SCORES.FUZZY_MATCH_DEFAULT;
    }

    return Math.max(score, BASE_SCORES.FUZZY_MATCH_NAME); // Ensure minimum score
};

// --- Weighted Multi-Signal Scoring (Phase 10) ---

// Weights for the multi-signal scoring formula (sum = 1.0)
// TYPE is dominant to preserve source hierarchy (SCORE-02)
// MATCH is second to differentiate within a type tier
// RECENCY and FREQUENCY apply only to history items
export const SCORING_WEIGHTS = {
    TYPE:      0.40,
    MATCH:     0.35,
    RECENCY:   0.15,
    FREQUENCY: 0.10,
};

// Normalized 0-1 type scores derived from BASE_SCORES (divided by max regular base = 90)
export const TYPE_SCORE_MAP = {
    [ResultType.OPEN_TAB]:    1.0,     // 90/90
    [ResultType.PINNED_TAB]:  0.944,   // 85/90
    [ResultType.BOOKMARK]:    0.889,   // 80/90
    [ResultType.HISTORY]:     0.778,   // 70/90
    [ResultType.TOP_SITE]:    0.667,   // 60/90
};

// Scale factor to convert 0-1 weighted score to existing score range (backward compat)
export const SCORE_SCALE = 115;

// Recency scoring: exponential decay with configurable half-life
export const RECENCY_HALF_LIFE_HOURS = 24;

export function calculateRecencyScore(lastVisitTime) {
    if (!lastVisitTime) return 0;
    const ageHours = (Date.now() - lastVisitTime) / (1000 * 60 * 60);
    if (ageHours < 0) return 1; // Clock skew protection
    return Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
}

// Frequency scoring: logarithmic scaling with cap at 100 visits
export const FREQUENCY_LOG_CAP = Math.log1p(100);

export function calculateFrequencyScore(visitCount) {
    if (!visitCount || visitCount <= 0) return 0;
    return Math.min(1, Math.log1p(visitCount) / FREQUENCY_LOG_CAP);
}

// Autocomplete boost constants
// AUTOCOMPLETE_BOOST_MAX: max points added when local results are sparse
// LOCAL_RESULT_THRESHOLD: boost kicks in below this many non-autocomplete results
export const AUTOCOMPLETE_BOOST_MAX = 40;
export const LOCAL_RESULT_THRESHOLD = 3;