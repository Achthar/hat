export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC = "https://testnet-rpc.arc.circle.com";

// Placeholder — fill after deployment
export const CONTRACTS = {
  PAYOUT_VAULT: "" as `0x${string}`,
  HAT_TOKEN: "" as `0x${string}`,
  USDC: "" as `0x${string}`,
} as const;

export const WORLD_ID_ACTION = "hat-verify-human";
export const WORLD_ID_VERIFY_URL = "https://developer.world.org/api/v4/verify";

// Micropayment rate: USDC per second of verified attention
export const RATE_PER_SECOND_USDC = 0.0001; // $0.36/hour
export const HAT_PER_SECOND = 1; // 1 HAT token per second of attention
