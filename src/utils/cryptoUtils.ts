import * as ed from '@noble/ed25519';
// @ts-ignore
import { sha512, sha256 } from '@noble/hashes/sha2.js';

// noble-ed25519 v3 requires sha512 to be set on etc
// @ts-ignore
ed.etc.sha512Sync = (...m: any[]) => sha512(ed.etc.concatBytes(...m));
// @ts-ignore
ed.etc.sha512Async = (...m: any[]) => Promise.resolve(sha512(ed.etc.concatBytes(...m)));

const PRIVATE_KEY_STORAGE_KEY = 'nova_device_private_key';

export interface DeviceIdentity {
  id: string;
  publicKey: string;
  signature: string;
  nonce: string;
  signedAt: number;
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface DeviceIdentityParams {
  clientId: string;
  clientMode: string;
  platform: string;
  role: string;
  scopes: string[];
  token?: string;
}

/**
 * Returns a stable device identity (persisted in localStorage).
 * Signs the payload format expected by OpenClaw gateway v3.
 */
export async function getOrCreateDeviceIdentity(
  challengeNonce: string,
  params: DeviceIdentityParams
): Promise<DeviceIdentity> {
  let privateKeyHex = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  
  if (!privateKeyHex) {
    // Generate new secret key (32 bytes)
    const privKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    privateKeyHex = ed.etc.bytesToHex(privKeyBytes);
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKeyHex);
  }

  const privKey = ed.etc.hexToBytes(privateKeyHex);
  const pubKey = await ed.getPublicKeyAsync(privKey);
  
  // 1. Device ID is the sha256 hex of the raw public key bytes
  const pubKeyHash = sha256(pubKey);
  const deviceId = ed.etc.bytesToHex(pubKeyHash);
  
  // 2. PublicKey must be base64url encoded
  const publicKeyBase64Url = base64UrlEncode(pubKey);
  
  const signedAtMs = Math.floor(Date.now());
  
  // 3. Construct the exact "v3" payload string to sign
  const payloadStr = [
    "v3",
    deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(signedAtMs),
    params.token || "",
    challengeNonce,
    params.platform,
    ""                     // deviceFamily
  ].join('|');
  
  const payloadBytes = new TextEncoder().encode(payloadStr);
  const signatureBytes = await ed.signAsync(payloadBytes, privKey);
  
  // 4. Signature must be base64url encoded
  const signatureBase64Url = base64UrlEncode(signatureBytes);

  return {
    id: deviceId,
    publicKey: publicKeyBase64Url,
    signature: signatureBase64Url,
    nonce: challengeNonce,
    signedAt: signedAtMs
  };
}
