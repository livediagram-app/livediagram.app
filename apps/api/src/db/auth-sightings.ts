// auth_sessions + auth_accounts (migration 0047): first sightings of a Clerk
// session and of a Clerk account, which is how the api worker counts
// Session·SignedIn / SignedUp exactly once each (spec/22). Both writes are
// INSERT OR IGNORE keyed on the id, so "was this the first time?" is answered
// atomically by the row count: two concurrent requests carrying the same new
// session can't both claim it.

import type { Env } from '../types';

// True only when this call created the row: the session had never been seen.
export async function recordSessionSighting(env: Env, sessionId: string): Promise<boolean> {
  const res = await env.DB.prepare(
    'INSERT OR IGNORE INTO auth_sessions (session_id, first_seen_at) VALUES (?, ?)',
  )
    .bind(sessionId, Date.now())
    .run();
  return res.meta.changes === 1;
}

// True only when this call created the row: the account had never been seen.
export async function recordAccountSighting(env: Env, ownerId: string): Promise<boolean> {
  const res = await env.DB.prepare(
    'INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at) VALUES (?, ?)',
  )
    .bind(ownerId, Date.now())
    .run();
  return res.meta.changes === 1;
}

// Daily retention sweep. A session id carries no owner, so this is a storage
// bound rather than a privacy one; a session still alive past the floor would
// be re-seen, and its long-verified first factor keeps it from counting again
// (see auth/session-telemetry.ts).
export async function deleteOldSessionSightings(env: Env, cutoffMs: number): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM auth_sessions WHERE first_seen_at < ?')
    .bind(cutoffMs)
    .run();
  return res.meta.changes ?? 0;
}
