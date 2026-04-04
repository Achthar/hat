let API_BASE = "https://hat-backend.achim-d87.workers.dev/api";

// Allow override via extension storage
try {
  chrome.storage.local.get("apiBase", (data) => {
    if (data.apiBase) API_BASE = data.apiBase;
  });
} catch {
  // not in extension context
}

// ── DOM refs ──────────────────────────────────────────────────

const viewDisconnected = document.getElementById("view-disconnected")!;
const viewConnected = document.getElementById("view-connected")!;
const connectBtn = document.getElementById("connect-btn")!;
const disconnectBtn = document.getElementById("disconnect-btn")!;
const walletAddr = document.getElementById("wallet-addr")!;
const hatEarnedEl = document.getElementById("hat-earned")!;
const usdcEarnedEl = document.getElementById("usdc-earned")!;
const verifiedEl = document.getElementById("verified-status")!;
const statusDot = document.getElementById("status-dot")!;
const verifyBtn = document.getElementById("verify-btn")!;
const statusEl = document.getElementById("status")!;

// ── State ─────────────────────────────────────────────────────

function showDisconnected() {
  viewDisconnected.classList.remove("hidden");
  viewConnected.classList.add("hidden");
}

function showConnected(data: {
  userId: string;
  verified?: boolean;
  hatEarned?: number;
  usdcEarned?: number;
}) {
  viewDisconnected.classList.add("hidden");
  viewConnected.classList.remove("hidden");

  // Wallet address
  walletAddr.textContent = `${data.userId.slice(0, 6)}...${data.userId.slice(-4)}`;

  // Earnings
  hatEarnedEl.textContent = String(Math.floor(data.hatEarned || 0));
  usdcEarnedEl.textContent = `$${(data.usdcEarned || 0).toFixed(4)}`;

  // Verification status
  if (data.verified) {
    verifiedEl.textContent = "Verified Human";
    verifiedEl.style.color = "#22c55e";
    statusDot.classList.add("verified");
    verifyBtn.textContent = "Verified";
    verifyBtn.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
    (verifyBtn as HTMLButtonElement).disabled = true;
    statusEl.textContent = "Earning HAT for your attention";
  } else {
    verifiedEl.textContent = "Not Verified";
    verifiedEl.style.color = "#fb7185";
    statusDot.classList.remove("verified");
    verifyBtn.textContent = "Verify with World ID";
    verifyBtn.style.background = "";
    (verifyBtn as HTMLButtonElement).disabled = false;
    statusEl.textContent = "Verify to start earning rewards";
  }
}

// ── Fetch live stats from backend ─────────────────────────────

async function fetchLiveStats(address: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/user/${address}`);
    if (res.ok) {
      const data = await res.json();
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

// ── Load state on open ────────────────────────────────────────

function loadState() {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, async (data) => {
    if (!data || !data.userId || data.userId === "anonymous") {
      showDisconnected();
      return;
    }

    showConnected(data);

    // Refresh from backend for latest earnings
    const live = await fetchLiveStats(data.userId);
    if (live) {
      showConnected({
        userId: data.userId,
        verified: live.verified,
        hatEarned: live.totalHatEarned,
        usdcEarned: live.totalUsdcEarned,
      });
    }
  });
}

// ── Actions ───────────────────────────────────────────────────

connectBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:3000" });
});

verifyBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:3000/verify" });
});

disconnectBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCONNECT" }, () => {
    showDisconnected();
  });
});

// ── Init & auto-refresh ──────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  // Refresh every 10s while popup is open
  setInterval(loadState, 10_000);
});
