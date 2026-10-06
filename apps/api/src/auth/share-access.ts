// The share-side access rules every document gate is built from: who counts
// as the owner, which share codes belong to a document, and the share-password
// check (docs/specs/013-workspace/share-password.md). The REST gates (document-access.ts), the share-code resolve
// (routes/share.ts), and the realtime-room upgrade (routes/document-room-routes.ts)
// all compose these, so a rule change lands in one place rather than drifting
// between three copies. Kept apart from document-access.ts so the room route
// can reuse the rules while its tests stub the whole-request gates.

import { sha256Hex, type ShareLink } from '@livediagram/api-schema';
import { getDocumentSharePassword, getShareLink, upgradeDocumentSharePassword } from '../db';
import type { Env } from '../types';
import { hashSharePassword, verifySharePassword } from './share-password-hash';

// The personal-document owner rule. The hybrid `owner` id (Clerk sub OR the
// unsigned X-Owner-Id guest header, or the room's `?o=`) is trusted ONLY on a
// personal document, where a guest id is an unguessable UUID. A TEAM document's
// owner id is a Clerk id deliberately visible to every teammate, so a removed
// member could present it; team access goes through verified membership.
export function isPersonalOwner(
  owner: string | null,
  ownerId: string,
  teamId: string | null,
): boolean {
  return !teamId && !!owner && owner === ownerId;
}

// Resolves a share code to its link, but only when the link is for THIS
// document: the document-id match stops a code for a different document leaking
// access through. Null for a missing code, an unknown / revoked one, or a
// mismatch.
export async function shareLinkForDocument(
  env: Env,
  shareCode: string | null,
  documentId: string,
): Promise<ShareLink | null> {
  if (!shareCode) return null;
  const link = await getShareLink(env, shareCode);
  return link && link.documentId === documentId ? link : null;
}

// The password a request carries (`X-Share-Password`, or the room's `p`), with
// the caller's network (`clientRateKey`) whose guessing budget a check spends.
export type SharePasswordAttempt = { value: string; rateKey: string };

// Correct (stored value, provided password) pairs, so a visitor who sends the
// password on every request pays for one PBKDF2 derivation per isolate, not
// one per request (docs/specs/013-workspace/share-password.md "A verified cache"). The stored value
// is part of the key, so a changed or removed password misses at once. Holds a
// SHA-256 of the provided password, never the password itself.
export const VERIFIED_TTL_MS = 10 * 60 * 1000;
export const VERIFIED_MAX = 1000;
const verified = new Map<string, number>();

async function verifiedKey(stored: string, provided: string): Promise<string> {
  return `${stored}\n${await sha256Hex(new TextEncoder().encode(provided))}`;
}

function isVerified(key: string, now: number): boolean {
  const expires = verified.get(key);
  if (expires === undefined) return false;
  if (expires > now) return true;
  verified.delete(key);
  return false;
}

function rememberVerified(key: string, now: number): void {
  // Oldest first: a Map iterates in insertion order, so the first key is the
  // longest-held entry.
  if (verified.size >= VERIFIED_MAX) verified.delete(verified.keys().next().value!);
  verified.set(key, now + VERIFIED_TTL_MS);
}

export function clearVerifiedSharePasswords(): void {
  verified.clear();
}

// Share-password check (docs/specs/013-workspace/share-password.md). `ok` when the document has no password or the
// provided one matches; otherwise `missing` (none sent) or `invalid` (sent,
// wrong, or the caller's network is out of guesses: answered the same way, so
// an over-limit caller never learns whether a guess was right). The share-code
// resolve maps the two failures to 401 / 403 for the client's password gate;
// every other caller only asks whether it is `ok`.
export type SharePasswordStatus = 'ok' | 'missing' | 'invalid';

export async function sharePasswordStatus(
  env: Env,
  documentId: string,
  attempt: SharePasswordAttempt | null,
): Promise<SharePasswordStatus> {
  const stored = await getDocumentSharePassword(env, documentId);
  if (!stored) return 'ok';
  if (attempt === null) return 'missing';
  const now = Date.now();
  const key = await verifiedKey(stored, attempt.value);
  if (isVerified(key, now)) return 'ok';
  // Every derivation spends one unit of the network's budget, so guessing is
  // bounded on every share-code door, and so is the CPU each guess costs.
  if (env.SHARE_RATE_LIMITER) {
    const { success } = await env.SHARE_RATE_LIMITER.limit({ key: `share-pw:${attempt.rateKey}` });
    if (!success) {
      console.warn('[share-password] guess budget spent', { documentId });
      return 'invalid';
    }
  }
  const { ok, legacy } = await verifySharePassword(stored, attempt.value);
  if (!ok) return 'invalid';
  rememberVerified(key, now);
  if (legacy) {
    // The first correct entry of a pre-hashing password stores its hash.
    // Best effort: a failed write just leaves the legacy value for next time.
    try {
      await upgradeDocumentSharePassword(
        env,
        documentId,
        stored,
        await hashSharePassword(attempt.value),
      );
      console.info('[share-password] legacy value upgraded', { documentId });
    } catch (err) {
      console.warn('[share-password] legacy upgrade failed', { documentId, err: String(err) });
    }
  }
  return 'ok';
}

export async function sharePasswordOk(
  env: Env,
  documentId: string,
  attempt: SharePasswordAttempt | null,
): Promise<boolean> {
  return (await sharePasswordStatus(env, documentId, attempt)) === 'ok';
}
