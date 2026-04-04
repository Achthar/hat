/**
 * Circle Gateway nanopayment service for Arc Testnet.
 *
 * Two modes:
 *   A) Gateway Wallet (preferred) — offchain EIP-3009 signatures against
 *      the shared GatewayWalletBatched contract. Circle batches settlement.
 *   B) Direct transfer (fallback) — on-chain native USDC send from
 *      platform EOA. Used when Gateway Wallet isn't provisioned.
 *
 * The GatewayWalletBatched is a shared contract (same address on every chain):
 *   0x0077777d7EBA4688BDeF3E311b846F25870A19B9
 *
 * It tracks per-depositor balances internally. The `from` in EIP-3009
 * is the depositor EOA (our platform wallet), not the contract.
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

// GatewayWalletBatched contract — same deterministic address on all chains
const GATEWAY_WALLET_CONTRACT = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

// Minimal ABI for deposit (payable function that credits msg.sender's balance)
const GATEWAY_WALLET_ABI = [
  "function deposit() external payable",
];

// USDC token address on Arc Testnet (ERC-20 interface to native balance, 6 decimals)
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const USDC_DECIMALS = 6; // ERC-20 USDC on Arc uses 6 decimals

/** Truncate a float to a fixed number of decimal places (avoids floating point drift) */
function truncateDecimals(n: number, decimals: number): string {
  // Use toFixed to clamp, then strip trailing zeros for parseUnits/parseEther
  return Number(n.toFixed(decimals)).toString();
}

// ── EIP-712 domain for GatewayWalletBatched ────────────────────
// verifyingContract = the shared GatewayWalletBatched contract
const EIP712_DOMAIN = {
  name: "GatewayWalletBatched",
  version: "1",
  chainId: 5042002,
  verifyingContract: GATEWAY_WALLET_CONTRACT,
};

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

/**
 * Deposit native USDC into the GatewayWalletBatched contract.
 * This credits the platform EOA's balance within the shared contract.
 */
export async function depositToGateway(env: Env, amountUsdc: number): Promise<string> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY, provider);
  const gateway = new ethers.Contract(GATEWAY_WALLET_CONTRACT, GATEWAY_WALLET_ABI, wallet);
  const value = ethers.parseEther(truncateDecimals(amountUsdc, 18));
  const tx = await gateway.deposit({ value });
  const receipt = await tx.wait();
  console.log(`[gateway] Deposited ${amountUsdc} USDC to Gateway (tx: ${receipt.hash})`);
  return receipt.hash;
}

/**
 * Sign an EIP-3009 TransferWithAuthorization.
 *
 * `from` = platform EOA (the depositor whose balance is tracked in the contract)
 * `to` = recipient viewer address
 * Signed by the platform EOA private key against the GatewayWalletBatched domain.
 */
async function signNanopayment(
  wallet: ethers.Wallet,
  to: string,
  amountUsdc: number
): Promise<{ payload: Record<string, unknown>; nonce: string }> {
  // Gateway operates on the ERC-20 layer (6 decimals)
  const value = ethers.parseUnits(truncateDecimals(amountUsdc, USDC_DECIMALS), USDC_DECIMALS);
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + NANOPAYMENT_VALIDITY_SECONDS;

  const authorization = {
    from: wallet.address,  // EOA = the depositor in the shared Gateway contract
    to,
    value: value.toString(),
    validAfter: 0,
    validBefore,
    nonce,
  };

  const signature = await wallet.signTypedData(
    EIP712_DOMAIN,
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

/**
 * Submit a signed nanopayment to Circle's Gateway settlement API.
 * Gateway locks funds instantly, then batches on-chain settlement.
 */
async function settleViaGateway(
  payload: Record<string, unknown>,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  // Gateway operates on the ERC-20 layer (6 decimals)
  const value = ethers.parseUnits(truncateDecimals(amountUsdc, USDC_DECIMALS), USDC_DECIMALS);
  const body = {
    paymentPayload: payload,
    paymentRequirements: {
      scheme: "exact",
      network: GATEWAY_NETWORK,
      asset: USDC_ADDRESS,
      amount: value.toString(),
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
  // Native transfers use 18 decimals
  const value = ethers.parseEther(truncateDecimals(amountUsdc, 18));

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
 * Otherwise → falls back to a direct native USDC transfer on Arc.
 */
/**
 * Send a nanopayment to a viewer.
 *
 * Tries Gateway first (gas-free), falls back to direct transfer.
 * Gateway requires the EOA to have deposited USDC into the
 * GatewayWalletBatched contract — if not, direct transfer is used.
 */
export async function sendNanopayment(
  env: Env,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  // Mode A: try Gateway nanopayments if configured
  if (env.GATEWAY_WALLET_ADDRESS) {
    try {
      const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY);
      const { payload } = await signNanopayment(wallet, recipientAddress, amountUsdc);
      return await settleViaGateway(payload, recipientAddress, amountUsdc);
    } catch (e) {
      // Gateway failed (likely no deposit) — fall through to direct transfer
      console.warn(`[gateway] Gateway settlement failed, falling back to direct transfer:`, e);
    }
  }

  // Mode B: Direct native USDC transfer (18 decimals)
  return sendDirectTransfer(env, recipientAddress, amountUsdc);
}

export async function getGatewayBalance(env: Env): Promise<string> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const address = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY).address;
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export function getPlatformAddress(env: Env): string {
  return new ethers.Wallet(env.GATEWAY_PRIVATE_KEY).address;
}

export function getGatewayWalletAddress(env: Env): string | null {
  return env.GATEWAY_WALLET_ADDRESS || null;
}

export function getGatewayContract(): string {
  return GATEWAY_WALLET_CONTRACT;
}
