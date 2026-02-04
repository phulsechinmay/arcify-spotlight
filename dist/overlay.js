(function(){"use strict";const m={URL_SUGGESTION:"url-suggestion",SEARCH_QUERY:"search-query",AUTOCOMPLETE_SUGGESTION:"autocomplete-suggestion",OPEN_TAB:"open-tab",PINNED_TAB:"pinned-tab",BOOKMARK:"bookmark",HISTORY:"history",TOP_SITE:"top-site"},p={CURRENT_TAB:"current-tab",NEW_TAB:"new-tab"},W={"google.com":"Google","bing.com":"Bing","duckduckgo.com":"DuckDuckGo","yahoo.com":"Yahoo","chatgpt.com":"ChatGPT","openai.com":"OpenAI","anthropic.com":"Anthropic","claude.ai":"Claude","copilot.microsoft.com":"Copilot","bard.google.com":"Bard","perplexity.ai":"Perplexity","facebook.com":"Facebook","meta.com":"Meta","twitter.com":"Twitter","x.com":"X","linkedin.com":"LinkedIn","instagram.com":"Instagram","tiktok.com":"TikTok","snapchat.com":"Snapchat","pinterest.com":"Pinterest","tumblr.com":"Tumblr","reddit.com":"Reddit","discord.com":"Discord","telegram.org":"Telegram","whatsapp.com":"WhatsApp","signal.org":"Signal","github.com":"GitHub","gitlab.com":"GitLab","bitbucket.org":"Bitbucket","stackoverflow.com":"Stack Overflow","stackexchange.com":"Stack Exchange","codepen.io":"CodePen","jsfiddle.net":"JSFiddle","codesandbox.io":"CodeSandbox","replit.com":"Replit","vercel.com":"Vercel","netlify.com":"Netlify","heroku.com":"Heroku","aws.amazon.com":"AWS","cloud.google.com":"Google Cloud","azure.microsoft.com":"Azure","digitalocean.com":"DigitalOcean","youtube.com":"YouTube","netflix.com":"Netflix","hulu.com":"Hulu","disneyplus.com":"Disney+","primevideo.com":"Prime Video","hbomax.com":"HBO Max","twitch.tv":"Twitch","vimeo.com":"Vimeo","dailymotion.com":"Dailymotion","tiktok.com":"TikTok","spotify.com":"Spotify","apple.com/music":"Apple Music","music.youtube.com":"YouTube Music","soundcloud.com":"SoundCloud","pandora.com":"Pandora","amazon.com":"Amazon","ebay.com":"eBay","etsy.com":"Etsy","walmart.com":"Walmart","target.com":"Target","bestbuy.com":"Best Buy","costco.com":"Costco","alibaba.com":"Alibaba","aliexpress.com":"AliExpress","shopify.com":"Shopify","squarespace.com":"Squarespace","wix.com":"Wix","wordpress.com":"WordPress","cnn.com":"CNN","bbc.com":"BBC","nytimes.com":"New York Times","washingtonpost.com":"Washington Post","theguardian.com":"The Guardian","reuters.com":"Reuters","ap.org":"Associated Press","npr.org":"NPR","foxnews.com":"Fox News","msnbc.com":"MSNBC","bloomberg.com":"Bloomberg","wsj.com":"Wall Street Journal","economist.com":"The Economist","techcrunch.com":"TechCrunch","theverge.com":"The Verge","ars-technica.com":"Ars Technica","microsoft.com":"Microsoft","apple.com":"Apple","adobe.com":"Adobe","salesforce.com":"Salesforce","atlassian.com":"Atlassian","slack.com":"Slack","zoom.us":"Zoom","teams.microsoft.com":"Microsoft Teams","meet.google.com":"Google Meet","notion.so":"Notion","airtable.com":"Airtable","trello.com":"Trello","asana.com":"Asana","monday.com":"Monday.com","dropbox.com":"Dropbox","box.com":"Box","onedrive.live.com":"OneDrive","drive.google.com":"Google Drive","figma.com":"Figma","sketch.com":"Sketch","canva.com":"Canva","behance.net":"Behance","dribbble.com":"Dribbble","unsplash.com":"Unsplash","pexels.com":"Pexels","shutterstock.com":"Shutterstock","gettyimages.com":"Getty Images","paypal.com":"PayPal","venmo.com":"Venmo","stripe.com":"Stripe","square.com":"Square","coinbase.com":"Coinbase","binance.com":"Binance","robinhood.com":"Robinhood","etrade.com":"E*TRADE","fidelity.com":"Fidelity","schwab.com":"Charles Schwab","expedia.com":"Expedia","booking.com":"Booking.com","airbnb.com":"Airbnb","uber.com":"Uber","lyft.com":"Lyft","maps.google.com":"Google Maps","waze.com":"Waze","tripadvisor.com":"TripAdvisor","kayak.com":"Kayak","priceline.com":"Priceline","coursera.org":"Coursera","udemy.com":"Udemy","edx.org":"edX","khanacademy.org":"Khan Academy","duolingo.com":"Duolingo","skillshare.com":"Skillshare","masterclass.com":"MasterClass","pluralsight.com":"Pluralsight","linkedin.com/learning":"LinkedIn Learning","gmail.com":"Gmail","outlook.com":"Outlook","mail.yahoo.com":"Yahoo Mail","protonmail.com":"ProtonMail","tutanota.com":"Tutanota","wikipedia.org":"Wikipedia","wikimedia.org":"Wikimedia","archive.org":"Internet Archive","dictionary.com":"Dictionary.com","merriam-webster.com":"Merriam-Webster","translate.google.com":"Google Translate","deepl.com":"DeepL","steam.com":"Steam","epicgames.com":"Epic Games","battle.net":"Battle.net","xbox.com":"Xbox","playstation.com":"PlayStation","nintendo.com":"Nintendo","roblox.com":"Roblox","minecraft.net":"Minecraft","webmd.com":"WebMD","mayoclinic.org":"Mayo Clinic","healthline.com":"Healthline","fitbit.com":"Fitbit","myfitnesspal.com":"MyFitnessPal","strava.com":"Strava"};let T=!1,k=!1,S=null;async function I(){if(!k)return S||(S=(async()=>{try{T=(await chrome.storage.sync.get({debugLoggingEnabled:!1})).debugLoggingEnabled||!1,chrome.storage.onChanged.addListener((t,e)=>{e==="sync"&&t.debugLoggingEnabled&&(T=t.debugLoggingEnabled.newValue||!1)}),k=!0}catch(n){console.error("[Logger] Failed to initialize:",n),T=!1,k=!0}})(),S)}function x(){return k?T:(typeof chrome<"u"&&chrome.storage&&!S&&I(),!1)}const c={log:function(...n){x()&&console.log(...n)},error:function(...n){x()&&console.error(...n)},warn:function(...n){x()&&console.warn(...n)},info:function(...n){x()&&console.info(...n)},debug:function(...n){x()&&console.debug(...n)},initialize:I};typeof chrome<"u"&&chrome.storage&&I();class _{constructor(){}extractWebsiteName(t){try{const e=this.normalizeHostname(t);if(!e)return t;const o=this.getCuratedName(e);return o||this.parseHostnameToName(e)}catch(e){return c.error("[WebsiteNameExtractor] Error extracting name:",e),this.parseHostnameToName(this.normalizeHostname(t))||t}}normalizeHostname(t){try{const e=/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)?t:`https://${t}`;let i=new URL(e).hostname.toLowerCase();return i.startsWith("www.")&&(i=i.substring(4)),i}catch{const e=t.match(/(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/);return e?e[1].toLowerCase():t}}getCuratedName(t){return W[t]||null}parseHostnameToName(t){if(!t)return null;try{let e=t.replace(/^(www|m|mobile|app|api|cdn|static)\./,"");if(e=e.replace(/\.(com|org|net|edu|gov|mil|int|co|io|ly|me|tv|app|dev|ai)$/,""),e.includes(".")){const o=e.split(".");e=o[o.length-1]}return e.charAt(0).toUpperCase()+e.slice(1)}catch{return t}}}const $=new _,M={INSTANT_SEARCH_QUERY:1e3,INSTANT_URL_SUGGESTION:1e3};function F(n,t="16"){const e=new URL(chrome.runtime.getURL("/_favicon/"));return e.searchParams.set("pageUrl",n),e.searchParams.set("size",t),e.toString()}async function q(){const n={enableSpotlight:!0,colorOverrides:null,debugLoggingEnabled:!1};return await chrome.storage.sync.get(n)}const N={getFaviconUrl:F,getSettings:q};class l{static normalizeURL(t){return/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)?t:`https://${t}`}static isURL(t){try{return new URL(t),!0}catch{}return/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(t)||t==="localhost"||t.startsWith("localhost:")?!0:/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(t)?t.split(":")[0].split(".").every(i=>{const a=parseInt(i,10);return a>=0&&a<=255}):!!/^[a-zA-Z0-9-]+\.(com|org|net|edu|gov|mil|int|co|io|ly|me|tv|app|dev|ai)([/\?#].*)?$/.test(t)}static generateInstantSuggestion(t){const e=t.trim();if(!e)return null;if(l.isURL(e)){const o=l.normalizeURL(e),i=l.extractWebsiteName(o);return{type:m.URL_SUGGESTION,title:i,url:o,score:M.INSTANT_URL_SUGGESTION,metadata:{originalInput:e},domain:"",favicon:null}}else return{type:m.SEARCH_QUERY,title:`Search for "${e}"`,url:"",score:M.INSTANT_SEARCH_QUERY,metadata:{query:e},domain:"",favicon:null}}static escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}static extractWebsiteName(t){try{return $.extractWebsiteName(t)}catch(e){c.error("[SpotlightUtils] Error extracting website name:",e);try{const o=l.normalizeURL(t);let a=new URL(o).hostname;return a.startsWith("www.")&&(a=a.substring(4)),a.charAt(0).toUpperCase()+a.slice(1)}catch{return t}}}static getFaviconUrl(t){if(t.favicon&&t.favicon.startsWith("http"))return t.favicon;if(t.type===m.AUTOCOMPLETE_SUGGESTION){if(t.metadata?.isUrl&&t.url)try{return N.getFaviconUrl(t.url,"64")}catch{}return`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>')}`}if(t.url)try{return N.getFaviconUrl(t.url,"64")}catch{}return`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>')}`}static formatResult(t,e){const o={[m.URL_SUGGESTION]:{title:t.title,subtitle:t.url,action:"↵"},[m.SEARCH_QUERY]:{title:t.title,subtitle:"",action:"↵"},[m.AUTOCOMPLETE_SUGGESTION]:{title:t.title,subtitle:t.metadata?.isUrl?t.url:"",action:"↵"},[m.OPEN_TAB]:{title:t.title,subtitle:t.domain,action:e===p.NEW_TAB?"Switch to Tab":"↵"},[m.PINNED_TAB]:{title:t.title,subtitle:t.domain,action:t.metadata?.isActive?"Switch to Tab":"Open Pinned Tab"},[m.BOOKMARK]:{title:t.title,subtitle:t.domain,action:"↵"},[m.HISTORY]:{title:t.title,subtitle:t.domain,action:"↵"},[m.TOP_SITE]:{title:t.title,subtitle:t.domain,action:"↵"}};return c.log("---- Formatting result type",t.type),o[t.type]||{title:t.title,subtitle:t.url,action:"↵"}}static hexToRgb(t){const e=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return e?`${parseInt(e[1],16)}, ${parseInt(e[2],16)}, ${parseInt(e[3],16)}`:null}static async getAccentColorCSS(t){const e={grey:"204, 204, 204",blue:"139, 179, 243",red:"255, 158, 151",yellow:"255, 226, 159",green:"139, 218, 153",pink:"251, 170, 215",purple:"214, 166, 255",cyan:"165, 226, 234",orange:"255, 176, 103"};let o=e[t]||e.purple;try{const i=await chrome.storage.sync.get(["colorOverrides"]);if(i.colorOverrides&&i.colorOverrides[t]){const a=i.colorOverrides[t],s=this.hexToRgb(a);s&&(o=s)}}catch(i){c.error("Error getting color overrides:",i)}return`
            :root {
                --spotlight-accent-color: rgb(${o});
                --spotlight-accent-color-15: rgba(${o}, 0.15);
                --spotlight-accent-color-20: rgba(${o}, 0.2);
                --spotlight-accent-color-80: rgba(${o}, 0.8);
            }
        `}static areResultsDuplicate(t,e){if(!t||!e)return!1;if(t.url&&e.url){const o=t.url.toLowerCase().replace(/\/+$/,""),i=e.url.toLowerCase().replace(/\/+$/,"");return o===i}return t.type==="search-query"&&e.type==="search-query"?t.title===e.title:!1}static setupFaviconErrorHandling(t){t.querySelectorAll('.arcify-spotlight-result-favicon[data-fallback-icon="true"]').forEach(o=>{o.addEventListener("error",function(){this.src=l.getFaviconUrl({url:null,favicon:null})})})}static formatDebugInfo(t){return""}}class V{constructor(t,e=null){this.container=t,this.selectedIndex=0,this.results=[],this.onSelectionChange=e}updateResults(t){this.results=t,this.selectedIndex=0,this.updateVisualSelection()}moveSelection(t){const e=this.selectedIndex,o=this.results.length-1;t==="down"?this.selectedIndex=Math.min(this.selectedIndex+1,o):t==="up"&&(this.selectedIndex=Math.max(this.selectedIndex-1,0)),this.updateVisualSelection(),this.onSelectionChange&&e!==this.selectedIndex&&this.onSelectionChange(this.getSelectedResult(),this.selectedIndex)}moveToFirst(){const t=this.selectedIndex;this.selectedIndex=0,this.updateVisualSelection(),this.onSelectionChange&&t!==this.selectedIndex&&this.onSelectionChange(this.getSelectedResult(),this.selectedIndex)}moveToLast(){const t=this.selectedIndex;this.selectedIndex=Math.max(0,this.results.length-1),this.updateVisualSelection(),this.onSelectionChange&&t!==this.selectedIndex&&this.onSelectionChange(this.getSelectedResult(),this.selectedIndex)}getSelectedResult(){return this.results[this.selectedIndex]||null}updateVisualSelection(){const t=this.container.querySelectorAll(".arcify-spotlight-result-item");t.forEach((e,o)=>{e.classList.toggle("selected",o===this.selectedIndex)}),t[this.selectedIndex]&&t[this.selectedIndex].scrollIntoView({behavior:"smooth",block:"nearest"})}handleKeyDown(t,e=!1){if(!e&&!this.container.contains(document.activeElement))return!1;switch(t.key){case"ArrowDown":return t.preventDefault(),t.stopPropagation(),this.moveSelection("down"),!0;case"ArrowUp":return t.preventDefault(),t.stopPropagation(),this.moveSelection("up"),!0;case"Home":return t.preventDefault(),t.stopPropagation(),this.moveToFirst(),!0;case"End":return t.preventDefault(),t.stopPropagation(),this.moveToLast(),!0;default:return!1}}}class g{static async getSuggestions(t,e){try{const o={action:"getSpotlightSuggestions",query:t.trim(),mode:e},i=await chrome.runtime.sendMessage(o);return i&&i.success?i.results:(c.error("[SpotlightMessageClient] Get suggestions failed:",i?.error),[])}catch(o){return c.error("[SpotlightMessageClient] Get suggestions error:",o),[]}}static async handleResult(t,e){try{const o={action:"spotlightHandleResult",result:t,mode:e,tabId:window.arcifyCurrentTabId||null},i=await chrome.runtime.sendMessage(o);return!i||i.success===!1?(c.error("[SpotlightMessageClient] Result action failed:",i?.error||"No response"),!1):!0}catch(o){return c.error("[SpotlightMessageClient] Error handling result action:",o),!1}}static async getActiveSpaceColor(){try{const t=await chrome.runtime.sendMessage({action:"getActiveSpaceColor"});return t&&t.success&&t.color?t.color:(c.error("[SpotlightMessageClient] Failed to get active space color:",t?.error),"purple")}catch(t){return c.error("[SpotlightMessageClient] Error getting active space color:",t),"purple"}}static notifyOpened(){try{chrome.runtime.sendMessage({action:"spotlightOpened"})}catch(t){c.error("[SpotlightMessageClient] Error notifying spotlight opened:",t)}}static notifyClosed(){try{chrome.runtime.sendMessage({action:"spotlightClosed"})}catch(t){c.error("[SpotlightMessageClient] Error notifying spotlight closed:",t)}}static async switchToTab(t,e){try{return(await chrome.runtime.sendMessage({action:"switchToTab",tabId:t,windowId:e}))?.success===!0}catch(o){return c.error("[SpotlightMessageClient] Error switching to tab:",o),!1}}static async navigateCurrentTab(t){try{return(await chrome.runtime.sendMessage({action:"navigateCurrentTab",url:t}))?.success===!0}catch(e){return c.error("[SpotlightMessageClient] Error navigating current tab:",e),!1}}static async openNewTab(t){try{return(await chrome.runtime.sendMessage({action:"openNewTab",url:t}))?.success===!0}catch(e){return c.error("[SpotlightMessageClient] Error opening new tab:",e),!1}}static async performSearch(t,e){try{return(await chrome.runtime.sendMessage({action:"performSearch",query:t,mode:e}))?.success===!0}catch(o){return c.error("[SpotlightMessageClient] Error performing search:",o),!1}}static setupGlobalCloseListener(t){const e=o=>{o.action==="closeSpotlight"&&t()};return chrome.runtime.onMessage.addListener(e),()=>{chrome.runtime.onMessage.removeListener(e)}}}class h{static combineResults(t,e){const o=[];t&&o.push(t);for(const i of e)t&&l.areResultsDuplicate(t,i)||o.push(i);return o}static generateResultsHTML(t,e){return!t||t.length===0?'<div class="arcify-spotlight-empty">Start typing to search tabs, bookmarks, and history</div>':t.map((o,i)=>{const a=l.formatResult(o,e);return`
                <button class="arcify-spotlight-result-item ${i===0?"selected":""}" 
                        data-index="${i}">
                    <img class="arcify-spotlight-result-favicon" 
                         src="${l.getFaviconUrl(o)}" 
                         alt="favicon"
                         data-fallback-icon="true">
                    <div class="arcify-spotlight-result-content">
                        <div class="arcify-spotlight-result-title">${l.escapeHtml(a.title)}</div>
                        <div class="arcify-spotlight-result-url">${l.escapeHtml(a.subtitle)}${l.formatDebugInfo(o)}</div>
                    </div>
                    <div class="arcify-spotlight-result-action">${l.escapeHtml(a.action)}</div>
                </button>
            `}).join("")}static updateResultsDisplay(t,e,o,i){const a=h.generateResultsHTML(o,i);t.innerHTML=a,l.setupFaviconErrorHandling(t)}static createKeyDownHandler(t,e,o,i=!0){return a=>{if(!t.handleKeyDown(a,i))switch(a.key){case"Enter":if(e){a.preventDefault(),a.stopPropagation();const s=t.getSelectedResult();s&&e(s,a)}break;case"Escape":o&&(a.preventDefault(),a.stopPropagation(),o(a));break}}}static setupResultClickHandling(t,e,o){t.addEventListener("click",i=>{const a=i.target.closest(".arcify-spotlight-result-item");if(a){const s=o();if(s){const u=parseInt(a.dataset.index),f=s[u];f&&e&&e(f,u)}}})}static createInputHandler(t,e,o=150){let i=null;return a=>{i&&clearTimeout(i),t&&t(a),e&&(i=setTimeout(()=>{e(a)},o))}}}window.arcifySpotlightTabMode||chrome.runtime.onMessage.addListener((n,t,e)=>{n.action==="activateSpotlight"&&(window.arcifySpotlightTabMode=n.mode,window.arcifyCurrentTabUrl=n.tabUrl,window.arcifyCurrentTabId=n.tabId,U(n.mode),e({success:!0}))});async function U(n="current-tab"){const t=document.getElementById("arcify-spotlight-dialog");if(t){if(t.open)t.close();else{t.showModal(),g.notifyOpened();const r=t.querySelector(".arcify-spotlight-input");r&&(r.focus(),r.select(),r.scrollLeft=0)}return}window.arcifySpotlightInjected=!0;let e="purple";const i=`
        ${await l.getAccentColorCSS(e)}
        
        /* Smooth transitions for color changes */
        :root {
            transition: --spotlight-accent-color 0.3s ease,
                       --spotlight-accent-color-15 0.3s ease,
                       --spotlight-accent-color-20 0.3s ease,
                       --spotlight-accent-color-80 0.3s ease;
        }
        
        #arcify-spotlight-dialog {
            margin: 0;
            position: fixed;
            /* Not fully centered but this looks better than 50vh */
            top: calc(35vh);
            left: 50%;
            transform: translateX(-50%);
            border: none;
            padding: 0;
            background: transparent;
            border-radius: 12px;
            width: 650px;
            max-width: 90vw;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        #arcify-spotlight-dialog::backdrop {
            background: transparent;
        }

        .arcify-spotlight-container {
            background: #2D2D2D;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #ffffff;
            position: relative;
            overflow: hidden;
        }

        #arcify-spotlight-dialog .arcify-spotlight-input-wrapper {
            display: flex;
            align-items: center;
            padding: 12px 24px 12px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        #arcify-spotlight-dialog .arcify-spotlight-search-icon {
            width: 20px;
            height: 20px;
            margin-right: 12px;
            opacity: 0.6;
            flex-shrink: 0;
        }

        /* 
            Specific CSS directives to override styling on specific pages (stackoverflow, chrome docs).
            Otherwise the spotlight bar has a white background and some other weird UI.
        */
        #arcify-spotlight-dialog .arcify-spotlight-input {
            flex: 1 !important;
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            border: none !important;
            border-style: none !important;
            border-width: 0 !important;
            border-color: transparent !important;
            color: #ffffff !important;
            font-size: 18px !important;
            line-height: 24px !important;
            padding: 8px 0 !important;
            margin: 0 !important;
            outline: none !important;
            outline-style: none !important;
            outline-width: 0 !important;
            font-weight: 400 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            text-indent: 0 !important;
            text-shadow: none !important;
            vertical-align: baseline !important;
            text-decoration: none !important;
            box-sizing: border-box !important;
        }

        #arcify-spotlight-dialog .arcify-spotlight-input::placeholder {
            color: rgba(255, 255, 255, 0.5) !important;
            opacity: 1 !important;
        }

        #arcify-spotlight-dialog .arcify-spotlight-input:focus {
            outline: none !important;
            outline-style: none !important;
            outline-width: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            background-color: transparent !important;
        }

        .arcify-spotlight-results {
            max-height: 270px;
            overflow-y: auto;
            padding: 8px 0;
            scroll-behavior: smooth;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
        }

        .arcify-spotlight-results::-webkit-scrollbar {
            display: none; /* Chrome, Safari and Opera */
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

        #arcify-spotlight-dialog {
            animation: arcify-spotlight-show 0.2s ease-out;
        }

        @keyframes arcify-spotlight-show {
            from {
                opacity: 0;
                transform: translateX(-50%) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) scale(1);
            }
        }

        @media (max-width: 640px) {
            #arcify-spotlight-dialog {
                width: 95vw;
                margin: 20px auto;
            }
            
            #arcify-spotlight-dialog .arcify-spotlight-input {
                font-size: 16px !important;
            }
        }
    `,a=document.createElement("style");a.id="arcify-spotlight-styles",a.textContent=i,document.head.appendChild(a);const s=document.createElement("dialog");s.id="arcify-spotlight-dialog",s.innerHTML=`
        <div class="arcify-spotlight-container">
            <div class="arcify-spotlight-input-wrapper">
                <svg class="arcify-spotlight-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input 
                    type="text" 
                    class="arcify-spotlight-input" 
                    placeholder="${n===p.NEW_TAB?"Search or enter URL (opens in new tab)...":"Search or enter URL..."}"
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
    `,document.body.appendChild(s);const u=s.querySelector(".arcify-spotlight-input"),f=s.querySelector(".arcify-spotlight-results");let b=[],w=null,y=[];async function O(r,d){return await g.getSuggestions(r,d)}async function j(r,d){return await g.handleResult(r,d)}let R=!1;const Y=(r,d)=>{R=!0,r&&r.metadata&&r.metadata.query?u.value=r.metadata.query:r&&r.url?u.value=r.url:r&&r.title?u.value=r.title:u.value=""},A=new V(f,Y);async function D(){try{w=null;const r=n===p.NEW_TAB?"new-tab":"current-tab";y=await O("",r)||[],v()}catch(r){c.error("[Spotlight] Error loading initial results:",r),w=null,y=[],L()}}n===p.CURRENT_TAB&&window.arcifyCurrentTabUrl?(u.value=window.arcifyCurrentTabUrl,setTimeout(()=>{P(),z()},10)):L();function P(){const r=u.value.trim();if(!r){w=null,D();return}w=l.generateInstantSuggestion(r),v()}async function z(){const r=u.value.trim();if(!r){y=[],v();return}try{const d=n===p.NEW_TAB?"new-tab":"current-tab";y=await O(r,d)||[],v()}catch(d){c.error("[Spotlight] Search error:",d),y=[],v()}}function K(){return h.combineResults(w,y)}function v(){if(b=K(),A.updateResults(b),b.length===0){L();return}const r=n===p.NEW_TAB?"new-tab":"current-tab";h.updateResultsDisplay(f,[],b,r)}function L(){f.innerHTML='<div class="arcify-spotlight-empty">Start typing to search tabs, bookmarks, and history</div>',b=[],w=null,y=[],A.updateResults([])}const Z=h.createInputHandler(P,z,150);u.addEventListener("input",r=>{if(R){R=!1;return}Z(r)});async function B(r){if(!r){c.error("[Spotlight] No result provided");return}try{const d=n===p.NEW_TAB?"new-tab":"current-tab";C(),await j(r,d)}catch(d){c.error("[Spotlight] Error in result action:",d)}}u.addEventListener("keydown",h.createKeyDownHandler(A,r=>B(r),()=>C())),h.setupResultClickHandling(f,(r,d)=>B(r),()=>b);function C(){s.close(),g.notifyClosed(),setTimeout(()=>{s.parentNode&&(s.parentNode.removeChild(s),a.parentNode.removeChild(a),window.arcifySpotlightInjected=!1)},200)}s.addEventListener("click",r=>{r.target===s&&C()}),s.addEventListener("close",C),g.setupGlobalCloseListener(()=>{const r=document.getElementById("arcify-spotlight-dialog");r&&r.open&&C()}),s.showModal(),g.notifyOpened(),u.focus(),u.select(),u.scrollLeft=0,(async()=>{try{const r=await g.getActiveSpaceColor();if(r!==e){const d=await l.getAccentColorCSS(r),E=document.querySelector("#arcify-spotlight-styles");if(E){const H=/:root\s*{([^}]*)}/,Q=E.textContent,G=d.match(H);if(G){const X=Q.replace(H,G[0]);E.textContent=X}}}}catch(r){c.error("[Spotlight] Error updating active space color:",r)}u.value.trim()||D()})()}window.arcifySpotlightTabMode&&U(window.arcifySpotlightTabMode)})();
