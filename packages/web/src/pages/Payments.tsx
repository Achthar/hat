import { useState, useEffect } from "react";
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

interface DashboardStats {
  users: { total: number; verified: number };
  sessions: { total: number; totalUsdc: number; totalHat: number };
  settlements: { total: number; settledUsdc: number; settledHat: number };
  gateway: {
    balance: string;
    totalDeposited: number;
    mode: "gateway" | "direct";
    platformAddress: string;
    walletAddress: string | null;
  };
}

interface Payment {
  id: string;
  user_address: string;
  ad_id: string;
  ad_title: string;
  advertiser_address: string;
  duration_seconds: number;
  usdc_earned: number;
  hat_earned: number;
  settlement_id: string;
  nanopayment_tx: string | null;
  hat_tx_hash: string | null;
  ended_at: number;
  settled_at: number;
}

export function Payments() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/nanopayments/dashboard-stats`).then((r) => r.json()),
      fetch(`${API_BASE}/nanopayments/payments`).then((r) => r.json()),
    ])
      .then(([s, p]) => {
        setStats(s);
        setPayments(p.payments || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/nanopayments/dashboard-stats`).then((r) => r.json()),
      fetch(`${API_BASE}/nanopayments/payments`).then((r) => r.json()),
    ])
      .then(([s, p]) => {
        setStats(s);
        setPayments(p.payments || []);
      })
      .finally(() => setLoading(false));
  }

  async function triggerSettlement() {
    try {
      const res = await fetch(`${API_BASE}/settlement/batch`, { method: "POST" });
      const data = await res.json();
      alert(data.message || `Settlement complete: ${data.recipientCount} recipients, $${data.totalUsdc?.toFixed(4)} USDC`);
      refresh();
    } catch (e) {
      alert(`Settlement failed: ${e}`);
    }
  }

  const short = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
  const fmtTime = (ts: number) => ts ? new Date(ts).toLocaleString() : "—";

  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          padding: "20px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/hat-logo.svg" alt="HAT" width={40} height={40} />
          <span style={{ fontSize: 20, fontWeight: 700, color: c.text }}>Payments</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={refresh} style={{ ...btnSecondary, opacity: loading ? 0.5 : 1 }}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button onClick={triggerSettlement} style={btnPrimary}>
            Run Settlement
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 64px" }}>
        {/* ── Stats Grid ──────────────────────────────── */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
            <StatCard
              label="Gateway Balance"
              value={`$${Number(stats.gateway.balance).toFixed(2)}`}
              sub={`Mode: ${stats.gateway.mode === "gateway" ? "Circle Gateway" : "Direct Transfer"}`}
              accent={c.indigo}
              accentBg={c.indigoBg}
            />
            <StatCard
              label="Total USDC Paid"
              value={`$${stats.settlements.settledUsdc.toFixed(4)}`}
              sub={`${stats.settlements.total} settlements`}
              accent={c.green}
              accentBg={c.greenBg}
            />
            <StatCard
              label="Total HAT Minted"
              value={Math.floor(stats.settlements.settledHat).toLocaleString()}
              sub="Bonus incentive tokens"
              accent={c.amber}
              accentBg={c.amberBg}
            />
            <StatCard
              label="USDC Deposited"
              value={`$${stats.gateway.totalDeposited.toFixed(2)}`}
              sub={`By advertisers`}
              accent={c.indigo}
              accentBg={c.indigoBg}
            />
            <StatCard
              label="Verified Users"
              value={`${stats.users.verified}`}
              sub={`${stats.users.total} total`}
              accent={c.green}
              accentBg={c.greenBg}
            />
            <StatCard
              label="View Sessions"
              value={`${stats.sessions.total}`}
              sub={`$${stats.sessions.totalUsdc.toFixed(4)} earned`}
              accent={c.rose}
              accentBg={c.roseBg}
            />
          </div>
        )}

        {/* ── Gateway Info ─────────────────────────────── */}
        {stats && (
          <div
            style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              fontSize: 13,
              color: c.muted,
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: c.text }}>Platform Wallet: </span>
              <code style={{ background: c.indigoBg, padding: "2px 6px", borderRadius: 6, fontSize: 12 }}>
                {stats.gateway.platformAddress}
              </code>
            </div>
            {stats.gateway.walletAddress && (
              <div>
                <span style={{ fontWeight: 600, color: c.text }}>Gateway Wallet: </span>
                <code style={{ background: c.indigoBg, padding: "2px 6px", borderRadius: 6, fontSize: 12 }}>
                  {stats.gateway.walletAddress}
                </code>
              </div>
            )}
            <div>
              <span style={{ fontWeight: 600, color: c.text }}>Settlement Mode: </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: stats.gateway.mode === "gateway" ? c.greenBg : c.amberBg,
                  color: stats.gateway.mode === "gateway" ? c.green : c.amber,
                  padding: "2px 8px",
                  borderRadius: 100,
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                {stats.gateway.mode === "gateway" ? "Circle Gateway (gas-free)" : "Direct Transfer (on-chain)"}
              </span>
            </div>
          </div>
        )}

        {/* ── Payment History ─────────────────────────── */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: c.text, marginBottom: 16 }}>
          Payment History
        </h2>

        {payments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              color: c.subtle,
              fontSize: 14,
            }}
          >
            No settled payments yet. View ads to generate sessions, then run settlement.
          </div>
        ) : (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 80px 90px 90px auto",
                padding: "12px 20px",
                fontSize: 11,
                fontWeight: 600,
                color: c.subtle,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: `1px solid ${c.border}`,
              }}
            >
              <span>Viewer</span>
              <span>Campaign</span>
              <span>Duration</span>
              <span>USDC</span>
              <span>HAT Bonus</span>
              <span>Settled</span>
            </div>
            {payments.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 80px 90px 90px auto",
                  padding: "14px 20px",
                  fontSize: 13,
                  color: c.text,
                  borderBottom: `1px solid ${c.border}`,
                  alignItems: "center",
                }}
              >
                <span>
                  <code style={{ background: c.indigoBg, padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>
                    {short(p.user_address)}
                  </code>
                </span>
                <span style={{ color: c.muted }}>{p.ad_title || short(p.ad_id)}</span>
                <span style={{ color: c.muted }}>{p.duration_seconds}s</span>
                <span style={{ fontWeight: 600, color: c.indigo }}>
                  ${p.usdc_earned.toFixed(4)}
                </span>
                <span style={{ fontWeight: 600, color: c.amber }}>
                  {Math.floor(p.hat_earned).toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: c.subtle }}>
                  {fmtTime(p.settled_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, accent, accentBg }: {
  label: string; value: string; sub: string; accent: string; accentBg: string;
}) {
  return (
    <div
      style={{
        padding: 20,
        background: "#fff",
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 12, color: c.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: c.text, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: c.subtle }}>{sub}</div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 20px",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "white",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 20px",
  background: "#fff",
  color: "#6366f1",
  border: "1px solid #e0e7ff",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
