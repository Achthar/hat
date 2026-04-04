/**
 * Circle Gateway nanopayment service.
 *
 * Uses EIP-3009 TransferWithAuthorization signed offchain, settled in batches
 * by Circle's Gateway. Gas-free for individual payments — Circle absorbs
 * settlement costs.
 *
 * Flow:
 *   1. Platform wallet signs EIP-3009 authorization (offchain, zero gas)
 *   2. Authorization submitted to Circle Gateway settlement API
 *   3. Gateway locks funds instantly, batches on-chain settlement
 */

import { ethers } from "ethers";
import {
  GATEWAY_SETTLE_URL,
  GATEWAY_NETWORK,
  ARC_TESTNET_RPC,
} from "@hat/common";
import type { NanopaymentResult } from "@hat/common";
import type { Env } from "../types.js";

// EIP-3009 domain for Gateway wallet on Arc Testnet
const GATEWAY_WALLET_DOMAIN = {
  name: "GatewayWalletBatched",
  version: "1",
  chainId: 5042002,
};

// EIP-3009 TransferWithAuthorization type
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
 * Sign an EIP-3009 TransferWithAuthorization for a nanopayment.
 * This is offchain — no gas required.
 */
async function signNanopayment(
  wallet: ethers.Wallet,
  to: string,
  amountUsdc: number
): Promise<{ payload: string; nonce: string }> {
  // USDC on Arc has 18 decimals (native gas token)
  const value = ethers.parseEther(String(amountUsdc));
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const now = Math.floor(Date.now() / 1000);
  // Circle requires validBefore >= 3 days from now
  const validBefore = now + 3 * 24 * 60 * 60;

  const message = {
    from: wallet.address,
    to,
    value: value.toString(),
    validAfter: 0,
    validBefore,
    nonce,
  };

  const signature = await wallet.signTypedData(
    GATEWAY_WALLET_DOMAIN,
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    message
  );

  // Encode the full payload for the settlement API
  const payload = JSON.stringify({
    signature,
    authorization: message,
    scheme: "exact",
    network: GATEWAY_NETWORK,
  });

  return { payload, nonce };
}

/**
 * Submit a signed nanopayment to Circle's Gateway for settlement.
 * Returns immediately — Circle batches and settles on-chain later.
 */
async function settleNanopayment(
  payload: string,
  recipientAddress: string,
  amountUsdc: number
): Promise<NanopaymentResult> {
  const value = ethers.parseEther(String(amountUsdc));

  const body = {
    paymentPayload: JSON.parse(payload),
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
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY);
  const { payload } = await signNanopayment(wallet, recipientAddress, amountUsdc);
  return settleNanopayment(payload, recipientAddress, amountUsdc);
}

/**
 * Get the Gateway wallet's USDC balance on Arc Testnet.
 */
export async function getGatewayBalance(env: Env): Promise<string> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  return ethers.formatEther(balance);
}

/**
 * Get the platform wallet address used for nanopayments.
 */
export function getPlatformAddress(env: Env): string {
  const wallet = new ethers.Wallet(env.GATEWAY_PRIVATE_KEY);
  return wallet.address;
}
