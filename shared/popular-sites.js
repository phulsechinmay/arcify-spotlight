/**
 * Popular Sites - Curated mapping of popular website domains to display names
 *
 * Purpose: Provides clean display names for popular websites and enables fuzzy domain matching
 * Key Functions: Domain to name mapping, Fuse.js-based fuzzy search for partial domain completion
 * Architecture: Simple object export with organized categories, FuseSearchService for matching
 *
 * Critical Notes:
 * - Used by website name extractor for clean display names
 * - Enables fuzzy matching for partial typing (e.g., "squaresp" → "squarespace.com")
 * - Organized by categories for maintainability
 * - Includes both domain and common subdomain variations
 * - findMatchingDomains uses FuseSearchService with displayName:2/domainShort:1.5/domain:1 weighting
 */

import { FuseSearchService } from './fuse-search-service.js';

// Popular sites mapping organized by category
export const POPULAR_SITES = {
    // Search & Productivity
    "google.com": "Google",
    "bing.com": "Bing",
    "duckduckgo.com": "DuckDuckGo",
    "yahoo.com": "Yahoo",
    "chatgpt.com": "ChatGPT",
    "openai.com": "OpenAI",
    "anthropic.com": "Anthropic",
    "claude.ai": "Claude",
    "copilot.microsoft.com": "Copilot",
    "bard.google.com": "Bard",
    "perplexity.ai": "Perplexity",

    // Social Media
    "facebook.com": "Facebook",
    "meta.com": "Meta",
    "twitter.com": "Twitter",
    "x.com": "X",
    "linkedin.com": "LinkedIn",
    "instagram.com": "Instagram",
    "tiktok.com": "TikTok",
    "snapchat.com": "Snapchat",
    "pinterest.com": "Pinterest",
    "tumblr.com": "Tumblr",
    "reddit.com": "Reddit",
    "discord.com": "Discord",
    "telegram.org": "Telegram",
    "whatsapp.com": "WhatsApp",
    "signal.org": "Signal",

    // Tech & Development
    "github.com": "GitHub",
    "gitlab.com": "GitLab",
    "bitbucket.org": "Bitbucket",
    "stackoverflow.com": "Stack Overflow",
    "stackexchange.com": "Stack Exchange",
    "codepen.io": "CodePen",
    "jsfiddle.net": "JSFiddle",
    "codesandbox.io": "CodeSandbox",
    "replit.com": "Replit",
    "vercel.com": "Vercel",
    "netlify.com": "Netlify",
    "heroku.com": "Heroku",
    "aws.amazon.com": "AWS",
    "cloud.google.com": "Google Cloud",
    "azure.microsoft.com": "Azure",
    "digitalocean.com": "DigitalOcean",

    // Video & Entertainment
    "youtube.com": "YouTube",
    "netflix.com": "Netflix",
    "hulu.com": "Hulu",
    "disneyplus.com": "Disney+",
    "primevideo.com": "Prime Video",
    "hbomax.com": "HBO Max",
    "twitch.tv": "Twitch",
    "vimeo.com": "Vimeo",
    "dailymotion.com": "Dailymotion",
    "tiktok.com": "TikTok",
    "spotify.com": "Spotify",
    "apple.com/music": "Apple Music",
    "music.youtube.com": "YouTube Music",
    "soundcloud.com": "SoundCloud",
    "pandora.com": "Pandora",

    // Shopping & E-commerce
    "amazon.com": "Amazon",
    "ebay.com": "eBay",
    "etsy.com": "Etsy",
    "walmart.com": "Walmart",
    "target.com": "Target",
    "bestbuy.com": "Best Buy",
    "costco.com": "Costco",
    "alibaba.com": "Alibaba",
    "aliexpress.com": "AliExpress",
    "shopify.com": "Shopify",
    "squarespace.com": "Squarespace",
    "wix.com": "Wix",
    "wordpress.com": "WordPress",

    // News & Media
    "cnn.com": "CNN",
    "bbc.com": "BBC",
    "nytimes.com": "New York Times",
    "washingtonpost.com": "Washington Post",
    "theguardian.com": "The Guardian",
    "reuters.com": "Reuters",
    "ap.org": "Associated Press",
    "npr.org": "NPR",
    "foxnews.com": "Fox News",
    "msnbc.com": "MSNBC",
    "bloomberg.com": "Bloomberg",
    "wsj.com": "Wall Street Journal",
    "economist.com": "The Economist",
    "techcrunch.com": "TechCrunch",
    "theverge.com": "The Verge",
    "ars-technica.com": "Ars Technica",

    // Professional & Business
    "microsoft.com": "Microsoft",
    "apple.com": "Apple",
    "adobe.com": "Adobe",
    "salesforce.com": "Salesforce",
    "atlassian.com": "Atlassian",
    "slack.com": "Slack",
    "zoom.us": "Zoom",
    "teams.microsoft.com": "Microsoft Teams",
    "meet.google.com": "Google Meet",
    "notion.so": "Notion",
    "airtable.com": "Airtable",
    "trello.com": "Trello",
    "asana.com": "Asana",
    "monday.com": "Monday.com",
    "dropbox.com": "Dropbox",
    "box.com": "Box",
    "onedrive.live.com": "OneDrive",
    "drive.google.com": "Google Drive",

    // Design & Creative
    "figma.com": "Figma",
    "sketch.com": "Sketch",
    "canva.com": "Canva",
    "behance.net": "Behance",
    "dribbble.com": "Dribbble",
    "unsplash.com": "Unsplash",
    "pexels.com": "Pexels",
    "shutterstock.com": "Shutterstock",
    "gettyimages.com": "Getty Images",

    // Finance & Payments
    "paypal.com": "PayPal",
    "venmo.com": "Venmo",
    "stripe.com": "Stripe",
    "square.com": "Square",
    "coinbase.com": "Coinbase",
    "binance.com": "Binance",
    "robinhood.com": "Robinhood",
    "etrade.com": "E*TRADE",
    "fidelity.com": "Fidelity",
    "schwab.com": "Charles Schwab",

    // Travel & Transportation
    "expedia.com": "Expedia",
    "booking.com": "Booking.com",
    "airbnb.com": "Airbnb",
    "uber.com": "Uber",
    "lyft.com": "Lyft",
    "maps.google.com": "Google Maps",
    "waze.com": "Waze",
    "tripadvisor.com": "TripAdvisor",
    "kayak.com": "Kayak",
    "priceline.com": "Priceline",

    // Education & Learning
    "coursera.org": "Coursera",
    "udemy.com": "Udemy",
    "edx.org": "edX",
    "khanacademy.org": "Khan Academy",
    "duolingo.com": "Duolingo",
    "skillshare.com": "Skillshare",
    "masterclass.com": "MasterClass",
    "pluralsight.com": "Pluralsight",
    "linkedin.com/learning": "LinkedIn Learning",

    // Email & Communication
    "gmail.com": "Gmail",
    "outlook.com": "Outlook",
    "mail.yahoo.com": "Yahoo Mail",
    "protonmail.com": "ProtonMail",
    "tutanota.com": "Tutanota",

    // Reference & Information
    "wikipedia.org": "Wikipedia",
    "wikimedia.org": "Wikimedia",
    "archive.org": "Internet Archive",
    "dictionary.com": "Dictionary.com",
    "merriam-webster.com": "Merriam-Webster",
    "translate.google.com": "Google Translate",
    "deepl.com": "DeepL",

    // Gaming
    "steam.com": "Steam",
    "epicgames.com": "Epic Games",
    "battle.net": "Battle.net",
    "xbox.com": "Xbox",
    "playstation.com": "PlayStation",
    "nintendo.com": "Nintendo",
    "roblox.com": "Roblox",
    "minecraft.net": "Minecraft",

    // Health & Fitness
    "webmd.com": "WebMD",
    "mayoclinic.org": "Mayo Clinic",
    "healthline.com": "Healthline",
    "fitbit.com": "Fitbit",
    "myfitnesspal.com": "MyFitnessPal",
    "strava.com": "Strava"
};

// Get all domain keys for fuzzy matching
export const getAllDomains = () => Object.keys(POPULAR_SITES);

// Get display name for a domain
export const getDisplayName = (domain) => POPULAR_SITES[domain] || null;

// Pre-build searchable array for Fuse.js (built once at module load)
const _popularSitesList = Object.entries(POPULAR_SITES).map(([domain, displayName]) => ({
    domain,
    displayName,
    domainShort: domain.split('.')[0]
}));

// Fuzzy matching function for partial domain completion (Fuse.js-based)
export const findMatchingDomains = (partial, maxResults = 10) => {
    if (!partial) return [];

    const fuseResults = FuseSearchService.search(_popularSitesList, partial, {
        keys: [
            { name: 'displayName', weight: 2 },
            { name: 'domainShort', weight: 1.5 },
            { name: 'domain', weight: 1 }
        ],
        threshold: 0.3
    });

    return fuseResults.slice(0, maxResults).map(result => ({
        domain: result.item.domain,
        displayName: result.item.displayName,
        matchScore: result.matchScore
    }));
};