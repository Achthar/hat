// Background service worker for HAT extension

chrome.runtime.onInstalled.addListener(() => {
  console.log("HAT Extension installed");
  chrome.storage.local.set({ verified: false, hatEarned: 0, usdcEarned: 0 });
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    chrome.storage.local.get(["verified", "hatEarned", "usdcEarned", "userId"], (data) => {
      sendResponse(data);
    });
    return true; // async response
  }

  if (msg.type === "SET_VERIFIED") {
    chrome.storage.local.set({
      verified: true,
      userId: msg.address,
      nullifier: msg.nullifier,
    });
    sendResponse({ ok: true });
  }

  if (msg.type === "UPDATE_EARNINGS") {
    chrome.storage.local.get(["hatEarned", "usdcEarned"], (data) => {
      chrome.storage.local.set({
        hatEarned: (data.hatEarned || 0) + msg.hat,
        usdcEarned: (data.usdcEarned || 0) + msg.usdc,
      });
    });
    sendResponse({ ok: true });
  }

  if (msg.type === "DISCONNECT") {
    chrome.storage.local.set({
      userId: "anonymous",
      verified: false,
      nullifier: null,
      hatEarned: 0,
      usdcEarned: 0,
      sidebarCollapsed: false,
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "ACCOUNT_CHANGED") {
    const newAddress = msg.address;
    chrome.storage.local.get("userId", (data) => {
      if (data.userId && data.userId !== "anonymous" && data.userId !== newAddress) {
        // Address changed — reset state for the new account
        chrome.storage.local.set({
          userId: newAddress,
          verified: false,
          nullifier: null,
          hatEarned: 0,
          usdcEarned: 0,
          sidebarCollapsed: false,
        });
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});
