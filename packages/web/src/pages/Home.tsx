import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet.js";

export function Home() {
  const { user, connect, connecting } = useWallet();

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/hat-logo.svg" alt="HAT" width={48} height={48} />
          <h1 style={{ margin: 0 }}>HAT - Human Attention Token</h1>
        </div>
        {user.address ? (
          <div style={{ fontSize: 14, color: "#6b7280" }}>
            {user.address.slice(0, 6)}...{user.address.slice(-4)}
            {user.verified && <span style={{ color: "#16a34a", marginLeft: 8 }}>Verified</span>}
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} style={btnStyle}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      <p>A marketplace for verified human attention, powered by World ID and Arc micropayments.</p>

      <section style={{ marginTop: 32 }}>
        <h2>How It Works</h2>
        <ol style={{ lineHeight: 2 }}>
          <li>Install the HAT browser extension</li>
          <li>Verify your humanity with World ID</li>
          <li>Browse the web — the extension shows you targeted ads in a sidebar</li>
          <li>Earn USDC micropayments + HAT tokens for every second of verified attention</li>
          <li>Advertisers pay only for real human views — no bots, no fraud</li>
        </ol>
        {user.address && !user.verified && (
          <Link to="/verify" style={{ ...btnStyle, display: "inline-block", textDecoration: "none" }}>
            Verify with World ID
          </Link>
        )}
      </section>

      {/* Demo ad banner area — the extension will inject/replace these */}
      <section style={{ marginTop: 32 }}>
        <h2>Demo Ad Zone</h2>
        <div
          id="hat-demo-ad"
          style={{
            width: "100%",
            height: 250,
            background: "#f3f4f6",
            border: "2px dashed #d1d5db",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: 18,
          }}
        >
          Ad banner slot — install HAT extension to see ads here
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Your Stats</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <StatCard label="HAT Earned" value={String(user.totalHatEarned)} />
          <StatCard label="USDC Earned" value={`$${user.totalUsdcEarned.toFixed(4)}`} />
          <StatCard
            label="Status"
            value={user.verified ? "Verified Human" : user.address ? "Not Verified" : "Not Connected"}
          />
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 20, background: "#f9fafb", borderRadius: 12, textAlign: "center" }}>
      <div style={{ fontSize: 14, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 24px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  cursor: "pointer",
};
