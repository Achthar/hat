import { useState } from "react";
import { IDKitWidget, VerificationLevel } from "@worldcoin/idkit";
import type { ISuccessResult } from "@worldcoin/idkit";
import { WORLD_ID_ACTION } from "@hat/common";
import { useWallet } from "../hooks/useWallet.js";

const API_BASE = "http://localhost:3001/api";
const APP_ID = (import.meta.env.VITE_WORLD_ID_APP_ID || "app_staging_0000") as `app_${string}`;

export function Verify() {
  const { user, connect, refreshUser } = useWallet();
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState("");

  // Called by IDKit after proof is generated but before success screen
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
    <main style={{ maxWidth: 480, margin: "80px auto", padding: 32, textAlign: "center" }}>
      <h1>Verify Your Humanity</h1>
      <p style={{ color: "#6b7280" }}>
        Prove you're human with World ID to start earning HAT and USDC.
      </p>

      {!user.address ? (
        <div style={{ marginTop: 32 }}>
          <p>Connect your wallet first to verify.</p>
          <button onClick={connect} style={btnStyle}>
            Connect Wallet
          </button>
        </div>
      ) : status === "idle" ? (
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
            Connected: {user.address.slice(0, 6)}...{user.address.slice(-4)}
          </p>

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
              <button onClick={open} style={btnStyle}>
                Verify with World ID
              </button>
            )}
          </IDKitWidget>

          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            Uses World ID 4.0 — Proof of Human (Orb verification)
          </p>
        </div>
      ) : status === "verifying" ? (
        <p style={{ marginTop: 32 }}>Verifying with World ID...</p>
      ) : status === "success" ? (
        <div style={{ color: "#16a34a", marginTop: 32 }}>
          <h2>Verified!</h2>
          <p>You are now a verified human. Close this tab and start browsing to earn rewards.</p>
        </div>
      ) : (
        <div style={{ color: "#dc2626", marginTop: 32 }}>
          <p>Error: {error}</p>
          <button
            onClick={() => {
              setStatus("idle");
              setError("");
            }}
            style={{ ...btnStyle, background: "#dc2626" }}
          >
            Try Again
          </button>
        </div>
      )}
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 32px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
  cursor: "pointer",
};
