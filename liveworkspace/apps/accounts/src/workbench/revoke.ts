// Ending a workbench's access from accounts' side (liveworkspace/docs/workbench.md "Ending access"): a token revoked
// ends its pairings and requests, an account closed drops the whole store. The store's rows go first, in the request;
// the rooms their sessions had open close through the index after it, off the response's path when it can be.

import type { Env } from '../env.ts';
import { hashApiToken, isApiTokenFormat } from '../tokens.ts';
import { closeRooms } from './index-access.ts';
import { workbenchStoreOf } from './store.ts';

type WaitUntil = (promise: Promise<unknown>) => void;

const runAfter = (promise: Promise<unknown>, waitUntil?: WaitUntil) => {
  const settled = promise.catch((err: unknown) =>
    console.warn('[workbench] room close failed', { error: String(err) }),
  );
  if (waitUntil) waitUntil(settled);
  return waitUntil ? Promise.resolve() : settled;
};

// A token of this account that still works: its read-only switch and expiry, from one indexed read.
export async function liveTokenFacts(
  db: D1Database,
  tokenId: string,
  userId: string,
  now = Date.now(),
): Promise<{ readOnly: boolean; expiresAt: number } | null> {
  const row = await db
    .prepare(
      `SELECT readOnly, expiresAt FROM api_token
        WHERE id = ? AND userId = ? AND revokedAt IS NULL AND expiresAt > ?`,
    )
    .bind(tokenId, userId, now)
    .first<{ readOnly: number; expiresAt: number }>();
  return row ? { readOnly: row.readOnly === 1, expiresAt: row.expiresAt } : null;
}

// The token a secret is, revoked or not, for ending its workbench after a self-revoke. Either prefix (`lwt_`, or an
// `lvd_` one carried over from the old livediagram.app, isApiTokenFormat).
export async function tokenBySecret(
  db: D1Database,
  token: string,
): Promise<{ id: string; userId: string } | null> {
  if (!isApiTokenFormat(token)) return null;
  return db
    .prepare('SELECT id, userId FROM api_token WHERE tokenHash = ?')
    .bind(await hashApiToken(token))
    .first<{ id: string; userId: string }>();
}

// A token was revoked: its pairings and requests go, and their rooms close. Never fails the revoke.
export async function endTokenWorkbench(
  env: Env,
  userId: string,
  tokenId: string,
  waitUntil?: WaitUntil,
): Promise<void> {
  if (!env.WORKBENCH) return;
  try {
    const ended = await workbenchStoreOf(env.WORKBENCH, userId).endAccess({ tokenId }, 'revoked');
    if (ended.rooms.length > 0) await runAfter(closeRooms(env, ended.rooms), waitUntil);
  } catch (err) {
    console.error('[workbench] ending a revoked token’s pairings failed', { error: String(err) });
  }
}

// An account closed: the store goes, and its rooms close. Never keeps the account open.
export async function closeAccountWorkbench(
  env: Env,
  userId: string,
  waitUntil?: WaitUntil,
): Promise<void> {
  if (!env.WORKBENCH) return;
  try {
    const rooms = await workbenchStoreOf(env.WORKBENCH, userId).close();
    if (rooms.length > 0) await runAfter(closeRooms(env, rooms), waitUntil);
  } catch (err) {
    console.error('[workbench] closing an account’s workbench failed', { error: String(err) });
  }
}
