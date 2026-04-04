const API_BASE = "http://localhost:3001/api";
const HEARTBEAT_INTERVAL = 15_000; // 15 seconds

interface Ad {
  id: string;
  image_url: string;
  target_url: string;
  title: string;
}

const activeSessions = new Map<string, { sessionId: string; heartbeatTimer: number }>();

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
      // Update earnings in extension storage
      chrome.runtime.sendMessage({
        type: "UPDATE_EARNINGS",
        hat: data.hatEarned,
        usdc: data.usdcEarned,
      });
      updateEarningsDisplay();
    }
  } catch {
    // silent fail
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

function updateEarningsDisplay() {
  chrome.storage.local.get(["hatEarned", "usdcEarned"], (data) => {
    const el = document.getElementById("hat-session-earnings");
    if (el) {
      el.textContent = `${Math.floor(data.hatEarned || 0)} HAT · $${(data.usdcEarned || 0).toFixed(4)}`;
    }
  });
}

function createSidebar(ads: Ad[]) {
  const sidebar = document.createElement("div");
  sidebar.id = "hat-sidebar";

  sidebar.innerHTML = `
    <div class="hat-header">
      <span>HAT Ads</span>
      <span id="hat-session-earnings">0 HAT · $0.00</span>
    </div>
    <div class="hat-earnings">Earn HAT & USDC by viewing ads</div>
    ${ads
      .map(
        (ad) => `
      <div class="hat-ad-slot" data-ad-id="${ad.id}">
        <a href="${ad.target_url}" target="_blank">
          <img src="${ad.image_url}" alt="${ad.title}" />
        </a>
        <div class="hat-ad-label">Sponsored · ${ad.title}</div>
      </div>
    `
      )
      .join("")}
  `;

  document.body.appendChild(sidebar);
  document.body.classList.add("hat-active");
  updateEarningsDisplay();

  // Track ad visibility with IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        const adId = (entry.target as HTMLElement).dataset.adId!;
        if (entry.isIntersecting && !activeSessions.has(adId)) {
          const sessionId = await startViewSession(adId);
          if (sessionId) {
            // Start heartbeat loop
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

  sidebar.querySelectorAll(".hat-ad-slot").forEach((slot) => observer.observe(slot));
}

// Replace existing ad iframes/divs with HAT ads
function replaceExistingAds(ads: Ad[]) {
  const adSelectors = [
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'div[id*="google_ads"]',
    "ins.adsbygoogle",
  ];

  let adIndex = 0;
  adSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (adIndex < ads.length) {
        const ad = ads[adIndex % ads.length];
        const replacement = document.createElement("div");
        replacement.className = "hat-ad-slot";
        replacement.dataset.adId = ad.id;
        replacement.innerHTML = `
          <a href="${ad.target_url}" target="_blank">
            <img src="${ad.image_url}" alt="${ad.title}" style="width:100%;border-radius:8px;" />
          </a>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">HAT Ad · ${ad.title}</div>
        `;
        el.replaceWith(replacement);
        adIndex++;
      }
    });
  });
}

// End all sessions on page unload
window.addEventListener("beforeunload", () => {
  activeSessions.forEach(({ sessionId, heartbeatTimer }) => {
    clearInterval(heartbeatTimer);
    navigator.sendBeacon(
      `${API_BASE}/views/end`,
      JSON.stringify({ sessionId })
    );
  });
});

// Init
(async () => {
  const ads = await fetchActiveAds();
  if (ads.length > 0) {
    createSidebar(ads);
    replaceExistingAds(ads);
  }
})();
