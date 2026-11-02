// Sealing the Google refresh token at rest (liveworkspace/docs/specs/005-drive/drive.md "Tokens").
//
// AES-GCM under DRIVE_TOKEN_KEY (base64 of 32 bytes), sealed by @liveworkspace/api-kit's `sealed` (which webhooks seal
// their URLs and secrets with too): a fresh 12-byte IV per seal, and the person's id as additional authenticated
// data, so a sealed value copied onto another person's store fails to open rather than handing them someone else's
// Google access. Stored as `v1.<iv>.<ciphertext>`, both base64url.

import { importSealKey, seal, sealKeyBytes, unseal } from '@liveworkspace/api-kit/sealed';

/** The raw key bytes, or null when the secret is absent or not 32 bytes of base64. */
export const driveKeyBytes = sealKeyBytes;

export const importDriveKey = importSealKey;

export const sealRefreshToken = (key: CryptoKey, personId: string, token: string) =>
  seal(key, personId, token);

/** The token, or null for anything that doesn't open: another person, another key, a tampered value. */
export const openRefreshToken = (key: CryptoKey, personId: string, sealed: string) =>
  unseal(key, personId, sealed);
