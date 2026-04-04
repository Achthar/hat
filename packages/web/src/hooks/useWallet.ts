import { useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const API_BASE = "http://localhost:3001/api";

interface UserState {
  address: string | null;
  verified: boolean;
  totalHatEarned: number;
  totalUsdcEarned: number;
}

export function useWallet() {
  const [user, setUser] = useState<UserState>({
    address: null,
    verified: false,
    totalHatEarned: 0,
    totalUsdcEarned: 0,
  });
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another wallet extension");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts[0];

      // Register with backend
      const res = await fetch(`${API_BASE}/auth/connect-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      setUser({
        address,
        verified: data.verified,
        totalHatEarned: data.totalHatEarned ?? 0,
        totalUsdcEarned: data.totalUsdcEarned ?? 0,
      });
    } catch (e) {
      console.error("Wallet connection failed:", e);
    } finally {
      setConnecting(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user.address) return;
    try {
      const res = await fetch(`${API_BASE}/auth/user/${user.address}`);
      if (res.ok) {
        const data = await res.json();
        setUser((prev) => ({
          ...prev,
          verified: data.verified,
          totalHatEarned: data.totalHatEarned,
          totalUsdcEarned: data.totalUsdcEarned,
        }));
      }
    } catch {
      // silent
    }
  }, [user.address]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setUser({ address: null, verified: false, totalHatEarned: 0, totalUsdcEarned: 0 });
      } else {
        setUser((prev) => ({ ...prev, address: accs[0] }));
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  return { user, connect, connecting, refreshUser };
}
