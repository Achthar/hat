/**
 * Circle Gateway nanopayment service for Arc Testnet.
 *
 * Two modes:
 *   A) Gateway Wallet (preferred) — offchain EIP-3009 signatures,
 *      Circle batches settlement, zero gas per payment.
 *   B) Direct transfer (fallback) — on-chain native USDC send from
 *      platform EOA. Used when Gateway Wallet isn't provisioned yet.
 *
 * On Arc, USDC is the native gas token (18 decimals).
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
const GATEWAY_WALLET_ABI = [
  "function deposit() external payable",
  "function getBalance(address owner) external view returns (uint256)",
  "function owner() external view returns (address)",
];

// ── EIP-712 domain for GatewayWalletBatched ────────────────────
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

// ═══════════════════════════════════════════════════════════════
// Mode A: Gateway Wallet (offchain EIP-3009 + Circle batch settle)
// ═══════════════════════════════════════════════════════════════

export async function depositToGateway(env: Env, amountUsdc: number): Promise<string> {
  if (!env.GATEWAY_WALLET_ADDRESS) {
    throw new Error("GATEWAY_WALLET_ADDRESS not configured");
  }
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY, provider);
  const gatewayWallet = new ethers.Contract(env.GATEWAY_WALLET_ADDRESS, GATEWAY_WALLET_ABI, wallet);
  const value = ethers.parseEther(String(amountUsdc));
  const tx = await gatewayWallet.deposit({ value });
  const receipt = await tx.wait();
  console.log(`[gateway] Deposited ${amountUsdc} USDC to Gateway Wallet (tx: ${receipt.hash})`);
  return receipt.hash;
}

async function signNanopayment(
  wallet: ethers.Wallet,
  gatewayWalletAddress: string,
  to: string,
  amountUsdc: number
): Promise<{ payload: Record<string, unknown>; nonce: string }> {
  const value = ethers.parseEther(String(amountUsdc));
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + NANOPAYMENT_VALIDITY_SECONDS;

  const authorization = {
    from: gatewayWalletAddress,
    to,
    value: value.toString(),
    validAfter: 0,
    validBefore,
    nonce,
  };

  const signature = await wallet.signTypedData(
    getEIP712Domain(gatewayWalletAddress),
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    authorization
  );

  return {
    payload: {
      x402Version: 1,
      scheme: "exact",
      network: GATEWAY_NETWORK,
      payload: { signature, authorization },
    },
    nonce,
  };
}

async function settleViaGateway(
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

// ═══════════════════════════════════════════════════════════════
// Mode B: Direct native USDC transfer (fallback when no Gateway)
// ═══════════════════════════════════════════════════════════════

async function sendDirectTransfer(
  env: Env,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY, provider);
  const value = ethers.parseEther(String(amountUsdc));

  const tx = await wallet.sendTransaction({ to: recipientAddress, value });
  const receipt = await tx.wait();

  console.log(`[gateway] Direct USDC transfer to ${recipientAddress}: $${amountUsdc} (tx: ${receipt!.hash})`);
  return {
    success: true,
    payer: wallet.address,
    transaction: receipt!.hash,
    network: GATEWAY_NETWORK,
  };
}

// ═══════════════════════════════════════════════════════════════
// Public API — auto-selects Gateway or direct transfer
// ═══════════════════════════════════════════════════════════════

/**
 * Send a nanopayment to a viewer.
 *
 * If GATEWAY_WALLET_ADDRESS is set → signs EIP-3009 offchain and submits
 * to Circle's batch settlement (gas-free per payment).
 *
 * Otherwise → falls back to a direct native USDC transfer on Arc
 * (costs gas per tx, but works without Gateway provisioning).
 */
export async function sendNanopayment(
  env: Env,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  // Mode A: Gateway Wallet nanopayments (preferred)
  if (env.GATEWAY_WALLET_ADDRESS) {
    const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY);
    const { payload } = await signNanopayment(wallet, env.GATEWAY_WALLET_ADDRESS, recipientAddress, amountUsdc);
    return settleViaGateway(payload, recipientAddress, amountUsdc);
  }

  // Mode B: Direct native USDC transfer (fallback)
  console.log("[gateway] No Gateway Wallet configured — using direct transfer");
  return sendDirectTransfer(env, recipientAddress, amountUsdc);
}

export async function getGatewayBalance(env: Env): Promise<string> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  // Check the Gateway Wallet if set, otherwise the platform EOA
  const address = env.GATEWAY_WALLET_ADDRESS || new ethers.Wallet(env.GATEWAY_PRIVATE_KEY).address;
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export function getPlatformAddress(env: Env): string {
  return new ethers.Wallet(env.GATEWAY_PRIVATE_KEY).address;
}

export function getGatewayWalletAddress(env: Env): string | null {
  return env.GATEWAY_WALLET_ADDRESS || null;
}
