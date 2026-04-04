let API_BASE = "https://hat-backend.achim-d87.workers.dev/api";

// Allow override via extension storage
try {
  chrome.storage.local.get("apiBase", (data) => {
    if (data.apiBase) API_BASE = data.apiBase;
  });
} catch {
  // not in extension context
}

function updateUI(data: {
  hatEarned?: number;
  usdcEarned?: number;
  verified?: boolean;
  userId?: string;
}) {
  const hatEarnedEl = document.getElementById("hat-earned")!;
  const usdcEarnedEl = document.getElementById("usdc-earned")!;
  const verifiedEl = document.getElementById("verified-status")!;
  const verifyBtn = document.getElementById("verify-btn")!;
  const connectBtn = document.getElementById("connect-btn")!;
  const statusEl = document.getElementById("status")!;

  hatEarnedEl.textContent = String(Math.floor(data.hatEarned || 0));
  usdcEarnedEl.textContent = `$${(data.usdcEarned || 0).toFixed(4)}`;

  if (data.userId && data.userId !== "anonymous") {
    connectBtn.textContent = `${data.userId.slice(0, 6)}...${data.userId.slice(-4)}`;
    connectBtn.style.background = "#e5e7eb";
    connectBtn.style.color = "#374151";

    if (data.verified) {
      verifiedEl.textContent = "Verified Human";
      verifiedEl.style.color = "#16a34a";
      verifyBtn.textContent = "Verified";
      verifyBtn.style.background = "#16a34a";
      verifyBtn.disabled = true;
    } else {
      verifiedEl.textContent = "Not Verified";
      verifiedEl.style.color = "#dc2626";
    }

    statusEl.textContent = "Earning HAT for your attention";
  } else {
    statusEl.textContent = "Connect wallet to start earning";
  }
}

async function fetchLiveStats(address: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/user/${address}`);
    if (res.ok) {
      const data = await res.json();
      // Sync backend stats to extension storage
      chrome.storage.local.set({
        verified: data.verified,
        hatEarned: data.totalHatEarned,
        usdcEarned: data.totalUsdcEarned,
      });
      return data;
    }
  } catch {
    // offline or backend down
  }
  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  const verifyBtn = document.getElementById("verify-btn") as HTMLButtonElement;
  const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement;

  // Load current status from extension storage
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, async (data) => {
    if (data) {
      updateUI(data);

      // Also fetch live stats from backend if we have an address
      if (data.userId && data.userId !== "anonymous") {
        const live = await fetchLiveStats(data.userId);
        if (live) {
          updateUI({
            ...data,
            verified: live.verified,
            hatEarned: live.totalHatEarned,
            usdcEarned: live.totalUsdcEarned,
          });
        }
      }
    }
  });

  verifyBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:3000/verify" });
  });

  connectBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:3000" });
  });

  // Auto-refresh every 10 seconds while popup is open
  setInterval(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (data) => {
      if (data) updateUI(data);
    });
  }, 10_000);
});
