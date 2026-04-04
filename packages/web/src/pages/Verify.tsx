import { useState } from "react";
import { IDKitWidget, VerificationLevel } from "@worldcoin/idkit";
import type { ISuccessResult } from "@worldcoin/idkit";
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

  async function handleVerify(proof: ISuccessResult) {
    if (!user.address) return;
    setStatus("verifying");

    const res = await fetch(`${API_BASE}/auth/verify-world-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof, address: user.address }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Verification failed");
    }
  }

  function handleSuccess() {
    setStatus("success");
    refreshUser();
  }

  function handleError(err: { message?: string }) {
    setError(err?.message || "Verification failed");
    setStatus("error");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 24,
          padding: "48px 40px",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(99,102,241,.08)",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${c.indigo}, ${c.indigoDark})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <img src="/hat-logo.svg" alt="HAT" width={48} height={48} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: c.text, margin: "0 0 8px" }}>
          Verify Your Humanity
        </h1>
        <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.6, margin: "0 0 32px" }}>
          Prove you're human with World ID to start earning{" "}
          <span style={{ color: c.indigo, fontWeight: 600 }}>USDC</span> nanopayments
          {" "}plus bonus{" "}
          <span style={{ color: c.amber, fontWeight: 600 }}>HAT</span> tokens.
        </p>

        {!user.address ? (
          <>
            <p style={{ fontSize: 14, color: c.muted, marginBottom: 16 }}>Connect your wallet first.</p>
            <button onClick={connect} style={btnPrimary}>
              Connect Wallet
            </button>
          </>
        ) : status === "idle" ? (
          <>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: c.indigoBg,
                borderRadius: 100,
                padding: "8px 16px",
                fontSize: 13,
                color: c.indigo,
                marginBottom: 24,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.indigo }} />
              {user.address.slice(0, 6)}...{user.address.slice(-4)}
            </div>

            <IDKitWidget
              app_id={APP_ID}
              action={WORLD_ID_ACTION}
              signal={user.address}
              verification_level={VerificationLevel.Orb}
              handleVerify={handleVerify}
              onSuccess={handleSuccess}
              onError={handleError}
            >
              {({ open }) => (
                <button onClick={open} style={{ ...btnPrimary, width: "100%", padding: 16, fontSize: 16 }}>
                  Verify with World ID
                </button>
              )}
            </IDKitWidget>

            <p style={{ fontSize: 12, color: c.muted, marginTop: 16, opacity: 0.7 }}>
              World ID 4.0 — Orb verification
            </p>
          </>
        ) : status === "verifying" ? (
          <div style={{ padding: "24px 0" }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: `3px solid ${c.border}`,
                borderTopColor: c.indigo,
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: c.muted }}>Verifying with World ID...</p>
          </div>
        ) : status === "success" ? (
          <div style={{ padding: "16px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#f0fdf4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 28,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ color: "#16a34a", margin: "0 0 8px", fontSize: 22 }}>Verified!</h2>
            <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.6 }}>
              You are now a verified human. Start browsing to earn rewards.
            </p>
          </div>
        ) : (
          <div style={{ padding: "16px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: c.roseBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c.rose} strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p style={{ color: c.rose, fontWeight: 600, marginBottom: 8 }}>{error}</p>
            <button
              onClick={() => { setStatus("idle"); setError(""); }}
              style={{ ...btnPrimary, background: `linear-gradient(135deg, ${c.rose}, #e11d48)` }}
            >
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
