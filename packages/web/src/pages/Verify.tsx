import { useState } from "react";

const API_BASE = "http://localhost:3001/api";

export function Verify() {
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleVerify(proof: unknown) {
    setStatus("verifying");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-world-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, address: "0x..." }), // TODO: get from wallet
      });
      if (!res.ok) throw new Error("Verification failed");
      setStatus("success");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: 32, textAlign: "center" }}>
      <h1>Verify Your Humanity</h1>
      <p style={{ color: "#6b7280" }}>
        Prove you're human with World ID to start earning HAT and USDC.
      </p>

      {status === "idle" && (
        <div style={{ marginTop: 32 }}>
          {/* TODO: Replace with IDKit widget
            <IDKitWidget
              app_id="app_..."
              action="hat-verify-human"
              onSuccess={handleVerify}
            /> */}
          <button
            onClick={() => handleVerify({ mock: true })}
            style={{
              padding: "12px 32px",
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Verify with World ID
          </button>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            Uses World ID 4.0 — Proof of Human (Orb verification)
          </p>
        </div>
      )}

      {status === "verifying" && <p>Verifying...</p>}
      {status === "success" && (
        <div style={{ color: "#16a34a", marginTop: 32 }}>
          <h2>Verified!</h2>
          <p>You are now a verified human. Close this tab and start browsing to earn rewards.</p>
        </div>
      )}
      {status === "error" && (
        <div style={{ color: "#dc2626", marginTop: 32 }}>
          <p>Error: {error}</p>
          <button onClick={() => setStatus("idle")}>Try Again</button>
        </div>
      )}
    </main>
  );
}
