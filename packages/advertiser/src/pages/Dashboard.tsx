import { useState } from "react";

const API_BASE = "http://localhost:3001/api";

interface Campaign {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  budgetUsdc: number;
  spent: number;
}

export function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ title: "", imageUrl: "", targetUrl: "", budgetUsdc: "" });

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/ads/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advertiserId: "demo-advertiser", // TODO: wallet address
        title: form.title,
        imageUrl: form.imageUrl,
        targetUrl: form.targetUrl,
        budgetUsdc: Number(form.budgetUsdc),
      }),
    });
    const ad = await res.json();
    setCampaigns((prev) => [
      ...prev,
      { id: ad.id, title: ad.title, imageUrl: ad.imageUrl, targetUrl: ad.targetUrl, budgetUsdc: ad.budgetAllocatedUsdc, spent: 0 },
    ]);
    setForm({ title: "", imageUrl: "", targetUrl: "", budgetUsdc: "" });
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <h1>HAT Advertiser Dashboard</h1>
      <p style={{ color: "#6b7280" }}>Create ad campaigns and deposit USDC on Arc. Pay only for verified human attention.</p>

      <section style={{ marginTop: 32, padding: 24, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h2 style={{ marginTop: 0 }}>Create Campaign</h2>
        <form onSubmit={createCampaign} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Campaign title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={inputStyle}
            required
          />
          <input
            placeholder="Banner image URL"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            style={inputStyle}
            required
          />
          <input
            placeholder="Click-through URL"
            value={form.targetUrl}
            onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))}
            style={inputStyle}
            required
          />
          <input
            placeholder="Budget (USDC)"
            type="number"
            step="0.01"
            value={form.budgetUsdc}
            onChange={(e) => setForm((f) => ({ ...f, budgetUsdc: e.target.value }))}
            style={inputStyle}
            required
          />
          <button
            type="submit"
            style={{ padding: 12, background: "#6366f1", color: "white", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer" }}
          >
            Create & Deposit USDC on Arc
          </button>
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Your Campaigns</h2>
        {campaigns.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>No campaigns yet. Create one above.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ padding: 16, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 8px" }}>{c.title}</h3>
                <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#6b7280" }}>
                  <span>Budget: ${c.budgetUsdc} USDC</span>
                  <span>Spent: ${c.spent.toFixed(4)} USDC</span>
                  <span>Remaining: ${(c.budgetUsdc - c.spent).toFixed(4)} USDC</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
};
