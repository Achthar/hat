export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";

// Placeholder — fill after deployment
export const CONTRACTS = {
  PAYOUT_VAULT: "" as `0x${string}`,
  HAT_TOKEN: "" as `0x${string}`,
  USDC: "" as `0x${string}`,
} as const;

export const ARC_TESTNET = {
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://testnet-explorer.arc.circle.com" } },
} as const;

// Circle Gateway (nanopayments)
export const GATEWAY_API_TESTNET = "https://gateway-api-testnet.circle.com";
export const GATEWAY_NETWORK = "eip155:5042002"; // Arc Testnet
export const GATEWAY_SETTLE_URL = `${GATEWAY_API_TESTNET}/gateway/v1/x402/settle`;

export const WORLD_ID_ACTION = "hat-verify-human";
export const WORLD_ID_VERIFY_URL = "https://developer.world.org/api/v4/verify";

// Micropayment rate: USDC per second of verified attention (primary currency)
export const RATE_PER_SECOND_USDC = 0.0001; // $0.36/hour

// HAT incentive: bonus tokens earned proportional to USDC payments
// 10,000 HAT per $1 USDC earned — so at $0.0001/sec that's 1 HAT/sec
export const HAT_PER_USDC = 10_000;

// Minimum nanopayment signature validity (Circle requires >= 3 days)
export const NANOPAYMENT_VALIDITY_SECONDS = 3 * 24 * 60 * 60;
