export {}; // ensure this file is treated as a module

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
  image_wide?: string;  // leaderboard format (e.g. 728x90)
  image_tall?: string;  // skyscraper format (e.g. 160x600)
  target_url: string;
  title: string;
}

type SlotShape = "standard" | "wide" | "tall";

/** Classify a slot by its aspect ratio */
function classifySlot(w: number, h: number): SlotShape {
  if (w <= 0 || h <= 0) return "standard";
  // Very short slots — text strip only, image would be unreadable
  if (h < 60) return "wide";
  const ratio = w / h;
  // Only use text strip for extreme leaderboard shapes (728x90, 320x50, 468x60)
  if (ratio >= 5) return "wide";
  if (ratio <= 0.6) return "tall"; // skyscraper-like (160x600 = 0.27:1, 300x600 = 0.5:1)
  return "standard";               // everything else gets an image with object-fit:cover
}

/** Pick the best image URL for a given slot shape */
function pickImage(ad: Ad, shape: SlotShape): string {
  if (shape === "wide" && ad.image_wide) return ad.image_wide;
  if (shape === "tall" && ad.image_tall) return ad.image_tall;
  return ad.image_url;
}

const activeSessions = new Map<string, { sessionId: string; heartbeatTimer: number }>();
const replacedElements = new WeakSet<Element>();
let cachedAds: Ad[] = [];
let sidebarCollapsed = false;

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

async function reportClick(adId: string, sessionId?: string) {
  try {
    const userId = await getUserId();
    const res = await fetch(`${API_BASE}/views/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, adId, sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.usdcReward > 0) {
        chrome.runtime.sendMessage({
          type: "UPDATE_EARNINGS",
          hat: data.hatReward,
          usdc: data.usdcReward,
        });
        updateEarningsDisplay();
      }
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
      el.textContent = `$${(data.usdcEarned || 0).toFixed(4)} USDC · ${Math.floor(data.hatEarned || 0)} HAT`;
    }
  });
}

// Sync earnings from backend so they persist across page reloads
async function syncEarningsFromBackend() {
  try {
    const userId = await getUserId();
    if (userId === "anonymous") return;
    const res = await fetch(`${API_BASE}/auth/user/${userId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.totalUsdcEarned !== undefined) {
      chrome.storage.local.set({
        usdcEarned: data.totalUsdcEarned,
        hatEarned: data.totalHatEarned,
      });
      updateEarningsDisplay();
    }
  } catch {
    // silent
  }
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
  // Sponsored links (Adform, affiliate networks)
  'a[href*="adform.net"]',
  'a[href*="adclick"]',
  'a[rel*="sponsored"]',
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
  if (/ad[sx]?\.|banner|sponsor|promo|click|track|doubleclick|googlesyndication|adx\.ws|sevio|adform\.net/i.test(src)) return true;
  // Check parent — if parent is an ad container, iframe is an ad
  const parent = el.parentElement;
  if (parent && parent.matches?.(COMBINED_SELECTOR)) return true;
  return false;
}

// ── Smart ad rotation ───────────────────────────────────────
// Each slot gets a unique ad. On each rotation cycle, every slot
// advances to the next ad it hasn't recently shown, with a smooth
// crossfade transition. No two visible slots show the same ad at
// the same time (when enough ads are available).

const ROTATION_INTERVAL = 12_000; // 12s between rotations
const CROSSFADE_MS = 600;

interface SlotState {
  container: HTMLElement;
  adIndex: number;
  shape: SlotShape;
  size?: { width: string; height: string };
}

const activeSlots: SlotState[] = [];
let rotationTimer: number | null = null;

/** Fisher-Yates shuffle, returns new array */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build an assignment of ad indices to N slots so no index repeats (if possible) */
function assignUniqueIndices(slotCount: number, adCount: number, avoid: number[]): number[] {
  if (adCount === 0) return [];
  if (adCount === 1) return Array(slotCount).fill(0);

  // Build pool: all indices shuffled, try to avoid the ones in `avoid`
  const pool = shuffle([...Array(adCount).keys()]);
  const result: number[] = [];
  const used = new Set<number>();

  for (let i = 0; i < slotCount; i++) {
    // Prefer an index not used in this batch AND different from what the slot previously showed
    let pick = pool.find((idx) => !used.has(idx) && idx !== avoid[i]);
    // Fall back: any unused index
    if (pick === undefined) pick = pool.find((idx) => !used.has(idx));
    // Last resort: wrap (more slots than ads)
    if (pick === undefined) {
      used.clear();
      pick = pool.find((idx) => idx !== avoid[i]) ?? pool[0];
    }
    result.push(pick);
    used.add(pick);
  }
  return result;
}

/** Native HTML strip for wide/leaderboard slots — thumbnail + text */
function buildWideAdHtml(ad: Ad): string {
  const accents = ["#6366f1", "#e11d48", "#d97706"];
  const accent = accents[Math.abs(hashStr(ad.id)) % accents.length];
  return `
    <a href="${ad.target_url}" target="_blank" rel="noopener"
      style="display:flex;align-items:center;width:100%;height:100%;padding:0 10px;gap:10px;
        text-decoration:none;border-radius:10px;overflow:hidden;background:#ffffff;">
      <img src="${ad.image_url}" alt="${ad.title}"
        style="flex-shrink:0;height:80%;max-height:100%;width:auto;object-fit:contain;border-radius:6px;" />
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#1e1b4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:system-ui,-apple-system,sans-serif;">
          ${ad.title}
        </div>
      </div>
      <div style="flex-shrink:0;padding:6px 14px;border-radius:8px;
        background:${accent};
        font-size:11px;font-weight:700;color:#fff;font-family:system-ui;white-space:nowrap;">
        Learn More
      </div>
      <div style="flex-shrink:0;font-size:9px;color:#9ca3af;font-family:system-ui;
        padding-left:8px;border-left:1px solid #e5e7eb;white-space:nowrap;">
        HAT Ad
      </div>
    </a>
  `;
}

function buildAdHtml(ad: Ad, shape: SlotShape = "standard"): string {
  // Wide slots get a native HTML strip instead of a scaled image
  if (shape === "wide") return buildWideAdHtml(ad);

  const imgSrc = pickImage(ad, shape);
  return `
    <a href="${ad.target_url}" target="_blank" rel="noopener"
      style="display:block;width:100%;height:100%;border-radius:12px;overflow:hidden;
        background:#ffffff;">
      <img src="${imgSrc}" alt="${ad.title}"
        style="width:100%;height:100%;object-fit:contain;background:#ffffff;transition:transform .2s,filter .2s;"
        onmouseenter="this.style.transform='scale(1.02)';this.style.filter='brightness(1.05)'"
        onmouseleave="this.style.transform='none';this.style.filter='none'" />
    </a>
    <div style="position:absolute;bottom:6px;right:8px;font-size:10px;color:#6b7280;
      background:rgba(255,255,255,0.9);backdrop-filter:blur(8px);padding:3px 8px;border-radius:8px;
      border:1px solid #e5e7eb;font-weight:500;">
      HAT · ${ad.title}
    </div>
  `;
}

/** Simple string hash for deterministic color picking */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function createHatAd(ad: Ad, shape: SlotShape = "standard", matchedSize?: { width: string; height: string }): HTMLElement {
  const container = document.createElement("div");
  container.className = "hat-replaced-ad";
  container.dataset.adId = ad.id;
  container.style.cssText = `
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    overflow:hidden;border-radius:12px;border:1px solid rgba(99,102,241,0.15);
    background:#ffffff;
    box-shadow:0 2px 12px rgba(99,102,241,0.06);position:relative;
    transition:opacity ${CROSSFADE_MS}ms ease;
    ${matchedSize ? `width:${matchedSize.width};height:${matchedSize.height};` : "padding:12px;"}
  `;
  container.innerHTML = buildAdHtml(ad, shape);

  // Intercept clicks to report click-through reward
  container.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest("a");
    if (link && link.href) {
      const session = activeSessions.get(ad.id);
      reportClick(ad.id, session?.sessionId);
    }
  });

  return container;
}

/** Crossfade a slot to a new ad */
function transitionSlot(slot: SlotState, newAd: Ad) {
  const el = slot.container;
  // End current view session
  const oldAdId = el.dataset.adId!;
  if (activeSessions.has(oldAdId)) {
    const session = activeSessions.get(oldAdId)!;
    clearInterval(session.heartbeatTimer);
    endViewSession(session.sessionId);
    activeSessions.delete(oldAdId);
  }

  // Fade out
  el.style.opacity = "0";
  setTimeout(() => {
    el.dataset.adId = newAd.id;
    el.innerHTML = buildAdHtml(newAd, slot.shape);
    // Fade in
    el.style.opacity = "1";
    // Start new view tracking
    viewObserver.unobserve(el);
    viewObserver.observe(el);
  }, CROSSFADE_MS);
}

/** Rotate all active slots to their next ad */
function rotateAllSlots() {
  if (cachedAds.length <= 1 || activeSlots.length === 0) return;

  const currentIndices = activeSlots.map((s) => s.adIndex);
  const newIndices = assignUniqueIndices(activeSlots.length, cachedAds.length, currentIndices);

  // Stagger the transitions slightly for a wave effect
  activeSlots.forEach((slot, i) => {
    const newIdx = newIndices[i];
    if (newIdx === slot.adIndex) return; // same ad, skip
    setTimeout(() => {
      slot.adIndex = newIdx;
      transitionSlot(slot, cachedAds[newIdx]);
    }, i * 150); // 150ms stagger between slots
  });
}

function startRotationTimer() {
  if (rotationTimer !== null) return;
  rotationTimer = window.setInterval(rotateAllSlots, ROTATION_INTERVAL);
}

function replaceElement(el: Element) {
  if (replacedElements.has(el)) return;
  if (cachedAds.length === 0) return;
  // Don't replace our own elements
  if ((el as HTMLElement).closest?.("#hat-sidebar")) return;
  if (el.classList?.contains("hat-replaced-ad")) return;

  const rect = el.getBoundingClientRect();
  const w = rect.width || (el as HTMLElement).offsetWidth || 0;
  const h = rect.height || (el as HTMLElement).offsetHeight || 0;

  // Pick an ad index unique from other active slots
  const usedIndices = activeSlots.map((s) => s.adIndex);
  const newIndices = assignUniqueIndices(1, cachedAds.length, usedIndices);
  const adIndex = newIndices[0];
  const ad = cachedAds[adIndex];

  const size = w > 10 && h > 10
    ? { width: `${w}px`, height: `${h}px` }
    : undefined;
  const shape = classifySlot(w, h);

  const hatAd = createHatAd(ad, shape, size);
  replacedElements.add(hatAd);

  const slot: SlotState = { container: hatAd, adIndex, shape, size };
  activeSlots.push(slot);

  el.replaceWith(hatAd);
  viewObserver.observe(hatAd);

  startRotationTimer();
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

// ── Sidebar with rotation ───────────────────────────────────

const sidebarSlots: { el: HTMLElement; adIndex: number }[] = [];

function buildSidebarSlotHtml(ad: Ad): string {
  return `
    <a href="${ad.target_url}" target="_blank">
      <img src="${ad.image_url}" alt="${ad.title}" />
    </a>
    <div class="hat-ad-label">${ad.title}</div>
  `;
}

function rotateSidebarSlots() {
  if (cachedAds.length <= 1 || sidebarSlots.length === 0) return;

  const currentIndices = sidebarSlots.map((s) => s.adIndex);
  const newIndices = assignUniqueIndices(sidebarSlots.length, cachedAds.length, currentIndices);

  sidebarSlots.forEach((slot, i) => {
    const newIdx = newIndices[i];
    if (newIdx === slot.adIndex) return;

    setTimeout(() => {
      const oldAdId = slot.el.dataset.adId!;
      if (activeSessions.has(oldAdId)) {
        const session = activeSessions.get(oldAdId)!;
        clearInterval(session.heartbeatTimer);
        endViewSession(session.sessionId);
        activeSessions.delete(oldAdId);
      }

      slot.el.style.opacity = "0";
      slot.el.style.transform = "translateY(4px)";
      setTimeout(() => {
        const ad = cachedAds[newIdx];
        slot.adIndex = newIdx;
        slot.el.dataset.adId = ad.id;
        slot.el.innerHTML = buildSidebarSlotHtml(ad);
        slot.el.style.opacity = "1";
        slot.el.style.transform = "none";
        viewObserver.unobserve(slot.el);
        viewObserver.observe(slot.el);
      }, CROSSFADE_MS);
    }, i * 200);
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById("hat-sidebar");
  if (!sidebar) return;

  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle("hat-collapsed", sidebarCollapsed);
  document.body.classList.toggle("hat-active", !sidebarCollapsed);
  document.body.classList.toggle("hat-collapsed-active", sidebarCollapsed);

  const toggle = sidebar.querySelector(".hat-toggle") as HTMLElement;
  if (toggle) toggle.textContent = sidebarCollapsed ? "◀" : "▶";

  // Pause/resume sidebar ad sessions when collapsing/expanding
  if (sidebarCollapsed) {
    sidebarSlots.forEach((slot) => {
      const adId = slot.el.dataset.adId!;
      if (activeSessions.has(adId)) {
        const session = activeSessions.get(adId)!;
        clearInterval(session.heartbeatTimer);
        endViewSession(session.sessionId);
        activeSessions.delete(adId);
      }
    });
  } else {
    sidebarSlots.forEach((s) => {
      viewObserver.unobserve(s.el);
      viewObserver.observe(s.el);
    });
  }

  chrome.storage.local.set({ sidebarCollapsed });
}

function createSidebar(ads: Ad[]) {
  const sidebar = document.createElement("div");
  sidebar.id = "hat-sidebar";

  // Restore collapse state
  chrome.storage.local.get("sidebarCollapsed", (data) => {
    if (data.sidebarCollapsed) {
      sidebarCollapsed = true;
      sidebar.classList.add("hat-collapsed");
      document.body.classList.remove("hat-active");
      document.body.classList.add("hat-collapsed-active");
      const toggle = sidebar.querySelector(".hat-toggle") as HTMLElement;
      if (toggle) toggle.textContent = "◀";
    }
  });

  // Show up to 3 unique sidebar slots (or fewer if not enough ads)
  const slotCount = Math.min(3, ads.length);
  const indices = assignUniqueIndices(slotCount, ads.length, []);

  sidebar.innerHTML = `
    <div class="hat-header">
      <div class="hat-header-top">
        <div class="hat-header-brand">
          <div class="hat-logo-icon">H</div>
          <div class="hat-header-info">
            <span class="hat-header-title">HAT</span>
            <span class="hat-header-sub">Human Attention Token</span>
          </div>
        </div>
        <button class="hat-toggle" title="Toggle sidebar">▶</button>
      </div>
      <div class="hat-earnings-pill" id="hat-session-earnings">$0.00 USDC · 0 HAT</div>
    </div>
    <div class="hat-sidebar-body">
      <div class="hat-earnings">Earning USDC nanopayments + HAT bonus</div>
    </div>
  `;

  const body = sidebar.querySelector(".hat-sidebar-body")!;
  for (let i = 0; i < slotCount; i++) {
    const ad = ads[indices[i]];
    const slotEl = document.createElement("div");
    slotEl.className = "hat-ad-slot";
    slotEl.dataset.adId = ad.id;
    slotEl.style.cssText = `transition: opacity ${CROSSFADE_MS}ms ease, transform ${CROSSFADE_MS}ms ease;`;
    slotEl.innerHTML = buildSidebarSlotHtml(ad);
    body.appendChild(slotEl);
    sidebarSlots.push({ el: slotEl, adIndex: indices[i] });
  }

  sidebar.querySelector(".hat-toggle")!.addEventListener("click", toggleSidebar);

  document.body.appendChild(sidebar);
  document.body.classList.add("hat-active");
  updateEarningsDisplay();

  sidebarSlots.forEach((s) => viewObserver.observe(s.el));

  // Rotate sidebar ads on the same interval
  setInterval(rotateSidebarSlots, ROTATION_INTERVAL);
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

// ── Init — only activate when user has connected a wallet ────

let initialized = false;

async function activate() {
  if (initialized) return;
  initialized = true;

  cachedAds = await fetchActiveAds();
  if (cachedAds.length === 0) return;

  createSidebar(cachedAds);

  // Sync earnings from backend frequently
  syncEarningsFromBackend();
  setInterval(syncEarningsFromBackend, 5_000);

  // Initial scan
  scanAndReplace();

  // Watch for dynamically injected ads + attribute changes (React, SPA)
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "id", "data-ad", "data-ad-slot"],
  });

  // Re-scan periodically for SPAs that swap page content
  setInterval(scanAndReplace, 8000);
}

function deactivate() {
  if (!initialized) return;
  initialized = false;

  // End all active sessions
  activeSessions.forEach(({ sessionId, heartbeatTimer }) => {
    clearInterval(heartbeatTimer);
    navigator.sendBeacon(`${API_BASE}/views/end`, JSON.stringify({ sessionId }));
  });
  activeSessions.clear();

  // Remove sidebar
  const sidebar = document.getElementById("hat-sidebar");
  if (sidebar) sidebar.remove();
  document.body.classList.remove("hat-active", "hat-collapsed-active");

  // Remove all replaced ads (they'll revert on next page load)
  sidebarSlots.length = 0;
  cachedAds = [];
}

function checkAuthAndActivate() {
  chrome.storage.local.get("userId", (data) => {
    if (data.userId && data.userId !== "anonymous") {
      activate();
    } else {
      deactivate();
    }
  });
}

// Listen for World ID verification messages from the web app
window.addEventListener("message", (event) => {
  if (event.data?.type === "HAT_WORLD_ID_VERIFIED" && event.data.address) {
    chrome.storage.local.set({
      userId: event.data.address,
      verified: true,
      nullifier: event.data.nullifier,
    });
  }
});

// Check on page load
checkAuthAndActivate();

// Also listen for storage changes — if user connects wallet while page is open,
// activate immediately without requiring a refresh
chrome.storage.onChanged.addListener((changes) => {
  if (changes.userId) {
    if (changes.userId.newValue && changes.userId.newValue !== "anonymous") {
      activate();
    } else {
      // Disconnected — remove sidebar and stop sessions
      deactivate();
    }
  }
  if (changes.usdcEarned || changes.hatEarned) {
    updateEarningsDisplay();
  }
});

// Detect wallet account changes via window.ethereum
try {
  const eth = (window as unknown as { ethereum?: { on?: (event: string, handler: (accounts: string[]) => void) => void } }).ethereum;
  if (eth?.on) {
    eth.on("accountsChanged", (accounts: string[]) => {
      if (accounts.length === 0) {
        // Wallet disconnected — end all sessions
        activeSessions.forEach(({ sessionId, heartbeatTimer }) => {
          clearInterval(heartbeatTimer);
          endViewSession(sessionId);
        });
        activeSessions.clear();
        chrome.runtime.sendMessage({ type: "DISCONNECT" });
      } else {
        // Account switched — notify background to reset state
        chrome.runtime.sendMessage({ type: "ACCOUNT_CHANGED", address: accounts[0] });
        // End current sessions (they belong to the old address)
        activeSessions.forEach(({ sessionId, heartbeatTimer }) => {
          clearInterval(heartbeatTimer);
          endViewSession(sessionId);
        });
        activeSessions.clear();
        // Sync new account's earnings
        syncEarningsFromBackend();
      }
    });
  }
} catch {
  // not in a page with ethereum provider
}
