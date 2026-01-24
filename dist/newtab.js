const m={URL_SUGGESTION:"url-suggestion",SEARCH_QUERY:"search-query",AUTOCOMPLETE_SUGGESTION:"autocomplete-suggestion",OPEN_TAB:"open-tab",PINNED_TAB:"pinned-tab",BOOKMARK:"bookmark",HISTORY:"history",TOP_SITE:"top-site"},G={NEW_TAB:"new-tab"},B={"google.com":"Google","bing.com":"Bing","duckduckgo.com":"DuckDuckGo","yahoo.com":"Yahoo","chatgpt.com":"ChatGPT","openai.com":"OpenAI","anthropic.com":"Anthropic","claude.ai":"Claude","copilot.microsoft.com":"Copilot","bard.google.com":"Bard","perplexity.ai":"Perplexity","facebook.com":"Facebook","meta.com":"Meta","twitter.com":"Twitter","x.com":"X","linkedin.com":"LinkedIn","instagram.com":"Instagram","tiktok.com":"TikTok","snapchat.com":"Snapchat","pinterest.com":"Pinterest","tumblr.com":"Tumblr","reddit.com":"Reddit","discord.com":"Discord","telegram.org":"Telegram","whatsapp.com":"WhatsApp","signal.org":"Signal","github.com":"GitHub","gitlab.com":"GitLab","bitbucket.org":"Bitbucket","stackoverflow.com":"Stack Overflow","stackexchange.com":"Stack Exchange","codepen.io":"CodePen","jsfiddle.net":"JSFiddle","codesandbox.io":"CodeSandbox","replit.com":"Replit","vercel.com":"Vercel","netlify.com":"Netlify","heroku.com":"Heroku","aws.amazon.com":"AWS","cloud.google.com":"Google Cloud","azure.microsoft.com":"Azure","digitalocean.com":"DigitalOcean","youtube.com":"YouTube","netflix.com":"Netflix","hulu.com":"Hulu","disneyplus.com":"Disney+","primevideo.com":"Prime Video","hbomax.com":"HBO Max","twitch.tv":"Twitch","vimeo.com":"Vimeo","dailymotion.com":"Dailymotion","tiktok.com":"TikTok","spotify.com":"Spotify","apple.com/music":"Apple Music","music.youtube.com":"YouTube Music","soundcloud.com":"SoundCloud","pandora.com":"Pandora","amazon.com":"Amazon","ebay.com":"eBay","etsy.com":"Etsy","walmart.com":"Walmart","target.com":"Target","bestbuy.com":"Best Buy","costco.com":"Costco","alibaba.com":"Alibaba","aliexpress.com":"AliExpress","shopify.com":"Shopify","squarespace.com":"Squarespace","wix.com":"Wix","wordpress.com":"WordPress","cnn.com":"CNN","bbc.com":"BBC","nytimes.com":"New York Times","washingtonpost.com":"Washington Post","theguardian.com":"The Guardian","reuters.com":"Reuters","ap.org":"Associated Press","npr.org":"NPR","foxnews.com":"Fox News","msnbc.com":"MSNBC","bloomberg.com":"Bloomberg","wsj.com":"Wall Street Journal","economist.com":"The Economist","techcrunch.com":"TechCrunch","theverge.com":"The Verge","ars-technica.com":"Ars Technica","microsoft.com":"Microsoft","apple.com":"Apple","adobe.com":"Adobe","salesforce.com":"Salesforce","atlassian.com":"Atlassian","slack.com":"Slack","zoom.us":"Zoom","teams.microsoft.com":"Microsoft Teams","meet.google.com":"Google Meet","notion.so":"Notion","airtable.com":"Airtable","trello.com":"Trello","asana.com":"Asana","monday.com":"Monday.com","dropbox.com":"Dropbox","box.com":"Box","onedrive.live.com":"OneDrive","drive.google.com":"Google Drive","figma.com":"Figma","sketch.com":"Sketch","canva.com":"Canva","behance.net":"Behance","dribbble.com":"Dribbble","unsplash.com":"Unsplash","pexels.com":"Pexels","shutterstock.com":"Shutterstock","gettyimages.com":"Getty Images","paypal.com":"PayPal","venmo.com":"Venmo","stripe.com":"Stripe","square.com":"Square","coinbase.com":"Coinbase","binance.com":"Binance","robinhood.com":"Robinhood","etrade.com":"E*TRADE","fidelity.com":"Fidelity","schwab.com":"Charles Schwab","expedia.com":"Expedia","booking.com":"Booking.com","airbnb.com":"Airbnb","uber.com":"Uber","lyft.com":"Lyft","maps.google.com":"Google Maps","waze.com":"Waze","tripadvisor.com":"TripAdvisor","kayak.com":"Kayak","priceline.com":"Priceline","coursera.org":"Coursera","udemy.com":"Udemy","edx.org":"edX","khanacademy.org":"Khan Academy","duolingo.com":"Duolingo","skillshare.com":"Skillshare","masterclass.com":"MasterClass","pluralsight.com":"Pluralsight","linkedin.com/learning":"LinkedIn Learning","gmail.com":"Gmail","outlook.com":"Outlook","mail.yahoo.com":"Yahoo Mail","protonmail.com":"ProtonMail","tutanota.com":"Tutanota","wikipedia.org":"Wikipedia","wikimedia.org":"Wikimedia","archive.org":"Internet Archive","dictionary.com":"Dictionary.com","merriam-webster.com":"Merriam-Webster","translate.google.com":"Google Translate","deepl.com":"DeepL","steam.com":"Steam","epicgames.com":"Epic Games","battle.net":"Battle.net","xbox.com":"Xbox","playstation.com":"PlayStation","nintendo.com":"Nintendo","roblox.com":"Roblox","minecraft.net":"Minecraft","webmd.com":"WebMD","mayoclinic.org":"Mayo Clinic","healthline.com":"Healthline","fitbit.com":"Fitbit","myfitnesspal.com":"MyFitnessPal","strava.com":"Strava"};let w=!1,S=!1,b=null;async function C(){if(!S)return b||(b=(async()=>{try{w=(await chrome.storage.sync.get({debugLoggingEnabled:!1})).debugLoggingEnabled||!1,chrome.storage.onChanged.addListener((e,t)=>{t==="sync"&&e.debugLoggingEnabled&&(w=e.debugLoggingEnabled.newValue||!1)}),S=!0}catch(a){console.error("[Logger] Failed to initialize:",a),w=!1,S=!0}})(),b)}function y(){return S?w:(typeof chrome<"u"&&chrome.storage&&!b&&C(),!1)}const s={log:function(...a){y()&&console.log(...a)},error:function(...a){y()&&console.error(...a)},warn:function(...a){y()&&console.warn(...a)},info:function(...a){y()&&console.info(...a)},debug:function(...a){y()&&console.debug(...a)},initialize:C};typeof chrome<"u"&&chrome.storage&&C();class ${constructor(){}extractWebsiteName(e){try{const t=this.normalizeHostname(e);if(!t)return e;const o=this.getCuratedName(t);return o||this.parseHostnameToName(t)}catch(t){return s.error("[WebsiteNameExtractor] Error extracting name:",t),this.parseHostnameToName(this.normalizeHostname(e))||e}}normalizeHostname(e){try{const t=/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(e)?e:`https://${e}`;let r=new URL(t).hostname.toLowerCase();return r.startsWith("www.")&&(r=r.substring(4)),r}catch{const t=e.match(/(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/);return t?t[1].toLowerCase():e}}getCuratedName(e){return B[e]||null}parseHostnameToName(e){if(!e)return null;try{let t=e.replace(/^(www|m|mobile|app|api|cdn|static)\./,"");if(t=t.replace(/\.(com|org|net|edu|gov|mil|int|co|io|ly|me|tv|app|dev|ai)$/,""),t.includes(".")){const o=t.split(".");t=o[o.length-1]}return t.charAt(0).toUpperCase()+t.slice(1)}catch{return e}}}const W=new $,L={INSTANT_SEARCH_QUERY:1e3,INSTANT_URL_SUGGESTION:1e3};function _(a,e="16"){const t=new URL(chrome.runtime.getURL("/_favicon/"));return t.searchParams.set("pageUrl",a),t.searchParams.set("size",e),t.toString()}async function F(){const a={enableSpotlight:!0,colorOverrides:null,debugLoggingEnabled:!1};return await chrome.storage.sync.get(a)}const N={getFaviconUrl:_,getSettings:F};class c{static normalizeURL(e){return/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(e)?e:`https://${e}`}static isURL(e){try{return new URL(e),!0}catch{}return/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(e)||e==="localhost"||e.startsWith("localhost:")?!0:/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(e)?e.split(":")[0].split(".").every(r=>{const i=parseInt(r,10);return i>=0&&i<=255}):!!/^[a-zA-Z0-9-]+\.(com|org|net|edu|gov|mil|int|co|io|ly|me|tv|app|dev|ai)([/\?#].*)?$/.test(e)}static generateInstantSuggestion(e){const t=e.trim();if(!t)return null;if(c.isURL(t)){const o=c.normalizeURL(t),r=c.extractWebsiteName(o);return{type:m.URL_SUGGESTION,title:r,url:o,score:L.INSTANT_URL_SUGGESTION,metadata:{originalInput:t},domain:"",favicon:null}}else return{type:m.SEARCH_QUERY,title:`Search for "${t}"`,url:"",score:L.INSTANT_SEARCH_QUERY,metadata:{query:t},domain:"",favicon:null}}static escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}static extractWebsiteName(e){try{return W.extractWebsiteName(e)}catch(t){s.error("[SpotlightUtils] Error extracting website name:",t);try{const o=c.normalizeURL(e);let i=new URL(o).hostname;return i.startsWith("www.")&&(i=i.substring(4)),i.charAt(0).toUpperCase()+i.slice(1)}catch{return e}}}static getFaviconUrl(e){if(e.favicon&&e.favicon.startsWith("http"))return e.favicon;if(e.type===m.AUTOCOMPLETE_SUGGESTION){if(e.metadata?.isUrl&&e.url)try{return N.getFaviconUrl(e.url,"64")}catch{}return`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>')}`}if(e.url)try{return N.getFaviconUrl(e.url,"64")}catch{}return`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>')}`}static formatResult(e,t){const o={[m.URL_SUGGESTION]:{title:e.title,subtitle:e.url,action:"↵"},[m.SEARCH_QUERY]:{title:e.title,subtitle:"",action:"↵"},[m.AUTOCOMPLETE_SUGGESTION]:{title:e.title,subtitle:e.metadata?.isUrl?e.url:"",action:"↵"},[m.OPEN_TAB]:{title:e.title,subtitle:e.domain,action:t===G.NEW_TAB?"Switch to Tab":"↵"},[m.PINNED_TAB]:{title:e.title,subtitle:e.domain,action:e.metadata?.isActive?"Switch to Tab":"Open Pinned Tab"},[m.BOOKMARK]:{title:e.title,subtitle:e.domain,action:"↵"},[m.HISTORY]:{title:e.title,subtitle:e.domain,action:"↵"},[m.TOP_SITE]:{title:e.title,subtitle:e.domain,action:"↵"}};return s.log("---- Formatting result type",e.type),o[e.type]||{title:e.title,subtitle:e.url,action:"↵"}}static hexToRgb(e){const t=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(e);return t?`${parseInt(t[1],16)}, ${parseInt(t[2],16)}, ${parseInt(t[3],16)}`:null}static async getAccentColorCSS(e){const t={grey:"204, 204, 204",blue:"139, 179, 243",red:"255, 158, 151",yellow:"255, 226, 159",green:"139, 218, 153",pink:"251, 170, 215",purple:"214, 166, 255",cyan:"165, 226, 234"};let o=t[e]||t.purple;try{const r=await chrome.storage.sync.get(["colorOverrides"]);if(r.colorOverrides&&r.colorOverrides[e]){const i=r.colorOverrides[e],l=this.hexToRgb(i);l&&(o=l)}}catch(r){s.error("Error getting color overrides:",r)}return`
            :root {
                --spotlight-accent-color: rgb(${o});
                --spotlight-accent-color-15: rgba(${o}, 0.15);
                --spotlight-accent-color-20: rgba(${o}, 0.2);
                --spotlight-accent-color-80: rgba(${o}, 0.8);
            }
        `}static areResultsDuplicate(e,t){if(!e||!t)return!1;if(e.url&&t.url){const o=e.url.toLowerCase().replace(/\/+$/,""),r=t.url.toLowerCase().replace(/\/+$/,"");return o===r}return e.type==="search-query"&&t.type==="search-query"?e.title===t.title:!1}static setupFaviconErrorHandling(e){e.querySelectorAll('.arcify-spotlight-result-favicon[data-fallback-icon="true"]').forEach(o=>{o.addEventListener("error",function(){this.src=c.getFaviconUrl({url:null,favicon:null})})})}static formatDebugInfo(e){return""}}class q{constructor(e){this.container=e,this.selectedIndex=0,this.results=[]}updateResults(e){this.results=e,this.selectedIndex=0,this.updateVisualSelection()}moveSelection(e){const t=this.results.length-1;e==="down"?this.selectedIndex=Math.min(this.selectedIndex+1,t):e==="up"&&(this.selectedIndex=Math.max(this.selectedIndex-1,0)),this.updateVisualSelection()}moveToFirst(){this.selectedIndex=0,this.updateVisualSelection()}moveToLast(){this.selectedIndex=Math.max(0,this.results.length-1),this.updateVisualSelection()}getSelectedResult(){return this.results[this.selectedIndex]||null}updateVisualSelection(){const e=this.container.querySelectorAll(".arcify-spotlight-result-item");e.forEach((t,o)=>{t.classList.toggle("selected",o===this.selectedIndex)}),e[this.selectedIndex]&&e[this.selectedIndex].scrollIntoView({behavior:"smooth",block:"nearest"})}handleKeyDown(e,t=!1){if(!t&&!this.container.contains(document.activeElement))return!1;switch(e.key){case"ArrowDown":return e.preventDefault(),e.stopPropagation(),this.moveSelection("down"),!0;case"ArrowUp":return e.preventDefault(),e.stopPropagation(),this.moveSelection("up"),!0;case"Home":return e.preventDefault(),e.stopPropagation(),this.moveToFirst(),!0;case"End":return e.preventDefault(),e.stopPropagation(),this.moveToLast(),!0;default:return!1}}}class T{static async getSuggestions(e,t){try{const o={action:"getSpotlightSuggestions",query:e.trim(),mode:t},r=await chrome.runtime.sendMessage(o);return r&&r.success?r.results:(s.error("[SpotlightMessageClient] Get suggestions failed:",r?.error),[])}catch(o){return s.error("[SpotlightMessageClient] Get suggestions error:",o),[]}}static async handleResult(e,t){try{const o={action:"spotlightHandleResult",result:e,mode:t,tabId:window.arcifyCurrentTabId||null},r=await chrome.runtime.sendMessage(o);return!r||r.success===!1?(s.error("[SpotlightMessageClient] Result action failed:",r?.error||"No response"),!1):!0}catch(o){return s.error("[SpotlightMessageClient] Error handling result action:",o),!1}}static async getActiveSpaceColor(){try{const e=await chrome.runtime.sendMessage({action:"getActiveSpaceColor"});return e&&e.success&&e.color?e.color:(s.error("[SpotlightMessageClient] Failed to get active space color:",e?.error),"purple")}catch(e){return s.error("[SpotlightMessageClient] Error getting active space color:",e),"purple"}}static notifyOpened(){try{chrome.runtime.sendMessage({action:"spotlightOpened"})}catch(e){s.error("[SpotlightMessageClient] Error notifying spotlight opened:",e)}}static notifyClosed(){try{chrome.runtime.sendMessage({action:"spotlightClosed"})}catch(e){s.error("[SpotlightMessageClient] Error notifying spotlight closed:",e)}}static async switchToTab(e,t){try{return(await chrome.runtime.sendMessage({action:"switchToTab",tabId:e,windowId:t}))?.success===!0}catch(o){return s.error("[SpotlightMessageClient] Error switching to tab:",o),!1}}static async navigateCurrentTab(e){try{return(await chrome.runtime.sendMessage({action:"navigateCurrentTab",url:e}))?.success===!0}catch(t){return s.error("[SpotlightMessageClient] Error navigating current tab:",t),!1}}static async openNewTab(e){try{return(await chrome.runtime.sendMessage({action:"openNewTab",url:e}))?.success===!0}catch(t){return s.error("[SpotlightMessageClient] Error opening new tab:",t),!1}}static async performSearch(e,t){try{return(await chrome.runtime.sendMessage({action:"performSearch",query:e,mode:t}))?.success===!0}catch(o){return s.error("[SpotlightMessageClient] Error performing search:",o),!1}}static setupGlobalCloseListener(e){const t=o=>{o.action==="closeSpotlight"&&e()};return chrome.runtime.onMessage.addListener(t),()=>{chrome.runtime.onMessage.removeListener(t)}}}class h{static combineResults(e,t){const o=[];e&&o.push(e);for(const r of t)e&&c.areResultsDuplicate(e,r)||o.push(r);return o}static generateResultsHTML(e,t){return!e||e.length===0?'<div class="arcify-spotlight-empty">Start typing to search tabs, bookmarks, and history</div>':e.map((o,r)=>{const i=c.formatResult(o,t);return`
                <button class="arcify-spotlight-result-item ${r===0?"selected":""}" 
                        data-index="${r}">
                    <img class="arcify-spotlight-result-favicon" 
                         src="${c.getFaviconUrl(o)}" 
                         alt="favicon"
                         data-fallback-icon="true">
                    <div class="arcify-spotlight-result-content">
                        <div class="arcify-spotlight-result-title">${c.escapeHtml(i.title)}</div>
                        <div class="arcify-spotlight-result-url">${c.escapeHtml(i.subtitle)}${c.formatDebugInfo(o)}</div>
                    </div>
                    <div class="arcify-spotlight-result-action">${c.escapeHtml(i.action)}</div>
                </button>
            `}).join("")}static updateResultsDisplay(e,t,o,r){const i=h.generateResultsHTML(o,r);e.innerHTML=i,c.setupFaviconErrorHandling(e)}static createKeyDownHandler(e,t,o,r=!0){return i=>{if(!e.handleKeyDown(i,r))switch(i.key){case"Enter":if(t){i.preventDefault(),i.stopPropagation();const l=e.getSelectedResult();l&&t(l,i)}break;case"Escape":o&&(i.preventDefault(),i.stopPropagation(),o(i));break}}}static setupResultClickHandling(e,t,o){e.addEventListener("click",r=>{const i=r.target.closest(".arcify-spotlight-result-item");if(i){const l=o();if(l){const p=parseInt(i.dataset.index),g=l[p];g&&t&&t(g,p)}}})}static createInputHandler(e,t,o=150){let r=null;return i=>{r&&clearTimeout(r),e&&e(i),t&&(r=setTimeout(()=>{t(i)},o))}}}document.addEventListener("DOMContentLoaded",async()=>{const a=document.getElementById("spotlight-container");if(!(await chrome.storage.sync.get({enableSpotlight:!0})).enableSpotlight){try{await chrome.runtime.sendMessage({action:"navigateToDefaultNewTab"})}catch(t){s.error("[NewTab] Error navigating to default new tab:",t)}return}a&&(a.style.visibility="visible"),await V()});async function V(){const a=document.getElementById("spotlight-container");let e="purple";const o=`
        ${await c.getAccentColorCSS(e)}
        
        /* Smooth transitions for color changes */
        :root {
            transition: --spotlight-accent-color 0.3s ease,
                       --spotlight-accent-color-15 0.3s ease,
                       --spotlight-accent-color-20 0.3s ease,
                       --spotlight-accent-color-80 0.3s ease;
        }
        
        .arcify-spotlight-wrapper {
            background: #2D2D2D;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0;
            color: #ffffff;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: spotlight-appear 0.3s ease-out;
        }

        @keyframes spotlight-appear {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .arcify-spotlight-input-wrapper {
            display: flex;
            align-items: center;
            padding: 12px 24px 12px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .arcify-spotlight-search-icon {
            width: 20px;
            height: 20px;
            margin-right: 12px;
            opacity: 0.6;
            flex-shrink: 0;
        }

        .arcify-spotlight-input {
            flex: 1;
            background: transparent;
            border: none;
            color: #ffffff;
            font-size: 18px;
            line-height: 24px;
            padding: 8px 0;
            outline: none;
            font-weight: 400;
        }

        .arcify-spotlight-input::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }

        .arcify-spotlight-results {
            max-height: 270px;
            overflow-y: auto;
            padding: 8px 0;
            scroll-behavior: smooth;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .arcify-spotlight-results::-webkit-scrollbar {
            display: none;
        }

        .arcify-spotlight-result-item {
            display: flex;
            align-items: center;
            padding: 12px 24px 12px 20px;
            min-height: 44px;
            cursor: pointer;
            transition: background-color 0.15s ease;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            color: inherit;
            font-family: inherit;
        }

        .arcify-spotlight-result-item:hover,
        .arcify-spotlight-result-item:focus {
            background: var(--spotlight-accent-color-15);
            outline: none;
        }

        .arcify-spotlight-result-item.selected {
            background: var(--spotlight-accent-color-20);
        }

        .arcify-spotlight-result-favicon {
            width: 20px;
            height: 20px;
            margin-right: 12px;
            border-radius: 4px;
            flex-shrink: 0;
        }

        .arcify-spotlight-result-content {
            flex: 1;
            min-width: 0;
            min-height: 32px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .arcify-spotlight-result-title {
            font-size: 14px;
            font-weight: 500;
            color: #ffffff;
            margin: 0 0 2px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .arcify-spotlight-result-url {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .arcify-spotlight-result-url:empty {
            display: none;
        }

        .arcify-spotlight-result-action {
            font-size: 12px;
            color: var(--spotlight-accent-color-80);
            margin-left: 12px;
            flex-shrink: 0;
        }

        .arcify-spotlight-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            color: rgba(255, 255, 255, 0.6);
        }

        .arcify-spotlight-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
        }

        @media (max-width: 640px) {
            .arcify-spotlight-input {
                font-size: 16px;
            }
        }
    `,r=document.createElement("style");r.id="arcify-spotlight-styles",r.textContent=o,document.head.appendChild(r),a.innerHTML=`
        <div class="arcify-spotlight-wrapper">
            <div class="arcify-spotlight-input-wrapper">
                <svg class="arcify-spotlight-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input 
                    type="text" 
                    class="arcify-spotlight-input" 
                    placeholder="Search or enter URL (opens in new tab)..."
                    spellcheck="false"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                >
            </div>
            <div class="arcify-spotlight-results">
                <div class="arcify-spotlight-loading">Loading...</div>
            </div>
        </div>
    `;const i=a.querySelector(".arcify-spotlight-input"),l=a.querySelector(".arcify-spotlight-results");let p=[],g=null,d=[];async function E(n,u){return await T.getSuggestions(n,u)}async function U(n,u){return await T.handleResult(n,u)}const v=new q(l);async function k(){try{g=null,d=await E("","current-tab")||[],f()}catch(n){s.error("[NewTab Spotlight] Error loading initial results:",n),g=null,d=[],R()}}function D(){const n=i.value.trim();if(!n){g=null,k();return}g=c.generateInstantSuggestion(n),f()}async function O(){const n=i.value.trim();if(!n){d=[],f();return}try{d=await E(n,"current-tab")||[],f()}catch(u){s.error("[NewTab Spotlight] Search error:",u),d=[],f()}}function P(){return h.combineResults(g,d)}function f(){if(p=P(),v.updateResults(p),p.length===0){R();return}h.updateResultsDisplay(l,[],p,"current-tab")}function R(){l.innerHTML='<div class="arcify-spotlight-empty">Start typing to search tabs, bookmarks, and history</div>',p=[],g=null,d=[],v.updateResults([])}i.addEventListener("input",h.createInputHandler(D,O,150));async function A(n){if(!n){s.error("[NewTab Spotlight] No result provided");return}try{await U(n,"current-tab")}catch(u){s.error("[NewTab Spotlight] Error in result action:",u)}}i.addEventListener("keydown",h.createKeyDownHandler(v,n=>A(n),()=>{})),h.setupResultClickHandling(l,(n,u)=>A(n),()=>p),i.focus(),(async()=>{try{const n=await T.getActiveSpaceColor();if(n!==e){const u=await c.getAccentColorCSS(n),x=document.querySelector("#arcify-spotlight-styles");if(x){const I=/:root\s*{([^}]*)}/,z=x.textContent,M=u.match(I);if(M){const H=z.replace(I,M[0]);x.textContent=H}}}}catch(n){s.error("[NewTab Spotlight] Error updating active space color:",n)}k()})()}
