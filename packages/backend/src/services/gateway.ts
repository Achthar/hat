/**
 * Circle Gateway nanopayment service for Arc Testnet.
 *
 * Uses @circle-fin/x402-batching GatewayClient for:
 *   - Depositing USDC into a Gateway Wallet (one-time on-chain tx)
 *   - Signing EIP-3009 TransferWithAuthorization offchain (gas-free)
 *   - Settling via Circle's batch facilitator
 *
 * On Arc, USDC is the native gas token (18 decimals). The Gateway Wallet
 * is a smart contract that holds deposited USDC and allows the owner to
 * sign offchain payment authorizations. Circle batches these into a single
 * on-chain transaction, absorbing gas costs.
 *
 * Flow:
 *   1. Platform deposits advertiser USDC into Gateway Wallet (on-chain)
 *   2. On settlement, platform signs EIP-3009 per viewer (offchain, gas-free)
 *   3. Submits to Circle settle API → funds locked instantly
 *   4. Circle batches settlement on-chain periodically
 */

import { ethers } from "ethers";
import {
  GATEWAY_SETTLE_URL,
  GATEWAY_NETWORK,
  ARC_TESTNET_RPC,
  NANOPAYMENT_VALIDITY_SECONDS,
} from "@hat/common";
import type { NanopaymentResult } from "@hat/common";
import type { Env } from "../types.js";

// ── Gateway Wallet ABI (minimal interface for deposit) ─────────
// The Gateway Wallet is a Circle-deployed smart contract per owner.
// Depositing = sending native USDC (msg.value) to the contract.
const GATEWAY_WALLET_ABI = [
  "function deposit() external payable",
  "function getBalance(address owner) external view returns (uint256)",
  "function owner() external view returns (address)",
];

// ── EIP-712 domain for GatewayWalletBatched ────────────────────
// The verifyingContract is the Gateway Wallet address. This MUST
// match the wallet where funds are deposited, otherwise settlement
// signatures are rejected.
function getEIP712Domain(gatewayWalletAddress: string) {
  return {
    name: "GatewayWalletBatched",
    version: "1",
    chainId: 5042002,
    verifyingContract: gatewayWalletAddress,
  };
}

// EIP-3009 TransferWithAuthorization types
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

/**
 * Deposit native USDC from the platform EOA into the Gateway Wallet contract.
 * This is an on-chain transaction (requires gas).
 */
export async function depositToGateway(
  env: Env,
  amountUsdc: number
): Promise<string> {
  if (!env.GATEWAY_WALLET_ADDRESS) {
    throw new Error("GATEWAY_WALLET_ADDRESS not configured");
  }

  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY, provider);

  const gatewayWallet = new ethers.Contract(
    env.GATEWAY_WALLET_ADDRESS,
    GATEWAY_WALLET_ABI,
    wallet
  );

  // On Arc, native USDC has 18 decimals — send as msg.value
  const value = ethers.parseEther(String(amountUsdc));
  const tx = await gatewayWallet.deposit({ value });
  const receipt = await tx.wait();

  console.log(`[gateway] Deposited ${amountUsdc} USDC to Gateway Wallet (tx: ${receipt.hash})`);
  return receipt.hash;
}

/**
 * Sign an EIP-3009 TransferWithAuthorization for a nanopayment.
 * Signs against the Gateway Wallet domain — offchain, zero gas.
 *
 * The `from` address is the Gateway Wallet contract (where funds are held),
 * and the signature is from the wallet owner (our platform key).
 */
async function signNanopayment(
  wallet: ethers.Wallet,
  gatewayWalletAddress: string,
  to: string,
  amountUsdc: number
): Promise<{ payload: Record<string, unknown>; nonce: string }> {
  // USDC on Arc has 18 decimals (native gas token)
  const value = ethers.parseEther(String(amountUsdc));
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + NANOPAYMENT_VALIDITY_SECONDS;

  const authorization = {
    from: gatewayWalletAddress, // Gateway Wallet contract holds the funds
    to,
    value: value.toString(),
    validAfter: 0,
    validBefore,
    nonce,
  };

  const domain = getEIP712Domain(gatewayWalletAddress);

  const signature = await wallet.signTypedData(
    domain,
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    authorization
  );

  const payload = {
    x402Version: 1,
    scheme: "exact",
    network: GATEWAY_NETWORK,
    payload: {
      signature,
      authorization,
    },
  };

  return { payload, nonce };
}

/**
 * Submit a signed nanopayment to Circle's Gateway settlement API.
 * Gateway locks funds instantly, then batches on-chain settlement.
 */
async function settleNanopayment(
  payload: Record<string, unknown>,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  const value = ethers.parseEther(String(amountUsdc));

  const body = {
    paymentPayload: payload,
    paymentRequirements: {
      scheme: "exact",
      network: GATEWAY_NETWORK,
      maxAmountRequired: value.toString(),
      resource: `hat:attention:${recipientAddress}`,
      description: "HAT verified attention micropayment",
      payTo: recipientAddress,
      maxTimeoutSeconds: 300,
    },
  };

  const res = await fetch(GATEWAY_SETTLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Gateway settlement failed: ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<NanopaymentResult>;
}

/**
 * Execute a nanopayment: sign offchain + submit to Gateway.
 * Returns the Circle transaction ID on success.
 */
export async function sendNanopayment(
  env: Env,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  if (!env.GATEWAY_WALLET_ADDRESS) {
    throw new Error("GATEWAY_WALLET_ADDRESS not configured — deposit first");
  }

  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY);
  const { payload } = await signNanopayment(
    wallet,
    env.GATEWAY_WALLET_ADDRESS,
    recipientAddress,
    amountUsdc
  );
  return settleNanopayment(payload, recipientAddress, amountUsdc);
}

/**
 * Get the Gateway Wallet's deposited USDC balance.
 */
export async function getGatewayBalance(env: Env): Promise<string> {
  if (!env.GATEWAY_WALLET_ADDRESS) {
    return "0";
  }

  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const balance = await provider.getBalance(env.GATEWAY_WALLET_ADDRESS);
  return ethers.formatEther(balance);
}

/**
 * Get the platform EOA address (the owner of the Gateway Wallet).
 */
export function getPlatformAddress(env: Env): string {
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY);
  return wallet.address;
}

/**
 * Get the Gateway Wallet contract address.
 */
export function getGatewayWalletAddress(env: Env): string | null {
  return env.GATEWAY_WALLET_ADDRESS || null;
}
