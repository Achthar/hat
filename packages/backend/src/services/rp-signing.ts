/**
 * World ID v4 RP Signing — reimplemented for Cloudflare Workers.
 *
 * The official @worldcoin/idkit-server signRequest() blocks non-Node.js envs.
 * This replicates the exact same algorithm using ethers (which works in Workers).
 *
 * Message format: version(1) || nonce(32) || createdAt_u64_be(8) || expiresAt_u64_be(8) || action?(32)
 */
import { ethers } from "ethers";

const RP_SIGNATURE_MSG_VERSION = 1;

/** keccak256(input) >> 8, returned as 32 bytes */
function hashToField(input: Uint8Array): Uint8Array {
  const hash = BigInt(ethers.keccak256(input)) >> 8n;
  return ethers.getBytes("0x" + hash.toString(16).padStart(64, "0"));
}

/** Build the binary message: version(1) || nonce(32) || createdAt(8) || expiresAt(8) || action?(32) */
function computeRpSignatureMessage(
  nonceBytes: Uint8Array,
  createdAt: number,
  expiresAt: number,
  action?: string
): Uint8Array {
  const actionBytes = action !== undefined
    ? hashToField(new TextEncoder().encode(action))
    : undefined;

  const message = new Uint8Array(49 + (actionBytes?.length ?? 0));
  message[0] = RP_SIGNATURE_MSG_VERSION;
  message.set(nonceBytes, 1);

  const view = new DataView(message.buffer);
  view.setBigUint64(33, BigInt(createdAt), false); // big-endian
  view.setBigUint64(41, BigInt(expiresAt), false);

  if (actionBytes) {
    message.set(actionBytes, 49);
  }

  return message;
}

export function signRpRequest(signingKey: string, action: string) {
  // Generate random nonce → hashToField for 32-byte field element
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonceBytes = hashToField(randomBytes);

  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + 3600; // 1 hour TTL

  // Build the binary message
  const message = computeRpSignatureMessage(nonceBytes, createdAt, expiresAt, action);

  // EIP-191 sign: ethers.Wallet.signMessageSync does the "\x19Ethereum Signed Message:\n" prefix
  const wallet = new ethers.Wallet(signingKey);
  const signature = wallet.signMessageSync(message);

  return {
    rp_id: "", // filled in by the route
    nonce: ethers.hexlify(nonceBytes),
    created_at: createdAt,
    expires_at: expiresAt,
    signature,
  };
}
