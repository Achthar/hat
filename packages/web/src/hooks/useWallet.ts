import { useState, useCallback, useEffect } from "react";
import { useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { DEFAULT_API_URL } from "@hat/common";

const API_BASE = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

interface UserState {
  address: string | null;
  verified: boolean;
  totalHatEarned: number;
  totalUsdcEarned: number;
}

export function useWallet() {
  const { address: appKitAddress, isConnected } = useAppKitAccount();
  const { open } = useAppKit();
  const [user, setUser] = useState<UserState>({
    address: null,
    verified: false,
    totalHatEarned: 0,
    totalUsdcEarned: 0,
  });
  const [connecting, setConnecting] = useState(false);

  // Sync AppKit connection state
  useEffect(() => {
    if (isConnected && appKitAddress) {
      registerAddress(appKitAddress);
    } else if (!isConnected) {
      setUser({ address: null, verified: false, totalHatEarned: 0, totalUsdcEarned: 0 });
    }
  }, [isConnected, appKitAddress]);

  async function registerAddress(address: string) {
    try {
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

      // Notify extension of wallet connection
      try {
        window.postMessage({
          type: "HAT_WALLET_CONNECTED",
          address,
          verified: data.verified,
        }, "*");
      } catch { /* not in extension context */ }
    } catch {
      setUser((prev) => ({ ...prev, address }));
    }
  }

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await open();
    } catch (e) {
      console.error("Wallet connection failed:", e);
    } finally {
      setConnecting(false);
    }
  }, [open]);

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

  return { user, connect, connecting, refreshUser };
}
