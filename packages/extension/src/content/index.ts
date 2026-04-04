const API_BASE = "http://localhost:3001/api";

interface Ad {
  id: string;
  imageUrl: string;
  targetUrl: string;
  title: string;
}

let activeSessions: Map<string, string> = new Map(); // adId -> sessionId

async function fetchActiveAds(): Promise<Ad[]> {
  try {
    const res = await fetch(`${API_BASE}/ads/active`);
    const data = await res.json();
    return data.ads;
  } catch {
    return [];
  }
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
    await fetch(`${API_BASE}/views/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // silent fail
  }
}

async function getUserId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get("userId", (data) => {
      resolve(data.userId || "anonymous");
    });
  });
}

function createSidebar(ads: Ad[]) {
  const sidebar = document.createElement("div");
  sidebar.id = "hat-sidebar";

  sidebar.innerHTML = `
    <div class="hat-header">
      <span>HAT Ads</span>
      <span id="hat-session-earnings">0 HAT</span>
    </div>
    <div class="hat-earnings">Earn HAT & USDC by viewing ads</div>
    ${ads
      .map(
        (ad) => `
      <div class="hat-ad-slot" data-ad-id="${ad.id}">
        <a href="${ad.targetUrl}" target="_blank">
          <img src="${ad.imageUrl}" alt="${ad.title}" />
        </a>
        <div class="hat-ad-label">Sponsored · ${ad.title}</div>
      </div>
    `
      )
      .join("")}
  `;

  document.body.appendChild(sidebar);
  document.body.classList.add("hat-active");

  // Track ad visibility with IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        const adId = (entry.target as HTMLElement).dataset.adId!;
        if (entry.isIntersecting && !activeSessions.has(adId)) {
          const sessionId = await startViewSession(adId);
          if (sessionId) activeSessions.set(adId, sessionId);
        } else if (!entry.isIntersecting && activeSessions.has(adId)) {
          await endViewSession(activeSessions.get(adId)!);
          activeSessions.delete(adId);
        }
      });
    },
    { threshold: 0.5 }
  );

  sidebar.querySelectorAll(".hat-ad-slot").forEach((slot) => observer.observe(slot));
}

// Also replace existing ad iframes/divs with HAT ads
function replaceExistingAds(ads: Ad[]) {
  const adSelectors = [
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'div[id*="google_ads"]',
    'ins.adsbygoogle',
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
          <a href="${ad.targetUrl}" target="_blank">
            <img src="${ad.imageUrl}" alt="${ad.title}" style="width:100%;border-radius:8px;" />
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
  activeSessions.forEach((sessionId) => {
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
