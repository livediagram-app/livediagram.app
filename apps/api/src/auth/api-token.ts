// API token mint + hashing (spec/61). A token is an opaque secret shown to the
// user ONCE; we persist only its SHA-256 hash and verify by hashing the
// presented value and looking that hash up (the hash is derived from 256 bits
// of randomness, so an indexed equality lookup leaks nothing useful — there's
// no low-entropy value to time-attack, unlike a password). Tokens authenticate
// signed-in (Clerk) accounts only; see spec/61.

import { bytesToBase64Url, sha256Hex } from '@livediagram/api-schema';

const TOKEN_PREFIX = 'lvd_';
const TOKEN_RANDOM_BYTES = 32; // 256 bits

// `lvd_<base64url(32 random bytes)>`. The prefix is greppable for leak
// scanning and disambiguates a token from a Clerk JWT in the same
// `Authorization: Bearer` header.
export function generateApiToken(): string {
  const bytes = new Uint8Array(TOKEN_RANDOM_BYTES);
  crypto.getRandomValues(bytes);
  return TOKEN_PREFIX + bytesToBase64Url(bytes);
}

// True for a string shaped like one of our tokens — lets the request resolver
// route a `Bearer lvd_…` to the token path and a `Bearer <jwt>` to Clerk.
export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length + 20;
}

// SHA-256 hex of the token — what we store and look up by.
export async function hashApiToken(token: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(token));
}

// Token lifetime: a fixed six calendar months from creation (spec/61). Returns
// the absolute `expires_at` (epoch ms). Six months is the hard maximum and the
// only option — there is no never-expires and no shorter value.
export function apiTokenExpiry(createdAt: number): number {
  const d = new Date(createdAt);
  // UTC so the +6-month roll is deterministic regardless of the runtime's
  // local timezone (Workers run in UTC; tests may not).
  d.setUTCMonth(d.getUTCMonth() + 6);
  return d.getTime();
}
