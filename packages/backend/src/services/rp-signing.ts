import { ethers } from "ethers";

/**
 * World ID v4 RP Signing
 * Signs using ECDSA/secp256k1 with EIP-191 prefix.
 */
export function signRpRequest(signingKey: string, action: string) {
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + 3600;

  const message = `${action}${nonce}${createdAt}${expiresAt}`;

  const wallet = new ethers.Wallet(signingKey);
  // signMessageSync works in ethers v6 even in Workers (pure JS impl)
  const signature = wallet.signMessageSync(message);

  return {
    rp_id: "",
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
    signature,
  };
}
