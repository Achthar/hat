import { useState, useEffect, useCallback } from "react";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import type { IDKitResult, RpContext } from "@worldcoin/idkit";
import { WORLD_ID_ACTION } from "@hat/common";
import { useWallet } from "../hooks/useWallet.js";
import { DEFAULT_API_URL } from "@hat/common";

const API_BASE = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
const APP_ID = (import.meta.env.VITE_WORLD_ID_APP_ID || "app_staging_0000") as `app_${string}`;

const c = {
  indigo: "#6366f1",
  indigoDark: "#4f46e5",
  rose: "#fb7185",
  amber: "#fbbf24",
  text: "#1e1b4b",
  muted: "#6b7280",
  bg: "#fafaff",
  card: "#ffffff",
  border: "#e0e7ff",
  indigoBg: "#eef2ff",
  roseBg: "#fff1f2",
};

export function Verify() {
  const { user, connect, refreshUser } = useWallet();
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);

  const isAutoClose = new URLSearchParams(window.location.search).get("autoclose") === "1";

  // Fetch RP context from backend (required for IDKit v4)
  const fetchRpContext = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/rp-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: WORLD_ID_ACTION }),
      });
      if (res.ok) {
        const ctx = await res.json();
        setRpContext(ctx);
        return ctx;
      }
    } catch {
      // RP context not available — widget won't work but bypass still will
    }
    return null;
  }, []);

  // Auto-open widget when opened from extension (?autoclose=1)
  useEffect(() => {
    fetchRpContext().then((ctx) => {
      if (ctx && isAutoClose) {
        // Small delay to let the widget mount
        setTimeout(() => setWidgetOpen(true), 300);
      }
    });
  }, [fetchRpContext, isAutoClose]);

  async function emergencyBypass() {
    setBypassLoading(true);
    try {
      let addr = user.address;
      if (!addr) {
        if (!window.ethereum) { alert("Please install a wallet extension"); return; }
        const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
        addr = accounts[0];
        await fetch(`${API_BASE}/auth/connect-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr }),
        });
      }
      const res = await fetch(`${API_BASE}/dev/mock-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!res.ok) throw new Error("Bypass failed");
      setVerifiedAddress(addr!);
      setStatus("success");
      refreshUser();
      try {
        window.postMessage({ type: "HAT_WORLD_ID_VERIFIED", address: addr, nullifier: `mock-nullifier-${addr}`, verified: true }, "*");
      } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bypass failed");
      setStatus("error");
    } finally {
      setBypassLoading(false);
    }
  }

  // IDKit v4: result already has protocol_version, nonce, action, responses[]
  // Forward it directly to the backend verify endpoint
  async function handleVerify(result: IDKitResult) {
    setStatus("verifying");

    const res = await fetch(`${API_BASE}/auth/verify-world-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof: result, address: user.address || undefined }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Verification failed");
    }

    const data = await res.json();

    try {
      window.postMessage({ type: "HAT_WORLD_ID_VERIFIED", address: data.address, nullifier: data.nullifier, verified: true }, "*");
    } catch {}

    setVerifiedAddress(data.address);
    setStatus("success");
    setWidgetOpen(false);
    refreshUser();

    // Auto-close tab if opened from extension
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoclose") === "1") {
      setTimeout(() => window.close(), 2000); // show "Verified!" for 2s then close
    }
  }

  function handleSuccess() {
    // Backup — in case onSuccess fires after handleVerify
    if (status !== "success") {
      setStatus("success");
      refreshUser();
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ maxWidth: 440, width: "100%", background: c.card, border: `1px solid ${c.border}`, borderRadius: 24, padding: "48px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(99,102,241,.08)" }}>
        {/* Logo */}
        <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(135deg, ${c.indigo}, ${c.indigoDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <img src="/hat-logo.svg" alt="HAT" width={48} height={48} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: c.text, margin: "0 0 8px" }}>Login with World ID</h1>
        <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.6, margin: "0 0 32px" }}>
          Prove you're human to start earning{" "}
          <span style={{ color: c.indigo, fontWeight: 600 }}>USDC</span> nanopayments plus bonus{" "}
          <span style={{ color: c.amber, fontWeight: 600 }}>HAT</span> tokens.
        </p>

        {status === "idle" ? (
          <>
            {user.address && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: c.indigoBg, borderRadius: 100, padding: "8px 16px", fontSize: 13, color: c.indigo, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.indigo }} />
                {user.address.slice(0, 6)}...{user.address.slice(-4)}
              </div>
            )}

            {user.address ? (
              <>
                {rpContext ? (
                  <IDKitRequestWidget
                    app_id={APP_ID}
                    action={WORLD_ID_ACTION}
                    rp_context={rpContext}
                    allow_legacy_proofs={true}
                    environment="production"
                    preset={orbLegacy({ signal: user.address })}
                    open={widgetOpen}
                    onOpenChange={setWidgetOpen}
                    handleVerify={handleVerify}
                    onSuccess={handleSuccess}
                    onError={(code) => {
                      console.warn("[IDKit] error:", code);
                      if (!isAutoClose) {
                        setError(String(code));
                        setStatus("error");
                      }
                      setWidgetOpen(false);
                    }}
                  />
                ) : null}

                <button
                  onClick={() => {
                    if (rpContext) {
                      setWidgetOpen(true);
                    } else {
                      setError("RP context not available — backend may not be configured");
                      setStatus("error");
                    }
                  }}
                  style={{ ...btnPrimary, width: "100%", padding: 16, fontSize: 16 }}
                >
                  Verify with World ID
                </button>
              </>
            ) : (
              <>
                <p style={{ color: c.muted, fontSize: 13, marginBottom: 16 }}>
                  Connect your wallet first — this is where your USDC earnings will be paid.
                </p>
                <button onClick={connect} style={{ ...btnPrimary, width: "100%", padding: 16, fontSize: 16 }}>
                  Connect Wallet
                </button>
              </>
            )}

            <p style={{ fontSize: 12, color: c.muted, marginTop: 16, opacity: 0.7 }}>World ID 4.0 — Orb verification</p>

            <div style={{ marginTop: 24, borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
              <button onClick={emergencyBypass} disabled={bypassLoading} style={{ background: "none", border: "none", color: c.muted, fontSize: 12, cursor: "pointer", textDecoration: "underline", opacity: 0.6 }}>
                {bypassLoading ? "Verifying..." : "Emergency login (skip World ID)"}
              </button>
            </div>
          </>
        ) : status === "verifying" ? (
          <div style={{ padding: "24px 0" }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${c.border}`, borderTopColor: c.indigo, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: c.muted }}>Verifying with World ID...</p>
          </div>
        ) : status === "success" ? (
          <div style={{ padding: "16px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 style={{ color: "#16a34a", margin: "0 0 8px", fontSize: 22 }}>Verified!</h2>
            <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.6 }}>
              You are now a verified human. {isAutoClose ? "Closing..." : "Start browsing to earn rewards."}
            </p>
            {verifiedAddress && (
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, background: c.indigoBg, borderRadius: 100, padding: "8px 16px", fontSize: 12, color: c.indigo }}>
                ID: {verifiedAddress.slice(0, 10)}...{verifiedAddress.slice(-6)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "16px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: c.roseBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c.rose} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </div>
            <p style={{ color: c.rose, fontWeight: 600, marginBottom: 8 }}>{error}</p>
            <button onClick={() => { setStatus("idle"); setError(""); fetchRpContext(); }} style={{ ...btnPrimary, background: `linear-gradient(135deg, ${c.rose}, #e11d48)` }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "12px 32px",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity .15s",
};

