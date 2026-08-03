// api_tokens — external API credentials, owner-scoped to a Clerk account
// (spec/61). We store only the SHA-256 hash; the auth hot path hashes the
// presented token and looks the hash up here.

import { apiTokenExpiry, generateApiToken, hashApiToken } from '../auth/api-token';
import { rowToApiToken, type ApiTokenRow } from '../api-token-row';
import type { ApiTokenDTO, Env } from '../types';

const COLS =
  'id, owner_id, token_hash, name, created_at, last_used_at, expires_at, revoked, read_only';

// Hard cap on live tokens per account (spec/61): enough for any real
// integration set, low enough to keep the list + table tidy.
export const MAX_API_TOKENS_PER_OWNER = 10;

export async function listApiTokensByOwner(env: Env, ownerId: string): Promise<ApiTokenDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${COLS} FROM api_tokens WHERE owner_id = ? AND revoked = 0 ORDER BY created_at DESC`,
  )
    .bind(ownerId)
    .all<ApiTokenRow>();
  return (result.results ?? []).map(rowToApiToken);
}

// Live = not revoked and not expired. Drives the per-owner creation cap.
export async function countLiveApiTokens(env: Env, ownerId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM api_tokens WHERE owner_id = ? AND revoked = 0 AND expires_at > ?',
  )
    .bind(ownerId, Date.now())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createApiToken(
  env: Env,
  t: {
    id: string;
    ownerId: string;
    name: string | null;
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
    // Read-only token (spec/62 §4.11): may only GET/HEAD. Defaults to full
    // read+write when omitted.
    readOnly?: boolean;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO api_tokens (id, owner_id, token_hash, name, created_at, last_used_at, expires_at, revoked, read_only)
     VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?)`,
  )
    .bind(t.id, t.ownerId, t.tokenHash, t.name, t.createdAt, t.expiresAt, t.readOnly ? 1 : 0)
    .run();
}

/**
 * Mint a live API token: enforce the per-account cap, generate the secret,
 * hash it, and insert the row (spec/61).
 *
 * Two routes mint tokens — `POST /api/tokens` for a user in the Explorer, and
 * the OAuth exchange for an MCP client (spec/62) — and each used to carry its
 * own copy of this sequence. The rules that matter are all in it: the cap, the
 * six-month expiry, and the fact that only the HASH is ever stored. A second
 * copy is a second place for one of those to quietly stop being true, and the
 * OAuth path is the one no person watches as it happens.
 *
 * Returns null when the owner is already at the cap, so the caller answers
 * with its own 409 envelope. The plaintext `secret` comes back once, here, and
 * is never retrievable again.
 */
export async function mintApiToken(
  env: Env,
  t: { ownerId: string; name: string | null; readOnly?: boolean },
): Promise<{ secret: string; id: string; expiresAt: number } | null> {
  if ((await countLiveApiTokens(env, t.ownerId)) >= MAX_API_TOKENS_PER_OWNER) return null;
  const secret = generateApiToken();
  const now = Date.now();
  const id = crypto.randomUUID();
  const expiresAt = apiTokenExpiry(now);
  await createApiToken(env, {
    id,
    ownerId: t.ownerId,
    name: t.name,
    tokenHash: await hashApiToken(secret),
    createdAt: now,
    expiresAt,
    readOnly: t.readOnly,
  });
  return { secret, id, expiresAt };
}

// Resolve a presented token to its owner + token id — the auth hot path.
// Hashes the token, looks up a LIVE (non-revoked, unexpired) row, and stamps
// `last_used_at`. Returns `{ ownerId, tokenId }`, or null when no live token
// matches (revoked / expired / unknown all collapse to "not authenticated").
// The tokenId lets the request rate-limit on the specific token (spec/61 §3.5)
// rather than the owner, so one runaway integration can't burn the owner's
// interactive-app budget.
export async function resolveApiToken(
  env: Env,
  token: string,
): Promise<{ ownerId: string; tokenId: string; readOnly: boolean } | null> {
  const hash = await hashApiToken(token);
  const now = Date.now();
  const row = await env.DB.prepare(
    'SELECT id, owner_id, read_only FROM api_tokens WHERE token_hash = ? AND revoked = 0 AND expires_at > ?',
  )
    .bind(hash, now)
    .first<{ id: string; owner_id: string; read_only: number }>();
  if (!row) return null;
  await env.DB.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')
    .bind(now, row.id)
    .run();
  return { ownerId: row.owner_id, tokenId: row.id, readOnly: row.read_only === 1 };
}

// Revoke one of the owner's own tokens. Scoped by owner_id so a caller can
// only revoke their own. Returns whether a live row was actually flipped.
export async function revokeApiToken(env: Env, ownerId: string, id: string): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE api_tokens SET revoked = 1 WHERE id = ? AND owner_id = ? AND revoked = 0',
  )
    .bind(id, ownerId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// spec/64 (#3): tokens that expire within `windowMs` and haven't been warned
// yet (live only). The daily cron uses this to send a one-time "expiring soon"
// heads-up so a programmatic integration doesn't silently break. Bounded batch,
// soonest-first.
type ExpiringToken = { id: string; ownerId: string; name: string | null; expiresAt: number };
export async function apiTokensExpiringSoon(
  env: Env,
  now: number,
  windowMs: number,
  limit: number,
): Promise<ExpiringToken[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, owner_id, name, expires_at FROM api_tokens
     WHERE revoked = 0 AND expiry_warned_at IS NULL
       AND expires_at > ? AND expires_at <= ?
     ORDER BY expires_at ASC LIMIT ?`,
  )
    .bind(now, now + windowMs, limit)
    .all<{ id: string; owner_id: string; name: string | null; expires_at: number }>();
  return (results ?? []).map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    expiresAt: r.expires_at,
  }));
}

export async function markApiTokenExpiryWarned(env: Env, id: string): Promise<void> {
  await env.DB.prepare('UPDATE api_tokens SET expiry_warned_at = ? WHERE id = ?')
    .bind(Date.now(), id)
    .run();
}
