// auth_accounts (the baseline migration): the first sighting of each account, which is how the api
// worker tells a sign-up from a sign-in (docs/specs/017-telemetry/telemetry.md).
// INSERT OR IGNORE keyed on the id, so "was this the first time?" is answered
// atomically by the row count.

import type { Env } from '../types';

// True only when this call created the row: the account had never been seen.
export async function recordAccountSighting(env: Env, ownerId: string): Promise<boolean> {
  const res = await env.DB.prepare(
    'INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at) VALUES (?, ?)',
  )
    .bind(ownerId, Date.now())
    .run();
  return res.meta.changes === 1;
}
