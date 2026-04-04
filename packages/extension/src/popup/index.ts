const API_BASE = "http://localhost:3001/api";

document.addEventListener("DOMContentLoaded", () => {
  const verifyBtn = document.getElementById("verify-btn")!;
  const connectBtn = document.getElementById("connect-btn")!;
  const statusEl = document.getElementById("status")!;
  const hatEarnedEl = document.getElementById("hat-earned")!;
  const usdcEarnedEl = document.getElementById("usdc-earned")!;
  const verifiedEl = document.getElementById("verified-status")!;

  // Load current status
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (data) => {
    if (data) {
      hatEarnedEl.textContent = String(data.hatEarned || 0);
      usdcEarnedEl.textContent = `$${(data.usdcEarned || 0).toFixed(4)}`;
      verifiedEl.textContent = data.verified ? "Verified Human" : "Not Verified";
      verifiedEl.style.color = data.verified ? "#16a34a" : "#dc2626";
    }
  });

  verifyBtn.addEventListener("click", () => {
    // Open World ID verification in a new tab
    // In production, this would use IDKit widget
    statusEl.textContent = "Opening World ID verification...";
    chrome.tabs.create({ url: "http://localhost:3000/verify" });
  });

  connectBtn.addEventListener("click", () => {
    statusEl.textContent = "Connect wallet via the demo site";
    chrome.tabs.create({ url: "http://localhost:3000" });
  });
});
