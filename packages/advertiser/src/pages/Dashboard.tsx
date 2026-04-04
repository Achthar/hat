import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ARC_TESTNET_CHAIN_ID } from "@hat/common";
import { useWallet } from "../hooks/useWallet.js";

import { DEFAULT_API_URL } from "@hat/common";

const API_BASE = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

const c = {
  indigo: "#6366f1",
  indigoDark: "#4f46e5",
  indigoLight: "#818cf8",
  indigoBg: "#eef2ff",
  rose: "#fb7185",
  roseBg: "#fff1f2",
  amber: "#fbbf24",
  amberBg: "#fffbeb",
  text: "#1e1b4b",
  muted: "#6b7280",
  subtle: "#9ca3af",
  bg: "#fafaff",
  card: "#ffffff",
  border: "#e0e7ff",
};

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
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<{ enabled: boolean; balance?: string } | null>(null);

  useEffect(() => {
    if (!address) return;
    fetch(`${API_BASE}/ads/by-advertiser/${address}`)
      .then((r) => r.json())
      .then((data) => setCampaigns(data.ads))
      .catch(() => {});
    loadBalance(address);
    loadGatewayStatus();
  }, [address]);

  async function loadBalance(addr: string) {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      // On Arc, USDC is the native gas token
      const bal = await provider.getBalance(addr);
      setNativeBalance(ethers.formatEther(bal));
    } catch {
      // Not connected to Arc
    }
  }

  async function loadGatewayStatus() {
    try {
      const res = await fetch(`${API_BASE}/nanopayments/status`);
      const data = await res.json();
      setGatewayStatus(data);
    } catch {
      setGatewayStatus({ enabled: false });
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
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
            chainName: "Arc Testnet",
            rpcUrls: ["https://testnet-rpc.arc.circle.com"],
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          },
        ],
      });
    }
  }

  async function fundGatewayWallet(amount: number) {
    if (!window.ethereum || !address || !gatewayStatus?.enabled) {
      setDepositStatus("Gateway not configured — deposit simulated for demo");
      return;
    }

    setDepositStatus("Switching to Arc Testnet...");
    await switchToArc();

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // On Arc, USDC is native — send directly to the platform Gateway wallet
    setDepositStatus("Depositing USDC to Gateway...");
    try {
      const res = await fetch(`${API_BASE}/nanopayments/status`);
      const data = await res.json();
      if (!data.address) throw new Error("Gateway wallet address not available");

      const tx = await signer.sendTransaction({
        to: data.address,
        value: ethers.parseEther(String(amount)),
      });
      await tx.wait();

      setDepositStatus("Deposit complete! USDC is now available for gas-free nanopayments.");
      loadBalance(address);
      loadGatewayStatus();
    } catch (e) {
      setDepositStatus(`Deposit failed: ${e instanceof Error ? e.message : String(e)}`);
    }
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

    await fundGatewayWallet(Number(form.budgetUsdc));

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
    <div style={{ minHeight: "100vh", background: c.bg }}>
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 900,
          margin: "0 auto",
          padding: "20px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/hat-logo.svg" alt="HAT" width={36} height={36} />
          <span style={{ fontSize: 18, fontWeight: 700, color: c.text }}>Advertiser</span>
        </div>
        {address ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 100,
              padding: "8px 16px",
              fontSize: 13,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ color: c.muted }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            {nativeBalance !== null && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: c.indigo,
                  background: c.indigoBg,
                  padding: "2px 8px",
                  borderRadius: 100,
                }}
              >
                {Number(nativeBalance).toFixed(2)} USDC
              </span>
            )}
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} style={btnPrimary}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </nav>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px 64px" }}>
        <p style={{ color: c.muted, fontSize: 15, marginTop: 0, marginBottom: 32 }}>
          Create ad campaigns and fund them with USDC on Arc. Viewers receive gas-free nanopayments for verified attention.
        </p>

        {/* ── Gateway Status Badge ─────────────────────── */}
        {gatewayStatus && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: gatewayStatus.enabled ? "#f0fdf4" : c.roseBg,
              border: `1px solid ${gatewayStatus.enabled ? "#bbf7d0" : "#fecdd3"}`,
              borderRadius: 100,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: gatewayStatus.enabled ? "#16a34a" : c.rose,
              marginBottom: 20,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {gatewayStatus.enabled
              ? `Nanopayments Active · Gateway: ${Number(gatewayStatus.balance || 0).toFixed(2)} USDC`
              : "Nanopayments Not Configured"}
          </div>
        )}

        {!address ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 32px",
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: c.indigoBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c.indigo} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <path d="M12 12h.01" />
                <path d="M6 12h.01" />
                <path d="M18 12h.01" />
              </svg>
            </div>
            <p style={{ color: c.muted, fontSize: 15, margin: "0 0 20px" }}>Connect your wallet to manage campaigns</p>
            <button onClick={connect} disabled={connecting} style={btnPrimary}>
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        ) : (
          <>
            {/* ── Create Campaign ─────────────────────────── */}
            <section
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 20,
                padding: 28,
                marginBottom: 28,
              }}
            >
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: c.text }}>
                Create Campaign
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: c.muted }}>
                USDC funds gas-free nanopayments to viewers. Viewers also earn bonus HAT tokens.
              </p>
              <form onSubmit={createCampaign} style={{ display: "grid", gap: 14 }}>
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
                <button type="submit" style={{ ...btnPrimary, padding: 14, fontSize: 15, width: "100%" }}>
                  Create Campaign & Fund Gateway
                </button>
              </form>
              {depositStatus && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: c.indigoBg,
                    borderRadius: 10,
                    fontSize: 13,
                    color: c.indigo,
                  }}
                >
                  {depositStatus}
                </div>
              )}
            </section>

            {/* ── Campaigns List ──────────────────────────── */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: c.text, marginBottom: 16 }}>
                Your Campaigns
              </h2>
              {campaigns.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    background: c.card,
                    border: `1px solid ${c.border}`,
                    borderRadius: 16,
                    color: c.subtle,
                    fontSize: 14,
                  }}
                >
                  No campaigns yet. Create one above.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {campaigns.map((camp) => {
                    const remaining = camp.budget_allocated_usdc - camp.budget_spent_usdc;
                    const pct = camp.budget_allocated_usdc > 0
                      ? (camp.budget_spent_usdc / camp.budget_allocated_usdc) * 100
                      : 0;
                    return (
                      <div
                        key={camp.id}
                        style={{
                          background: c.card,
                          border: `1px solid ${c.border}`,
                          borderRadius: 16,
                          padding: 20,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: c.text }}>{camp.title}</h3>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: remaining > 0 ? "#16a34a" : c.rose,
                              background: remaining > 0 ? "#f0fdf4" : c.roseBg,
                              padding: "3px 10px",
                              borderRadius: 100,
                            }}
                          >
                            {remaining > 0 ? "Active" : "Depleted"}
                          </span>
                        </div>
                        {/* Budget bar */}
                        <div style={{ height: 6, background: c.indigoBg, borderRadius: 100, marginBottom: 12, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(pct, 100)}%`,
                              background: `linear-gradient(90deg, ${c.indigo}, ${c.amber})`,
                              borderRadius: 100,
                              transition: "width .3s",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 20, fontSize: 13, color: c.muted }}>
                          <span>Budget: <strong style={{ color: c.text }}>${camp.budget_allocated_usdc}</strong></span>
                          <span>Spent: <strong style={{ color: c.amber }}>${camp.budget_spent_usdc.toFixed(4)}</strong></span>
                          <span>Remaining: <strong style={{ color: c.indigo }}>${remaining.toFixed(4)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  border: `1px solid ${c.border}`,
  borderRadius: 10,
  fontSize: 14,
  background: c.bg,
  outline: "none",
  transition: "border-color .15s",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 24px",
  background: `linear-gradient(135deg, ${c.indigo}, ${c.indigoDark})`,
  color: "white",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity .15s",
};
