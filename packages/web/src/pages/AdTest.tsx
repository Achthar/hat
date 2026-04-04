export function AdTest() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <h1>HAT Ad Replacement Test Page</h1>
      <p style={{ color: "#6b7280" }}>
        Each box below simulates a common ad pattern. With the HAT extension installed, they should
        all be replaced with HAT ads.
      </p>

      <h2>1. HAT Demo Placeholder</h2>
      <div
        id="hat-demo-ad"
        style={{ width: "100%", height: 250, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #f87171", borderRadius: 8 }}
      >
        #hat-demo-ad — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>2. Google Ads (ins.adsbygoogle)</h2>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: 90, background: "#fef3c7", border: "2px dashed #f59e0b", borderRadius: 8, textAlign: "center", lineHeight: "90px" } as React.CSSProperties}
      >
        ins.adsbygoogle — should be replaced
      </ins>

      <h2 style={{ marginTop: 32 }}>3. div[id*="google_ads"]</h2>
      <div
        id="google_ads_banner_1"
        style={{ width: "100%", height: 100, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #f59e0b", borderRadius: 8 }}
      >
        div#google_ads_banner_1 — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>4. div[id*="div-gpt-ad"]</h2>
      <div
        id="div-gpt-ad-12345"
        style={{ width: 728, height: 90, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #f59e0b", borderRadius: 8 }}
      >
        div#div-gpt-ad-12345 — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>5. div[class*="ad-container"]</h2>
      <div
        className="ad-container"
        style={{ width: "100%", height: 120, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #3b82f6", borderRadius: 8 }}
      >
        div.ad-container — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>6. div[class*="ad-banner"]</h2>
      <div
        className="ad-banner-top"
        style={{ width: "100%", height: 90, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #3b82f6", borderRadius: 8 }}
      >
        div.ad-banner-top — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>7. div[class*="advertisement"]</h2>
      <div
        className="advertisement-wrapper"
        style={{ width: 300, height: 250, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #3b82f6", borderRadius: 8 }}
      >
        div.advertisement-wrapper — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>8. div[data-ad-slot]</h2>
      <div
        data-ad-slot="top-banner"
        style={{ width: "100%", height: 100, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #22c55e", borderRadius: 8 }}
      >
        div[data-ad-slot] — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>9. div[class*="ad-unit"]</h2>
      <div
        className="ad-unit-sidebar"
        style={{ width: 300, height: 600, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #22c55e", borderRadius: 8 }}
      >
        div.ad-unit-sidebar (tall) — should be replaced
      </div>

      <h2 style={{ marginTop: 32 }}>10. Dynamically injected ad (5s delay)</h2>
      <div id="dynamic-ad-target" style={{ minHeight: 100 }}>
        <p style={{ color: "#9ca3af" }}>A fake ad will be injected here after 5 seconds...</p>
      </div>

      {/* Inject a dynamic ad after 5 seconds to test MutationObserver */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            setTimeout(function() {
              var target = document.getElementById('dynamic-ad-target');
              if (target) {
                var ad = document.createElement('div');
                ad.className = 'ad-container dynamic';
                ad.style.cssText = 'width:100%;height:120px;background:#fce7f3;display:flex;align-items:center;justify-content:center;border:2px dashed #ec4899;border-radius:8px;';
                ad.textContent = 'Dynamically injected div.ad-container — should be replaced';
                target.innerHTML = '';
                target.appendChild(ad);
              }
            }, 5000);
          `,
        }}
      />

      <h2 style={{ marginTop: 32 }}>11. Sevio-style ad (div#ad-container + iframe)</h2>
      <div
        id="ad-container"
        style={{ width: 320, height: 100, background: "#f3e8ff", border: "2px dashed #a855f7", borderRadius: 8, position: "relative" }}
      >
        <iframe
          id="tb-iframe-wrapper"
          width="320"
          height="100"
          src="data:text/html,%3Chtml%3E%3Cbody%20style='margin:0;display:flex;align-items:center;justify-content:center;background:%23f3e8ff;font-family:sans-serif;color:%239333ea'%3ESevio-style%20iframe%20ad%3C/body%3E%3C/html%3E"
          frameBorder="0"
          scrolling="no"
          style={{ border: "none" }}
        />
      </div>

      <div style={{ marginTop: 48, padding: 16, background: "#f9fafb", borderRadius: 8 }}>
        <h3 style={{ margin: "0 0 8px" }}>Debug</h3>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Open DevTools console and run:{" "}
          <code style={{ background: "#e5e7eb", padding: "2px 4px", borderRadius: 4 }}>
            document.querySelectorAll('.hat-replaced-ad, .hat-ad-slot').length
          </code>{" "}
          to see how many ads were replaced. If the sidebar is visible, the extension is active.
        </p>
      </div>
    </main>
  );
}
