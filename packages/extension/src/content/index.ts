let API_BASE = "https://hat-backend.achim-d87.workers.dev/api";
const HEARTBEAT_INTERVAL = 15_000;

// Allow override via extension storage
try {
  chrome.storage.local.get("apiBase", (data) => {
    if (data.apiBase) API_BASE = data.apiBase;
  });
} catch {
  // not in extension context
}

interface Ad {
  id: string;
  image_url: string;
  target_url: string;
  title: string;
}

const activeSessions = new Map<string, { sessionId: string; heartbeatTimer: number }>();
const replacedElements = new WeakSet<Element>();
let cachedAds: Ad[] = [];

// ── API helpers ──────────────────────────────────────────────

async function fetchActiveAds(): Promise<Ad[]> {
  try {
    const res = await fetch(`${API_BASE}/ads/active`);
    const data = await res.json();
    return data.ads;
  } catch {
    return [];
  }
}

async function getUserId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get("userId", (data) => {
      resolve(data.userId || "anonymous");
    });
  });
}

async function startViewSession(adId: string): Promise<string | null> {
  try {
    const userId = await getUserId();
    const res = await fetch(`${API_BASE}/views/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, adId }),
    });
    const data = await res.json();
    return data.sessionId;
  } catch {
    return null;
  }
}

async function endViewSession(sessionId: string) {
  try {
    const res = await fetch(`${API_BASE}/views/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      chrome.runtime.sendMessage({
        type: "UPDATE_EARNINGS",
        hat: data.hatEarned,
        usdc: data.usdcEarned,
      });
      updateEarningsDisplay();
    }
  } catch {
    // silent
  }
}

async function sendHeartbeat(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/views/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Earnings display ─────────────────────────────────────────

function updateEarningsDisplay() {
  chrome.storage.local.get(["hatEarned", "usdcEarned"], (data) => {
    const el = document.getElementById("hat-session-earnings");
    if (el) {
      el.textContent = `${Math.floor(data.hatEarned || 0)} HAT · $${(data.usdcEarned || 0).toFixed(4)}`;
    }
  });
}

// ── View tracking via IntersectionObserver ────────────────────

const viewObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(async (entry) => {
      const adId = (entry.target as HTMLElement).dataset.adId!;
      if (entry.isIntersecting && !activeSessions.has(adId)) {
        const sessionId = await startViewSession(adId);
        if (sessionId) {
          const heartbeatTimer = window.setInterval(async () => {
            const alive = await sendHeartbeat(sessionId);
            if (!alive) {
              clearInterval(heartbeatTimer);
              activeSessions.delete(adId);
            }
          }, HEARTBEAT_INTERVAL);
          activeSessions.set(adId, { sessionId, heartbeatTimer });
        }
      } else if (!entry.isIntersecting && activeSessions.has(adId)) {
        const session = activeSessions.get(adId)!;
        clearInterval(session.heartbeatTimer);
        await endViewSession(session.sessionId);
        activeSessions.delete(adId);
      }
    });
  },
  { threshold: 0.5 }
);

// ── Ad replacement ───────────────────────────────────────────

// CSS selectors that match common ad containers across the web
const AD_SELECTORS = [
  // HAT demo placeholder
  "#hat-demo-ad",
  // Google Ads
  "ins.adsbygoogle",
  'div[id*="google_ads"]',
  'div[id*="div-gpt-ad"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication"]',
  'iframe[id*="google_ads"]',
  // Generic ad containers (class/id patterns)
  'div[class*="ad-container"]',
  'div[class*="ad-wrapper"]',
  'div[class*="ad-slot"]',
  'div[class*="ad-banner"]',
  'div[class*="ad-unit"]',
  'div[class*="advertisement"]',
  'div[id*="ad-container"]',
  'div[id*="ad-wrapper"]',
  'div[id*="ad-slot"]',
  'div[id*="ad-banner"]',
  'div[id*="advertisement"]',
  'aside[class*="ad"]',
  'section[class*="ad-"]',
  // Data attribute patterns
  'div[data-ad]',
  'div[data-ad-slot]',
  'div[data-ad-unit]',
  'div[data-adunit]',
  // Amazon ads
  'div[class*="amzn-ad"]',
  // Carbon ads
  "#carbonads",
  ".carbonad",
  // BuySellAds
  "#bsap",
  ".bsa-cpc",
  // Media.net
  'div[id*="media_net"]',
  // Taboola / Outbrain
  'div[class*="taboola"]',
  'div[class*="outbrain"]',
  'div[id*="taboola"]',
  'div[id*="outbrain"]',
  // Sevio / adx.ws
  "div.sevioads",
  'div[id^="wrapper-sevio"]',
  'div[id^="sevio_iframe"]',
  'div[id^="sevio-ad"]',
  'iframe[src*="adx.ws"]',
  // Generic ad iframes with data: URIs containing ad content
  'iframe[id*="tb-iframe"]',
  // Catch-all: any element with exact id "ad-container"
  "#ad-container",
];

const COMBINED_SELECTOR = AD_SELECTORS.join(", ");

// Heuristic: detect ad-like iframes by size (common banner dimensions)
const AD_SIZES = new Set([
  "728x90", "300x250", "160x600", "320x50", "320x100", "970x250",
  "336x280", "300x600", "970x90", "250x250", "200x200", "468x60",
  "120x600", "320x480", "300x50", "300x100", "970x66",
]);

function isAdLikeIframe(el: HTMLIFrameElement): boolean {
  const w = el.width || String(el.offsetWidth);
  const h = el.height || String(el.offsetHeight);
  if (AD_SIZES.has(`${w}x${h}`)) return true;
  const src = el.src || "";
  // data: URI iframes are almost always ads (inline ad content)
  if (src.startsWith("data:") && src.length > 200) return true;
  // Known ad network patterns in src
  if (/ad[sx]?\.|banner|sponsor|promo|click|track|doubleclick|googlesyndication|adx\.ws|sevio/i.test(src)) return true;
  // Check parent — if parent is an ad container, iframe is an ad
  const parent = el.parentElement;
  if (parent && parent.matches?.(COMBINED_SELECTOR)) return true;
  return false;
}

let adRotationIndex = 0;

function createHatAd(ad: Ad, matchedSize?: { width: string; height: string }): HTMLElement {
  const container = document.createElement("div");
  container.className = "hat-replaced-ad";
  container.dataset.adId = ad.id;
  container.style.cssText = `
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    overflow:hidden;border-radius:12px;border:1px solid rgba(99,102,241,0.15);
    background:rgba(15,11,46,0.04);backdrop-filter:blur(8px);
    box-shadow:0 2px 12px rgba(99,102,241,0.06);position:relative;
    ${matchedSize ? `width:${matchedSize.width};height:${matchedSize.height};` : "padding:12px;"}
  `;
  container.innerHTML = `
    <a href="${ad.target_url}" target="_blank" rel="noopener" style="display:block;width:100%;height:100%;border-radius:12px;overflow:hidden;">
      <img src="${ad.image_url}" alt="${ad.title}"
        style="width:100%;height:100%;object-fit:cover;transition:transform .2s,filter .2s;"
        onmouseenter="this.style.transform='scale(1.02)';this.style.filter='brightness(1.05)'"
        onmouseleave="this.style.transform='none';this.style.filter='none'" />
    </a>
    <div style="position:absolute;bottom:6px;right:8px;font-size:10px;color:rgba(255,255,255,0.7);
      background:rgba(15,11,46,0.65);backdrop-filter:blur(8px);padding:3px 8px;border-radius:8px;
      border:1px solid rgba(255,255,255,0.08);font-weight:500;">
      HAT · ${ad.title}
    </div>
  `;
  return container;
}

function replaceElement(el: Element) {
  if (replacedElements.has(el)) return;
  if (cachedAds.length === 0) return;
  // Don't replace our own elements
  if ((el as HTMLElement).closest?.("#hat-sidebar")) return;
  if (el.classList?.contains("hat-replaced-ad")) return;

  const rect = el.getBoundingClientRect();
  // Use offsetWidth/offsetHeight as fallback (works before layout)
  const w = rect.width || (el as HTMLElement).offsetWidth || 0;
  const h = rect.height || (el as HTMLElement).offsetHeight || 0;

  const ad = cachedAds[adRotationIndex % cachedAds.length];
  adRotationIndex++;

  const size = w > 10 && h > 10
    ? { width: `${w}px`, height: `${h}px` }
    : undefined; // let it auto-size

  const hatAd = createHatAd(ad, size);
  replacedElements.add(hatAd);

  el.replaceWith(hatAd);
  viewObserver.observe(hatAd);
}

function scanAndReplace() {
  if (cachedAds.length === 0) return;

  // Collect all ad elements, preferring outermost container
  const toReplace = new Set<Element>();

  // 1. CSS selector matches
  document.querySelectorAll(COMBINED_SELECTOR).forEach((el) => {
    if (!replacedElements.has(el)) toReplace.add(el);
  });

  // 2. Ad-like iframes by heuristic
  document.querySelectorAll("iframe").forEach((iframe) => {
    if (replacedElements.has(iframe)) return;
    if (!isAdLikeIframe(iframe)) return;
    // Prefer replacing the parent ad container over just the iframe
    const parent = iframe.parentElement;
    if (parent && parent.matches?.(COMBINED_SELECTOR) && !replacedElements.has(parent)) {
      toReplace.add(parent);
    } else {
      toReplace.add(iframe);
    }
  });

  // 3. Filter out children whose parent is also being replaced
  for (const el of toReplace) {
    let dominated = false;
    for (const other of toReplace) {
      if (other !== el && other.contains(el)) {
        dominated = true;
        break;
      }
    }
    if (!dominated) replaceElement(el);
  }
}

// ── MutationObserver: catch dynamically loaded ads ───────────
// Debounced: batch DOM changes and scan once per animation frame

let scanScheduled = false;

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanAndReplace();
    scanScheduled = false;
  });
}

const mutationObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Any new nodes or attribute changes could mean new ads
    if (mutation.addedNodes.length > 0 || mutation.type === "attributes") {
      scheduleScan();
      return; // one scan covers everything
    }
  }
});

// ── Sidebar ──────────────────────────────────────────────────

function createSidebar(ads: Ad[]) {
  const sidebar = document.createElement("div");
  sidebar.id = "hat-sidebar";

  sidebar.innerHTML = `
    <div class="hat-header">
      <span>HAT</span>
      <span id="hat-session-earnings" style="font-size:12px;font-weight:600;color:#fbbf24;">0 HAT · $0.00</span>
    </div>
    <div class="hat-earnings">Earning rewards for your attention</div>
    ${ads
      .map(
        (ad) => `
      <div class="hat-ad-slot" data-ad-id="${ad.id}">
        <a href="${ad.target_url}" target="_blank">
          <img src="${ad.image_url}" alt="${ad.title}" />
        </a>
        <div class="hat-ad-label">${ad.title}</div>
      </div>
    `
      )
      .join("")}
  `;

  document.body.appendChild(sidebar);
  document.body.classList.add("hat-active");
  updateEarningsDisplay();

  sidebar.querySelectorAll(".hat-ad-slot").forEach((slot) => viewObserver.observe(slot));
}

// ── Cleanup on unload ────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  activeSessions.forEach(({ sessionId, heartbeatTimer }) => {
    clearInterval(heartbeatTimer);
    navigator.sendBeacon(
      `${API_BASE}/views/end`,
      JSON.stringify({ sessionId })
    );
  });
});

// ── Init ─────────────────────────────────────────────────────

(async () => {
  cachedAds = await fetchActiveAds();
  if (cachedAds.length === 0) return;

  createSidebar(cachedAds);

  // Initial scan
  scanAndReplace();

  // Watch for dynamically injected ads + attribute changes (React, SPA)
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "id", "data-ad", "data-ad-slot"],
  });

  // Re-scan periodically — SPAs can swap entire page content
  let scanCount = 0;
  const scanInterval = setInterval(() => {
    scanAndReplace();
    scanCount++;
    if (scanCount >= 12) clearInterval(scanInterval); // 60s total
  }, 5000);
})();
