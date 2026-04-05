let API_BASE = "https://hat-backend.achim-d87.workers.dev/api";
let WEB_BASE = "https://hat.pages.dev";

try {
  chrome.storage.local.get(["apiBase", "webBase"], (data) => {
    if (data.apiBase) API_BASE = data.apiBase;
    if (data.webBase) WEB_BASE = data.webBase;
  });
} catch {}

// ── DOM refs ──────────────────────────────────────────────────

const viewDisconnected = document.getElementById("view-disconnected")!;
const viewConnected = document.getElementById("view-connected")!;
const worldIdBtn = document.getElementById("worldid-btn")!;
const connectBtn = document.getElementById("connect-btn")!;
const disconnectBtn = document.getElementById("disconnect-btn")!;
const walletAddr = document.getElementById("wallet-addr")!;
const hatEarnedEl = document.getElementById("hat-earned")!;
const usdcEarnedEl = document.getElementById("usdc-earned")!;
const verifiedEl = document.getElementById("verified-status")!;
const statusDot = document.getElementById("status-dot")!;
const verifyBtn = document.getElementById("verify-btn")!;
const linkWalletBtn = document.getElementById("link-wallet-btn")!;
const statusEl = document.getElementById("status")!;
const connectDivider = document.getElementById("connect-divider")!;

// ── Helpers ───────────────────────────────────────────────────

/** Is this a World ID nullifier (not a real wallet address)? */
function isNullifierId(id: string): boolean {
  // Nullifiers are long hex strings starting with 0x, typically 66+ chars
  // Wallet addresses are exactly 42 chars (0x + 40 hex)
  return id.length > 42 || !id.startsWith("0x");
}

// ── View switching ────────────────────────────────────────────

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

  // Show address (truncated, clickable to copy)
  const id = data.userId;
  walletAddr.innerHTML = `${id.slice(0, 6)}...${id.slice(-4)}<span class="copy-hint">copy</span>`;
  walletAddr.title = id;
  walletAddr.dataset.fullAddress = id;

  // Earnings
  hatEarnedEl.textContent = String(Math.floor(data.hatEarned || 0));
  usdcEarnedEl.textContent = `$${(data.usdcEarned || 0).toFixed(4)}`;

  // Verification status
  if (data.verified) {
    verifiedEl.textContent = "Verified Human";
    verifiedEl.style.color = "#22c55e";
    statusDot.classList.add("verified");
    verifyBtn.classList.add("hidden");
    statusEl.textContent = "Earning HAT for your attention";
  } else {
    verifiedEl.textContent = "Not Verified";
    verifiedEl.style.color = "#fb7185";
    statusDot.classList.remove("verified");
    verifyBtn.classList.remove("hidden");
    verifyBtn.textContent = "Verify with World ID";
    verifyBtn.style.background = "";
    (verifyBtn as HTMLButtonElement).disabled = false;
    statusEl.textContent = "Verify to start earning rewards";
  }

  // Show "Connect Wallet for Payouts" if logged in via nullifier (no real wallet)
  if (isNullifierId(id)) {
    linkWalletBtn.classList.remove("hidden");
  } else {
    linkWalletBtn.classList.add("hidden");
  }

  // If verified, hide the regular connect wallet option on the disconnected view
  // (they should use World ID, not plain wallet connect)
  if (data.verified) {
    connectBtn.classList.add("hidden");
    connectDivider.classList.add("hidden");
  }
}

// ── Backend helpers ───────────────────────────────────────────

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
  } catch {}
  return null;
}

// ── Load state ────────────────────────────────────────────────

function loadState() {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, async (data) => {
    if (!data || !data.userId || data.userId === "anonymous") {
      showDisconnected();
      return;
    }

    showConnected(data);

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

// ── Connect wallet via MetaMask on active tab ────────────────

async function connectWallet() {
  const btn = connectBtn as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Connecting...";
  statusEl.textContent = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
        if (!eth) return { error: "no-wallet" };
        return eth.request({ method: "eth_requestAccounts" })
          .then((accounts: string[]) => ({ address: accounts[0] }))
          .catch((e: Error) => ({ error: e.message }));
      },
    });

    const result = results?.[0]?.result as { address?: string; error?: string } | undefined;

    if (!result || result.error) {
      statusEl.textContent = result?.error === "no-wallet"
        ? "No wallet found on this page. Try a different tab."
        : (result?.error || "Connection failed");
      btn.disabled = false;
      btn.textContent = "Connect Wallet";
      return;
    }

    const address = result.address!;

    try {
      await fetch(`${API_BASE}/auth/connect-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
    } catch {}

    chrome.storage.local.set({ userId: address });

    const live = await fetchLiveStats(address);
    showConnected({
      userId: address,
      verified: live?.verified ?? false,
      hatEarned: live?.totalHatEarned ?? 0,
      usdcEarned: live?.totalUsdcEarned ?? 0,
    });
  } catch (e) {
    statusEl.textContent = `Failed: ${e instanceof Error ? e.message : String(e)}`;
    btn.disabled = false;
    btn.textContent = "Connect Wallet";
  }
}

// ── Link wallet to existing World ID account ─────────────────

async function linkWallet() {
  const btn = linkWalletBtn as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Connecting...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
        if (!eth) return { error: "no-wallet" };
        return eth.request({ method: "eth_requestAccounts" })
          .then((accounts: string[]) => ({ address: accounts[0] }))
          .catch((e: Error) => ({ error: e.message }));
      },
    });

    const result = results?.[0]?.result as { address?: string; error?: string } | undefined;

    if (!result || result.error) {
      statusEl.textContent = result?.error === "no-wallet"
        ? "No wallet found. Open a page with MetaMask."
        : (result?.error || "Connection failed");
      btn.disabled = false;
      btn.textContent = "Connect Wallet for Payouts";
      return;
    }

    const address = result.address!;

    // Get current nullifier and link wallet on backend
    chrome.storage.local.get("nullifier", async (data) => {
      try {
        await fetch(`${API_BASE}/auth/link-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nullifier: data.nullifier, address }),
        });
      } catch {}

      // Update stored userId to the real wallet address
      chrome.storage.local.set({ userId: address });

      const live = await fetchLiveStats(address);
      showConnected({
        userId: address,
        verified: live?.verified ?? true,
        hatEarned: live?.totalHatEarned ?? 0,
        usdcEarned: live?.totalUsdcEarned ?? 0,
      });
    });
  } catch (e) {
    statusEl.textContent = `Failed: ${e instanceof Error ? e.message : String(e)}`;
    btn.disabled = false;
    btn.textContent = "Connect Wallet for Payouts";
  }
}

// ── Actions ───────────────────────────────────────────────────

worldIdBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${WEB_BASE}/verify?autoclose=1` });
});

connectBtn.addEventListener("click", connectWallet);

verifyBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${WEB_BASE}/verify?autoclose=1` });
});

linkWalletBtn.addEventListener("click", linkWallet);

disconnectBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCONNECT" }, () => {
    showDisconnected();
  });
});

// Copy address to clipboard on click
walletAddr.addEventListener("click", () => {
  const addr = walletAddr.dataset.fullAddress;
  if (!addr) return;
  navigator.clipboard.writeText(addr).then(() => {
    const hint = walletAddr.querySelector(".copy-hint") as HTMLElement;
    if (hint) {
      hint.textContent = "copied!";
      hint.style.color = "#22c55e";
      setTimeout(() => {
        hint.textContent = "copy";
        hint.style.color = "";
      }, 1500);
    }
  });
});

// ── Init ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  setInterval(loadState, 10_000);
});
