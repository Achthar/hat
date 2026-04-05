import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";
import { Home } from "./pages/Home.js";
import { Verify } from "./pages/Verify.js";
import { AdTest } from "./pages/AdTest.js";
import { Payments } from "./pages/Payments.js";
import { Download } from "./pages/Download.js";

// Arc Testnet custom network
const arcTestnet = defineChain({
  id: 5042002,
  caipNetworkId: "eip155:5042002",
  chainNamespace: "eip155",
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://testnet-explorer.arc.circle.com" } },
});

// Initialize Reown AppKit (WalletConnect + injected wallets)
createAppKit({
  adapters: [new EthersAdapter()],
  networks: [arcTestnet],
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  metadata: {
    name: "HAT - Human Attention Token",
    description: "Earn USDC for your verified attention",
    url: window.location.origin,
    icons: [`${window.location.origin}/hat-logo.svg`],
  },
  features: {
    analytics: false,
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/ad-test" element={<AdTest />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/download" element={<Download />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
