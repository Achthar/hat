import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet.js";

/* ── Brand palette (from logo) ────────────────────────────── */
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

export function Home() {
  const { user, connect, connecting } = useWallet();

  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      {/* ── Nav ───────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1060,
          margin: "0 auto",
          padding: "20px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/hat-logo.svg" alt="HAT" width={40} height={40} />
          <span style={{ fontSize: 20, fontWeight: 700, color: c.text }}>HAT</span>
        </div>
        {user.address ? (
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: user.verified ? "#22c55e" : c.amber,
              }}
            />
            <span style={{ color: c.muted }}>
              {user.address.slice(0, 6)}...{user.address.slice(-4)}
            </span>
            {user.verified && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#16a34a",
                  background: "#f0fdf4",
                  padding: "2px 8px",
                  borderRadius: 100,
                }}
              >
                Verified
              </span>
            )}
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} style={btnPrimary}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </nav>

      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "0 32px 64px" }}>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section
          style={{
            textAlign: "center",
            padding: "56px 0 48px",
          }}
        >
          <h1
            style={{
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1.15,
              color: c.text,
              margin: 0,
            }}
          >
            Get Paid for Your{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${c.indigo}, ${c.rose})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Attention
            </span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: c.muted,
              maxWidth: 560,
              margin: "16px auto 0",
              lineHeight: 1.6,
            }}
          >
            Earn USDC nanopayments for your verified attention. Powered by Circle Gateway, World ID, and Arc.
          </p>
          {!user.address && (
            <button onClick={connect} disabled={connecting} style={{ ...btnPrimary, marginTop: 28, padding: "14px 36px", fontSize: 16 }}>
              {connecting ? "Connecting..." : "Get Started"}
            </button>
          )}
          {user.address && !user.verified && (
            <Link to="/verify" style={{ ...btnPrimary, marginTop: 28, padding: "14px 36px", fontSize: 16, display: "inline-block", textDecoration: "none" }}>
              Verify with World ID
            </Link>
          )}
        </section>

        {/* ── How It Works ─────────────────────────────────── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
            marginBottom: 48,
          }}
        >
          {[
            { icon: "1", color: c.indigoBg, accent: c.indigo, title: "Install Extension", desc: "Add the HAT browser extension" },
            { icon: "2", color: c.roseBg, accent: c.rose, title: "Verify Humanity", desc: "Prove you're human with World ID" },
            { icon: "3", color: c.amberBg, accent: c.amber, title: "Browse the Web", desc: "See targeted ads in a sidebar" },
            { icon: "4", color: c.indigoBg, accent: c.indigo, title: "Earn USDC", desc: "Gas-free nanopayments for every second" },
            { icon: "5", color: c.roseBg, accent: c.rose, title: "Bonus HAT", desc: "Earn HAT incentive tokens on top of USDC" },
          ].map((s) => (
            <div
              key={s.icon}
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 16,
                padding: 24,
                transition: "box-shadow .2s, transform .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(99,102,241,.12)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  color: s.accent,
                  marginBottom: 14,
                }}
              >
                {s.icon}
              </div>
              <div style={{ fontWeight: 600, color: c.text, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </section>

        {/* ── Demo Ad Zone ─────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 16 }}>Demo Ad Zone</h2>
          <div
            id="hat-demo-ad"
            style={{
              width: "100%",
              height: 250,
              background: `linear-gradient(135deg, ${c.indigoBg}, ${c.roseBg})`,
              border: `2px dashed ${c.border}`,
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: c.subtle,
              fontSize: 16,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={c.subtle} strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 15l5-5 4 4 3-3 6 6" />
              <circle cx="15.5" cy="8.5" r="1.5" />
            </svg>
            Install HAT extension to see ads here
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 16 }}>Your Stats</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <StatCard label="USDC Earned" value={`$${user.totalUsdcEarned.toFixed(4)}`} accent={c.indigo} bg={c.indigoBg} />
            <StatCard label="HAT Bonus" value={String(Math.floor(user.totalHatEarned))} accent={c.amber} bg={c.amberBg} />
            <StatCard
              label="Status"
              value={user.verified ? "Verified Human" : user.address ? "Not Verified" : "Not Connected"}
              accent={user.verified ? "#22c55e" : c.rose}
              bg={user.verified ? "#f0fdf4" : c.roseBg}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent, bg }: { label: string; value: string; accent: string; bg: string }) {
  return (
    <div
      style={{
        padding: 24,
        background: "#fff",
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
      <div style={{ fontSize: 13, color: c.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: c.text }}>{value}</div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 24px",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "white",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity .15s",
};

