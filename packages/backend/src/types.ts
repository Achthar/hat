export type Env = {
  DB: D1Database;
  WORLD_ID_RP_ID: string;
  WORLD_ID_SIGNING_KEY: string;
  DEPLOYER_PRIVATE_KEY: string;
  ARC_RPC_URL: string;
  // Circle Gateway nanopayments
  GATEWAY_PRIVATE_KEY: string; // Platform EOA key (owner of Gateway Wallet)
  GATEWAY_WALLET_ADDRESS: string; // Gateway Wallet smart contract on Arc
};
