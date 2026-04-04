import { Link } from "react-router-dom";

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

const btnPrimary: React.CSSProperties = {
  padding: "14px 36px",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity .15s",
  textDecoration: "none",
  display: "inline-block",
};

const btnOutline: React.CSSProperties = {
  padding: "14px 36px",
  background: "transparent",
  color: c.indigo,
  border: `2px solid ${c.indigo}`,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

export function Download() {
  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      {/* ── Nav ─────────────────────────────────────────── */}
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
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <img src="/hat-logo.svg" alt="HAT" width={40} height={40} />
          <span style={{ fontSize: 20, fontWeight: 700, color: c.text }}>HAT</span>
        </Link>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to="/" style={{ color: c.muted, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            Home
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "0 32px 64px" }}>
        {/* ── Hero ──────────────────────────────────────── */}
        <section style={{ textAlign: "center", padding: "56px 0 48px" }}>
          <div
            style={{
              width: 80,
              height: 80,
              margin: "0 auto 24px",
              borderRadius: 20,
              background: c.indigoBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img src="/hat-logo.svg" alt="HAT" width={48} height={48} />
          </div>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 800,
              lineHeight: 1.15,
              color: c.text,
              margin: 0,
            }}
          >
            Install the{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${c.indigo}, ${c.rose})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              HAT Extension
            </span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: c.muted,
              maxWidth: 520,
              margin: "16px auto 0",
              lineHeight: 1.6,
            }}
          >
            Earn USDC nanopayments for your attention. The browser extension runs a
            lightweight sidebar that shows you ads and pays you in real time.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 32 }}>
            <a href="/hat-extension.zip" download style={btnPrimary}>
              Download for Chrome
            </a>
            <a href="#install-steps" style={btnOutline}>
              How to Install
            </a>
          </div>

          <p style={{ fontSize: 13, color: c.subtle, marginTop: 12 }}>
            Works on Chrome, Brave, Edge, and other Chromium browsers &middot; v0.0.1
          </p>
        </section>

        {/* ── Features ─────────────────────────────────── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 20,
            marginBottom: 56,
          }}
        >
          {[
            {
              title: "Earn While Browsing",
              desc: "A lightweight sidebar shows curated ads. You earn USDC for every second of verified attention.",
              accent: c.indigo,
              bg: c.indigoBg,
            },
            {
              title: "Privacy First",
              desc: "No tracking. No cookies. Your data stays local. Advertisers pay you, not a middleman.",
              accent: c.rose,
              bg: c.roseBg,
            },
            {
              title: "World ID Verified",
              desc: "Prove you're human once with World ID. No bots, no fraud — just real people earning real money.",
              accent: c.amber,
              bg: c.amberBg,
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 16,
                padding: 28,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: f.accent,
                  marginBottom: 16,
                }}
              />
              <div style={{ fontWeight: 700, color: c.text, marginBottom: 6, fontSize: 16 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </section>

        {/* ── Install Steps ────────────────────────────── */}
        <section id="install-steps" style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: c.text, textAlign: "center", marginBottom: 32 }}>
            Installation Guide
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              {
                step: "1",
                title: "Download the extension",
                desc: 'Click the "Download for Chrome" button above to get the extension ZIP file.',
              },
              {
                step: "2",
                title: "Unzip the file",
                desc: "Extract the downloaded hat-extension.zip to a folder on your computer.",
              },
              {
                step: "3",
                title: "Open Extensions page",
                desc: "Navigate to chrome://extensions in your browser. Enable \"Developer mode\" using the toggle in the top right corner.",
              },
              {
                step: "4",
                title: "Load the extension",
                desc: 'Click "Load unpacked" and select the folder you extracted in step 2.',
              },
              {
                step: "5",
                title: "You\'re all set!",
                desc: "The HAT icon will appear in your toolbar. Click it to connect your wallet, verify with World ID, and start earning.",
              },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  background: c.card,
                  border: `1px solid ${c.border}`,
                  borderRadius: 16,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    minWidth: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${c.indigo}, ${c.indigoDark})`,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  {s.step}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: c.text, marginBottom: 4, fontSize: 16 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────── */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: c.text, textAlign: "center", marginBottom: 32 }}>
            FAQ
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                q: "Which browsers are supported?",
                a: "Any Chromium-based browser — Chrome, Brave, Edge, Arc, Opera, and Vivaldi.",
              },
              {
                q: "Is it safe to use Developer mode?",
                a: "Yes. Developer mode simply lets you install extensions that aren't on the Chrome Web Store yet. We're working on a Web Store listing.",
              },
              {
                q: "How do I earn USDC?",
                a: "Once installed and verified with World ID, the extension shows a sidebar with ads. You earn USDC nanopayments for every second of verified attention — streamed directly to your wallet via Circle.",
              },
              {
                q: "What is the HAT bonus?",
                a: "On top of USDC, you earn HAT incentive tokens as an early-adopter bonus. These are distributed automatically alongside your USDC payments.",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                style={{
                  background: c.card,
                  border: `1px solid ${c.border}`,
                  borderRadius: 16,
                  padding: 24,
                }}
              >
                <div style={{ fontWeight: 700, color: c.text, marginBottom: 6 }}>{faq.q}</div>
                <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────── */}
        <section
          style={{
            textAlign: "center",
            background: `linear-gradient(135deg, ${c.indigoBg}, ${c.roseBg})`,
            borderRadius: 20,
            padding: "48px 32px",
            border: `1px solid ${c.border}`,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: "0 0 12px" }}>
            Ready to get paid for your attention?
          </h2>
          <p style={{ color: c.muted, margin: "0 0 24px", fontSize: 15 }}>
            Download the extension, verify your humanity, and start earning in minutes.
          </p>
          <a href="/hat-extension.zip" download style={btnPrimary}>
            Download HAT Extension
          </a>
        </section>

        {/* ── Footer ───────────────────────────────────── */}
        <footer style={{ textAlign: "center", padding: "40px 0 24px", color: c.subtle, fontSize: 13 }}>
          HAT &mdash; Human Attention Token &middot; Built at ETH Global Hackathon
        </footer>
      </main>
    </div>
  );
}
