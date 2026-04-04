const c = {
  indigo: "#6366f1",
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

const slotBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  fontSize: 13,
  color: c.muted,
  fontFamily: "monospace",
};

function Slot({ label, style, ...props }: { label: string; style?: React.CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ ...slotBase, width: "100%", height: 100, background: c.indigoBg, border: `2px dashed ${c.border}`, ...style }} {...props}>
      {label}
    </div>
  );
}

export function AdTest() {
  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <nav style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/hat-logo.svg" alt="HAT" width={36} height={36} />
        <span style={{ fontSize: 18, fontWeight: 700, color: c.text }}>Ad Replacement Test</span>
      </nav>

      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "0 32px 64px" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${c.indigoBg}, ${c.roseBg})`,
            border: `1px solid ${c.border}`,
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: 32,
            fontSize: 14,
            color: c.muted,
            lineHeight: 1.6,
          }}
        >
          Each box simulates a common ad pattern. With the HAT extension installed, they should all be
          replaced with HAT ads.
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <Card num={1} title="HAT Demo Placeholder">
            <div
              id="hat-demo-ad"
              style={{ ...slotBase, width: "100%", height: 250, background: c.roseBg, border: `2px dashed ${c.rose}` }}
            >
              #hat-demo-ad
            </div>
          </Card>

          <Card num={2} title="Google Ads (ins.adsbygoogle)">
            <ins
              className="adsbygoogle"
              style={{ ...slotBase, display: "flex", width: "100%", height: 90, background: c.amberBg, border: `2px dashed ${c.amber}` } as React.CSSProperties}
            >
              ins.adsbygoogle
            </ins>
          </Card>

          <Card num={3} title='div[id*="google_ads"]'>
            <Slot id="google_ads_banner_1" label="div#google_ads_banner_1" style={{ background: c.amberBg, borderColor: c.amber }} />
          </Card>

          <Card num={4} title='div[id*="div-gpt-ad"]'>
            <Slot id="div-gpt-ad-12345" label="div#div-gpt-ad-12345" style={{ width: 728, background: c.amberBg, borderColor: c.amber }} />
          </Card>

          <Card num={5} title='div[class*="ad-container"]'>
            <Slot className="ad-container" label="div.ad-container" style={{ height: 120 }} />
          </Card>

          <Card num={6} title='div[class*="ad-banner"]'>
            <Slot className="ad-banner-top" label="div.ad-banner-top" />
          </Card>

          <Card num={7} title='div[class*="advertisement"]'>
            <Slot className="advertisement-wrapper" label="div.advertisement-wrapper" style={{ width: 300, height: 250 }} />
          </Card>

          <Card num={8} title="div[data-ad-slot]">
            <Slot data-ad-slot="top-banner" label='div[data-ad-slot="top-banner"]' />
          </Card>

          <Card num={9} title='div[class*="ad-unit"]'>
            <Slot className="ad-unit-sidebar" label="div.ad-unit-sidebar (tall)" style={{ width: 300, height: 600 }} />
          </Card>

          <Card num={10} title="Dynamically injected ad (5s delay)">
            <div id="dynamic-ad-target" style={{ minHeight: 100 }}>
              <p style={{ color: c.subtle, fontSize: 13 }}>A fake ad will be injected here after 5 seconds...</p>
            </div>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  setTimeout(function() {
                    var target = document.getElementById('dynamic-ad-target');
                    if (target) {
                      var ad = document.createElement('div');
                      ad.className = 'ad-container dynamic';
                      ad.style.cssText = 'width:100%;height:120px;background:#eef2ff;display:flex;align-items:center;justify-content:center;border:2px dashed #e0e7ff;border-radius:12px;font-size:13px;color:#6b7280;font-family:monospace';
                      ad.textContent = 'div.ad-container (dynamic)';
                      target.innerHTML = '';
                      target.appendChild(ad);
                    }
                  }, 5000);
                `,
              }}
            />
          </Card>

          <Card num={11} title="Sevio-style ad (div#ad-container + iframe)">
            <div
              id="ad-container"
              style={{ width: 320, height: 100, background: c.indigoBg, border: `2px dashed ${c.indigo}`, borderRadius: 12, position: "relative" }}
            >
              <iframe
                id="tb-iframe-wrapper"
                width="320"
                height="100"
                src={`data:text/html,%3Chtml%3E%3Cbody%20style='margin:0;display:flex;align-items:center;justify-content:center;background:${encodeURIComponent(c.indigoBg)};font-family:monospace;color:${encodeURIComponent(c.muted)};font-size:13px'%3ESevio-style%20iframe%20ad%3C/body%3E%3C/html%3E`}
                frameBorder="0"
                scrolling="no"
                style={{ border: "none", borderRadius: 12 }}
              />
            </div>
          </Card>
        </div>

        {/* Debug box */}
        <div
          style={{
            marginTop: 40,
            padding: "16px 20px",
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: c.text, marginBottom: 6, fontSize: 14 }}>Debug</div>
          <p style={{ fontSize: 13, color: c.muted, margin: 0 }}>
            Open DevTools console and run:{" "}
            <code
              style={{
                background: c.indigoBg,
                padding: "3px 6px",
                borderRadius: 6,
                fontSize: 12,
                color: c.indigo,
              }}
            >
              document.querySelectorAll('.hat-replaced-ad, .hat-ad-slot').length
            </code>
          </p>
        </div>
      </main>
    </div>
  );
}

function Card({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: c.indigoBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: c.indigo,
          }}
        >
          {num}
        </span>
        <span style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
