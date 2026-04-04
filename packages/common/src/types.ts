export interface AdBanner {
  id: string;
  advertiserId: string;
  imageUrl: string;
  targetUrl: string;
  title: string;
  budgetAllocatedUsdc: number;
  budgetSpentUsdc: number;
  active: boolean;
}

export interface ViewSession {
  id: string;
  userId: string;
  adId: string;
  startedAt: number;
  endedAt?: number;
  durationSeconds: number;
  verified: boolean; // World ID verified
  settled: boolean;
  usdcEarned: number;
  hatEarned: number;
}

export interface WorldIdProof {
  proof: string[];
  merkle_root?: string;
  nullifier_hash: string;
  verification_level: "orb" | "document" | "selfie";
}

export interface AdvertiserCampaign {
  id: string;
  advertiserId: string;
  banners: AdBanner[];
  totalBudgetUsdc: number;
  depositedUsdc: number;
  spentUsdc: number;
  active: boolean;
}

export interface UserProfile {
  address: `0x${string}`;
  worldIdNullifier?: string;
  verified: boolean;
  totalHatEarned: number;
  totalUsdcEarned: number;
}

export interface SettlementBatch {
  id: string;
  recipients: `0x${string}`[];
  usdcAmounts: bigint[];
  hatAmounts: bigint[];
  txHash?: string;
  settledAt?: number;
}
