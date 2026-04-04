import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PAYOUT_VAULT_ABI, CONTRACTS, ARC_TESTNET_CHAIN_ID } from "@hat/common";
import { useWallet } from "../hooks/useWallet.js";

import { DEFAULT_API_URL } from "@hat/common";

const API_BASE = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

interface Campaign {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  budget_allocated_usdc: number;
  budget_spent_usdc: number;
}

export function Dashboard() {
  const { address, connect, connecting } = useWallet();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ title: "", imageUrl: "", targetUrl: "", budgetUsdc: "" });
  const [depositStatus, setDepositStatus] = useState("");
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  // Load campaigns for connected advertiser
  useEffect(() => {
    if (!address) return;
    fetch(`${API_BASE}/ads/by-advertiser/${address}`)
      .then((r) => r.json())
      .then((data) => setCampaigns(data.ads))
      .catch(() => {});

    // Load USDC balance
    loadBalance(address);
  }, [address]);

  async function loadBalance(addr: string) {
    if (!CONTRACTS.USDC || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const usdc = new ethers.Contract(CONTRACTS.USDC, USDC_ABI, provider);
      const bal = await usdc.balanceOf(addr);
      setUsdcBalance(ethers.formatUnits(bal, 6));
    } catch {
      // Contract not deployed yet
    }
  }

  async function switchToArc() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}` }],
      });
    } catch {
      // Chain not added, try to add it
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
            chainName: "Arc Testnet",
            rpcUrls: ["https://testnet-rpc.arc.circle.com"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          },
        ],
      });
    }
  }

  async function depositUsdc(amount: number) {
    if (!window.ethereum || !address || !CONTRACTS.PAYOUT_VAULT || !CONTRACTS.USDC) {
      setDepositStatus("Contracts not deployed yet — deposit simulated for demo");
      return;
    }

    setDepositStatus("Switching to Arc Testnet...");
    await switchToArc();

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    setDepositStatus("Approving USDC...");
    const usdc = new ethers.Contract(CONTRACTS.USDC, USDC_ABI, signer);
    const amountWei = ethers.parseUnits(String(amount), 6);
    const approveTx = await usdc.approve(CONTRACTS.PAYOUT_VAULT, amountWei);
    await approveTx.wait();

    setDepositStatus("Depositing to PayoutVault...");
    const vault = new ethers.Contract(CONTRACTS.PAYOUT_VAULT, PAYOUT_VAULT_ABI, signer);
    const depositTx = await vault.deposit(amountWei);
    await depositTx.wait();

    setDepositStatus("Deposit complete!");
    loadBalance(address);
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;

    const res = await fetch(`${API_BASE}/ads/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advertiserId: address,
        title: form.title,
        imageUrl: form.imageUrl,
        targetUrl: form.targetUrl,
        budgetUsdc: Number(form.budgetUsdc),
      }),
    });
    const ad = await res.json();

    // Trigger USDC deposit
    await depositUsdc(Number(form.budgetUsdc));

    setCampaigns((prev) => [
      ...prev,
      {
        id: ad.id,
        title: ad.title,
        image_url: ad.imageUrl,
        target_url: ad.targetUrl,
        budget_allocated_usdc: ad.budgetAllocatedUsdc,
        budget_spent_usdc: 0,
      },
    ]);
    setForm({ title: "", imageUrl: "", targetUrl: "", budgetUsdc: "" });
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>HAT Advertiser Dashboard</h1>
        {address ? (
          <div style={{ fontSize: 14 }}>
            <span style={{ color: "#6b7280" }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            {usdcBalance !== null && (
              <span style={{ marginLeft: 12, color: "#16a34a" }}>{usdcBalance} USDC</span>
            )}
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} style={btnStyle}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
      <p style={{ color: "#6b7280" }}>
        Create ad campaigns and deposit USDC on Arc. Pay only for verified human attention.
      </p>

      {!address ? (
        <div style={{ textAlign: "center", marginTop: 64, color: "#9ca3af" }}>
          Connect your wallet to manage campaigns.
        </div>
      ) : (
        <>
          <section
            style={{
              marginTop: 32,
              padding: 24,
              background: "white",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Create Campaign</h2>
            <form onSubmit={createCampaign} style={{ display: "grid", gap: 12 }}>
              <input
                placeholder="Campaign title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                style={inputStyle}
                required
              />
              <input
                placeholder="Banner image URL"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                style={inputStyle}
                required
              />
              <input
                placeholder="Click-through URL"
                value={form.targetUrl}
                onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))}
                style={inputStyle}
                required
              />
              <input
                placeholder="Budget (USDC)"
                type="number"
                step="0.01"
                value={form.budgetUsdc}
                onChange={(e) => setForm((f) => ({ ...f, budgetUsdc: e.target.value }))}
                style={inputStyle}
                required
              />
              <button type="submit" style={btnStyle}>
                Create Campaign & Deposit USDC on Arc
              </button>
            </form>
            {depositStatus && (
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>{depositStatus}</p>
            )}
          </section>

          <section style={{ marginTop: 32 }}>
            <h2>Your Campaigns</h2>
            {campaigns.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>No campaigns yet. Create one above.</p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: 16,
                      background: "white",
                      borderRadius: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 8px" }}>{c.title}</h3>
                    <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#6b7280" }}>
                      <span>Budget: ${c.budget_allocated_usdc} USDC</span>
                      <span>Spent: ${c.budget_spent_usdc.toFixed(4)} USDC</span>
                      <span>
                        Remaining: ${(c.budget_allocated_usdc - c.budget_spent_usdc).toFixed(4)} USDC
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
};

const btnStyle: React.CSSProperties = {
  padding: 12,
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
  cursor: "pointer",
};
