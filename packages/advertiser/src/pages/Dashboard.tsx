import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { ARC_TESTNET_CHAIN_ID, RATE_PER_SECOND_USDC } from "@hat/common";
import { useWallet } from "../hooks/useWallet.js";
import { DEFAULT_API_URL } from "@hat/common";

const API_BASE = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

const c = {
  indigo: "#6366f1",
  indigoDark: "#4f46e5",
  indigoBg: "#eef2ff",
  rose: "#fb7185",
  roseBg: "#fff1f2",
  amber: "#fbbf24",
  amberBg: "#fffbeb",
  green: "#22c55e",
  greenBg: "#f0fdf4",
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
  click_reward_usdc: number;
  view_reward_per_second: number;
  active: number;
}

interface GatewayStatus {
  enabled: boolean;
  platformAddress?: string;
  gatewayWallet?: string;
  balance?: string;
}

interface CampaignAnalytics {
  views: number;
  uniqueViewers: number;
  totalViewSeconds: number;
  avgViewSeconds: number;
  clicks: number;
  ctr: number;
  spend: { views: number; clicks: number; total: number };
}

interface AdvBalance {
  totalDeposited: number;
  totalSpent: number;
  accrued: number;
  activeSessions: number;
  totalOwed: number;
  available: number;
}

export function Dashboard() {
  const { address, connect, connecting } = useWallet();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ title: "", imageUrl: "", targetUrl: "", budgetUsdc: "", viewRate: "", clickReward: "" });
  const [depositStatus, setDepositStatus] = useState("");
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [advBalance, setAdvBalance] = useState<AdvBalance | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, CampaignAnalytics>>({});
  const [expandedAd, setExpandedAd] = useState<string | null>(null);

  // Live spend ticker: increment accrued display based on active sessions
  const [liveAccrued, setLiveAccrued] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!address) return;
    loadAll(address);
    // Poll balance every 10s for live indicator
    const poll = setInterval(() => loadAdvertiserBalance(address), 10_000);
    return () => clearInterval(poll);
  }, [address]);

  // Tick the live accrued counter every second based on active session count
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (advBalance && advBalance.activeSessions > 0) {
      setLiveAccrued(advBalance.accrued);
      tickRef.current = window.setInterval(() => {
        setLiveAccrued((prev) => prev + advBalance.activeSessions * RATE_PER_SECOND_USDC);
      }, 1000);
    } else if (advBalance) {
      setLiveAccrued(advBalance.accrued);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [advBalance]);

  function loadAll(addr: string) {
    fetch(`${API_BASE}/ads/by-advertiser/${addr}`)
      .then((r) => r.json())
      .then((data) => setCampaigns(data.ads))
      .catch(() => {});
    loadBalance(addr);
    loadGatewayStatus();
    loadAdvertiserBalance(addr);
  }

  async function loadBalance(addr: string) {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(addr);
      setNativeBalance(ethers.formatEther(bal));
    } catch {}
  }

  async function loadGatewayStatus() {
    try {
      const res = await fetch(`${API_BASE}/nanopayments/status`);
      setGatewayStatus(await res.json());
    } catch { setGatewayStatus({ enabled: false }); }
  }

  async function loadAdvertiserBalance(addr: string) {
    try {
      const res = await fetch(`${API_BASE}/nanopayments/balance/${addr}`);
      setAdvBalance(await res.json());
    } catch {}
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
        params: [{
          chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
          chainName: "Arc Testnet",
          rpcUrls: ["https://rpc.testnet.arc.network"],
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
        }],
      });
    }
  }

  async function fundGatewayWallet(amount: number) {
    if (!window.ethereum || !address) { setDepositStatus("Connect wallet first"); return; }
    const target = gatewayStatus?.gatewayWallet || gatewayStatus?.platformAddress;
    if (!target) {
      setDepositStatus("Gateway not configured — deposit simulated for demo");
      await recordDeposit(address, amount, null);
      return;
    }
    setDepositStatus("Switching to Arc Testnet...");
    await switchToArc();
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    setDepositStatus("Depositing USDC to Gateway...");
    try {
      const tx = await signer.sendTransaction({ to: target, value: ethers.parseEther(String(amount)) });
      const receipt = await tx.wait();
      await recordDeposit(address, amount, receipt?.hash ?? null);
      setDepositStatus("Deposit complete!");
      loadAll(address);
    } catch (e) {
      setDepositStatus(`Deposit failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function recordDeposit(advertiserAddress: string, amountUsdc: number, txHash: string | null) {
    try {
      await fetch(`${API_BASE}/nanopayments/record-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertiserAddress, amountUsdc, txHash }),
      });
    } catch {}
  }

  async function loadAnalytics(adId: string) {
    try {
      const res = await fetch(`${API_BASE}/ads/${adId}/analytics`);
      const data = await res.json();
      setAnalytics((prev) => ({ ...prev, [adId]: data }));
    } catch {}
  }

  function toggleExpand(adId: string) {
    if (expandedAd === adId) {
      setExpandedAd(null);
    } else {
      setExpandedAd(adId);
      if (!analytics[adId]) loadAnalytics(adId);
    }
  }

  async function toggleAd(adId: string, currentlyActive: boolean) {
    const endpoint = currentlyActive ? "pause" : "resume";
    await fetch(`${API_BASE}/ads/${adId}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advertiserAddress: address }),
    });
    setCampaigns((prev) => prev.map((c) => c.id === adId ? { ...c, active: currentlyActive ? 0 : 1 } : c));
  }

  async function withdrawFunds() {
    if (!address) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`${API_BASE}/nanopayments/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertiserAddress: address }),
      });
      const data = await res.json();
      if (data.success) {
        setDepositStatus(`Withdrawn $${data.withdrawn.toFixed(4)} USDC (tx: ${data.txHash?.slice(0, 10)}...)`);
        loadAll(address);
      } else {
        setDepositStatus(data.error || "Withdrawal failed");
      }
    } catch (e) {
      setDepositStatus(`Withdrawal failed: ${e}`);
    } finally {
      setWithdrawing(false);
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    const res = await fetch(`${API_BASE}/ads/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advertiserId: address, title: form.title, imageUrl: form.imageUrl,
        targetUrl: form.targetUrl, budgetUsdc: Number(form.budgetUsdc),
        viewRewardPerSecond: form.viewRate ? Number(form.viewRate) : 0.0001,
        clickRewardUsdc: form.clickReward ? Number(form.clickReward) : 0,
      }),
    });
    const ad = await res.json();
    await fundGatewayWallet(Number(form.budgetUsdc));
    setCampaigns((prev) => [...prev, {
      id: ad.id, title: ad.title, image_url: ad.imageUrl, target_url: ad.targetUrl,
      budget_allocated_usdc: ad.budgetAllocatedUsdc, budget_spent_usdc: 0,
      click_reward_usdc: ad.clickRewardUsdc ?? 0,
      view_reward_per_second: ad.viewRewardPerSecond ?? 0.0001, active: 1,
    }]);
    setForm({ title: "", imageUrl: "", targetUrl: "", budgetUsdc: "", viewRate: "", clickReward: "" });
  }

  const totalLiveSpend = advBalance ? advBalance.totalSpent + liveAccrued : 0;
  const liveAvailable = advBalance ? advBalance.totalDeposited - totalLiveSpend : 0;

  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 900, margin: "0 auto", padding: "20px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/hat-logo.svg" alt="HAT" width={36} height={36} />
          <span style={{ fontSize: 18, fontWeight: 700, color: c.text }}>HATvertisers Console</span>
        </div>
        {address ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: c.card, border: `1px solid ${c.border}`, borderRadius: 100, padding: "8px 16px", fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.green }} />
            <span style={{ color: c.muted }}>{address.slice(0, 6)}...{address.slice(-4)}</span>
            {nativeBalance !== null && (
              <span style={{ fontSize: 12, fontWeight: 600, color: c.indigo, background: c.indigoBg, padding: "2px 8px", borderRadius: 100 }}>
                {Number(nativeBalance).toFixed(2)} USDC
              </span>
            )}
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} style={btnPrimary}>{connecting ? "Connecting..." : "Connect Wallet"}</button>
        )}
      </nav>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px 64px" }}>
        {!address ? (
          <div style={{ textAlign: "center", padding: "80px 32px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 20 }}>
            <p style={{ color: c.muted, fontSize: 15, margin: "0 0 20px" }}>Connect your wallet to manage campaigns</p>
            <button onClick={connect} disabled={connecting} style={btnPrimary}>{connecting ? "Connecting..." : "Connect Wallet"}</button>
          </div>
        ) : (
          <>
            {/* ── Live Spend Overview ─────────────────────── */}
            {advBalance && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
                <MiniCard label="Deposited" value={`$${advBalance.totalDeposited.toFixed(2)}`} accent={c.indigo} />
                <MiniCard label="Settled" value={`$${advBalance.totalSpent.toFixed(4)}`} accent={c.green} />
                <MiniCard
                  label="Accruing"
                  value={`$${liveAccrued.toFixed(4)}`}
                  accent={c.amber}
                  pulse={advBalance.activeSessions > 0}
                  sub={advBalance.activeSessions > 0 ? `${advBalance.activeSessions} active view${advBalance.activeSessions > 1 ? "s" : ""}` : undefined}
                />
                <MiniCard
                  label="Available"
                  value={`$${Math.max(0, liveAvailable).toFixed(2)}`}
                  accent={liveAvailable > 0 ? c.indigo : c.rose}
                />
              </div>
            )}

            {/* ── Gateway Badge + Withdraw ────────────────── */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
              {gatewayStatus && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: gatewayStatus.enabled ? c.greenBg : c.roseBg,
                  border: `1px solid ${gatewayStatus.enabled ? "#bbf7d0" : "#fecdd3"}`,
                  borderRadius: 100, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  color: gatewayStatus.enabled ? c.green : c.rose,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                  {gatewayStatus.enabled ? `Gateway Active` : "Gateway Not Configured"}
                </div>
              )}
              {advBalance && advBalance.available > 0 && (
                <button
                  onClick={withdrawFunds}
                  disabled={withdrawing}
                  style={{
                    ...btnSecondary,
                    color: c.rose,
                    borderColor: "#fecdd3",
                    fontSize: 12,
                    padding: "6px 14px",
                    opacity: withdrawing ? 0.5 : 1,
                  }}
                >
                  {withdrawing ? "Withdrawing..." : `Withdraw $${advBalance.available.toFixed(2)}`}
                </button>
              )}
            </div>

            {/* ── Create Campaign ──────────────────────────── */}
            <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 20, padding: 28, marginBottom: 28 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: c.text }}>Create Campaign</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: c.muted }}>
                USDC funds gas-free nanopayments to viewers. Viewers also earn bonus HAT tokens.
              </p>
              <form onSubmit={createCampaign} style={{ display: "grid", gap: 14 }}>
                <input placeholder="Campaign title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} required />
                <input placeholder="Banner image URL" value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} style={inputStyle} required />
                <input placeholder="Click-through URL" value={form.targetUrl} onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))} style={inputStyle} required />
                <input placeholder="Budget (USDC)" type="number" step="0.01" value={form.budgetUsdc} onChange={(e) => setForm((f) => ({ ...f, budgetUsdc: e.target.value }))} style={inputStyle} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <input placeholder="View rate $/sec (default 0.0001)" type="number" step="0.0001" value={form.viewRate} onChange={(e) => setForm((f) => ({ ...f, viewRate: e.target.value }))} style={inputStyle} />
                  <input placeholder="Click bonus $/click (optional)" type="number" step="0.001" value={form.clickReward} onChange={(e) => setForm((f) => ({ ...f, clickReward: e.target.value }))} style={inputStyle} />
                </div>
                <button type="submit" style={{ ...btnPrimary, padding: 14, fontSize: 15, width: "100%" }}>Create Campaign & Deposit to Gateway</button>
              </form>
              {depositStatus && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: c.indigoBg, borderRadius: 10, fontSize: 13, color: c.indigo }}>
                  {depositStatus}
                </div>
              )}
            </section>

            {/* ── Campaigns List ───────────────────────────── */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: c.text, marginBottom: 16 }}>Your Campaigns</h2>
              {campaigns.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, color: c.subtle, fontSize: 14 }}>
                  No campaigns yet. Create one above.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {campaigns.map((camp) => {
                    const remaining = camp.budget_allocated_usdc - camp.budget_spent_usdc;
                    const pct = camp.budget_allocated_usdc > 0 ? (camp.budget_spent_usdc / camp.budget_allocated_usdc) * 100 : 0;
                    const isActive = camp.active === 1;
                    const isExpanded = expandedAd === camp.id;
                    const stats = analytics[camp.id];
                    return (
                      <div key={camp.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 20, opacity: isActive ? 1 : 0.6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3
                            onClick={() => toggleExpand(camp.id)}
                            style={{ margin: 0, fontSize: 16, fontWeight: 600, color: c.text, cursor: "pointer" }}
                          >
                            {isExpanded ? "▾" : "▸"} {camp.title}
                          </h3>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                              color: isActive ? (remaining > 0 ? c.green : c.rose) : c.subtle,
                              background: isActive ? (remaining > 0 ? c.greenBg : c.roseBg) : "#f3f4f6",
                            }}>
                              {!isActive ? "Paused" : remaining > 0 ? "Active" : "Depleted"}
                            </span>
                            <button
                              onClick={() => toggleAd(camp.id, isActive)}
                              style={{
                                ...btnSecondary,
                                fontSize: 11,
                                padding: "3px 10px",
                                color: isActive ? c.rose : c.green,
                                borderColor: isActive ? "#fecdd3" : "#bbf7d0",
                              }}
                            >
                              {isActive ? "Pause" : "Resume"}
                            </button>
                          </div>
                        </div>
                        <div style={{ height: 6, background: c.indigoBg, borderRadius: 100, marginBottom: 12, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${c.indigo}, ${c.amber})`, borderRadius: 100, transition: "width .3s" }} />
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 13, color: c.muted, flexWrap: "wrap" }}>
                          <span>Budget: <strong style={{ color: c.text }}>${camp.budget_allocated_usdc}</strong></span>
                          <span>Spent: <strong style={{ color: c.amber }}>${camp.budget_spent_usdc.toFixed(4)}</strong></span>
                          <span>Remaining: <strong style={{ color: c.indigo }}>${remaining.toFixed(4)}</strong></span>
                          <span>View: <strong style={{ color: c.text }}>${camp.view_reward_per_second}</strong>/sec</span>
                          {camp.click_reward_usdc > 0 && (
                            <span>Click: <strong style={{ color: c.green }}>${camp.click_reward_usdc}</strong>/click</span>
                          )}
                        </div>

                        {/* ── Expanded Analytics ──────────────── */}
                        {isExpanded && (
                          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${c.border}` }}>
                            {!stats ? (
                              <div style={{ fontSize: 13, color: c.subtle }}>Loading analytics...</div>
                            ) : (
                              <>
                                {/* Metrics row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
                                  <MetricBox label="Views" value={String(stats.views)} />
                                  <MetricBox label="Unique Viewers" value={String(stats.uniqueViewers)} />
                                  <MetricBox label="Avg View" value={`${stats.avgViewSeconds}s`} />
                                  <MetricBox label="Clicks" value={String(stats.clicks)} />
                                  <MetricBox label="CTR" value={`${stats.ctr}%`} />
                                  <MetricBox label="Total Time" value={formatDuration(stats.totalViewSeconds)} />
                                </div>

                                {/* Spend breakdown */}
                                <div style={{ fontSize: 13, color: c.text }}>
                                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Spend Breakdown</div>
                                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                                    <SpendRow label="View attention" amount={stats.spend.views} color={c.indigo} />
                                    <SpendRow label="Click-throughs" amount={stats.spend.clicks} color={c.green} />
                                    <SpendRow label="Total" amount={stats.spend.total} color={c.text} bold />
                                  </div>
                                </div>

                                {/* Refresh button */}
                                <button
                                  onClick={() => loadAnalytics(camp.id)}
                                  style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px", marginTop: 12 }}
                                >
                                  Refresh
                                </button>
                              </>
                            )}
                          </div>
                        )}
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

function MiniCard({ label, value, accent, pulse, sub }: {
  label: string; value: string; accent: string; pulse?: boolean; sub?: string;
}) {
  return (
    <div style={{ padding: 16, background: "#fff", border: `1px solid ${c.border}`, borderRadius: 14, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 11, color: c.muted, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: c.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {pulse && <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, animation: "pulse 1.5s infinite" }} />}
      </div>
      {sub && <div style={{ fontSize: 11, color: c.subtle, marginTop: 2 }}>{sub}</div>}
      {pulse && <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }`}</style>}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: c.bg, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: c.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, color: c.subtle, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SpendRow({ label, amount, color, bold }: { label: string; amount: number; color: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: c.muted }}>{label}:</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color }}>${amount.toFixed(4)}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px", border: `1px solid ${c.border}`, borderRadius: 10,
  fontSize: 14, background: c.bg, outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 24px", background: `linear-gradient(135deg, ${c.indigo}, ${c.indigoDark})`,
  color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "6px 12px", background: "#fff", color: c.indigo,
  border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
};
