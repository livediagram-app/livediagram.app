// A revoked token's AI tool leaves the apps (liveworkspace/docs/specs/003-accounts/accounts.md "Revoking a token tells
// the apps", Work Tracker 1294): a liveplanner plan knows an AI tool by its token's name and its person, and can hand it
// cards. Once the person's last writable token under that name is revoked, the index is told, and it tells every plan
// the person may have reached, which forgets the tool and hands its cards back. Runs after the revoke's answer and
// never fails it: a failure is logged, and the tool's cards stay as they were.

import type { Env } from './env.ts';
import { teamsClaim } from './teams/reads.ts';

type WaitUntil = (promise: Promise<unknown>) => void;

// A token's name as the apps compare it: trimmed, case aside.
const nameKey = (name: string) => name.trim().toLowerCase();

// Whether a revoked token was the last that could act as its tool, and the tool's name when it was. Null for a token
// that was read-only (never a tool), has no name, or shares its name with a live writable token of the same account.
export async function revokedTool(
  db: D1Database,
  userId: string,
  tokenId: string,
  now = Date.now(),
): Promise<string | null> {
  const revoked = await db
    .prepare('SELECT name, readOnly FROM api_token WHERE id = ? AND userId = ?')
    .bind(tokenId, userId)
    .first<{ name: string; readOnly: number }>();
  const client = revoked?.name.trim() ?? '';
  if (!revoked || revoked.readOnly === 1 || !client) return null;
  const { results } = await db
    .prepare(
      `SELECT name FROM api_token
        WHERE userId = ? AND revokedAt IS NULL AND expiresAt > ? AND readOnly = 0 AND id <> ?`,
    )
    .bind(userId, now, tokenId)
    .all<{ name: string }>();
  return results.some((r) => nameKey(r.name) === nameKey(client)) ? null : client;
}

// Tells the index (POST {INDEX_URL}/internal/assistant-revoked {personId, client, teamIds}, the merge key) when the
// revoked token was its tool's last. Never throws.
export async function signalAssistantRevoked(
  env: Env,
  userId: string,
  tokenId: string,
): Promise<void> {
  const key = env.INDEX_MERGE_KEY?.trim();
  if (!env.INDEX_URL || !key) return;
  try {
    const client = await revokedTool(env.AUTH_DB, userId, tokenId);
    if (!client) return;
    const teamIds = (await teamsClaim(env.AUTH_DB, userId)).map((t) => t.id);
    const send = env.INDEX ? env.INDEX.fetch.bind(env.INDEX) : fetch;
    const response = await send(`${env.INDEX_URL}/internal/assistant-revoked`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ personId: userId, client, teamIds }),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`status_${response.status}`);
  } catch (err) {
    console.warn('[tokens] assistant revoke signal', { error: String(err) });
  }
}

// After a revoke: the signal off the request's path.
export function tellAssistantRevoked(
  env: Env,
  userId: string,
  tokenId: string,
  waitUntil: WaitUntil,
): void {
  waitUntil(signalAssistantRevoked(env, userId, tokenId));
}
