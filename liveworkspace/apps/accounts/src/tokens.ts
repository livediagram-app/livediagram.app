// API tokens (liveworkspace/docs/accounts.md "API tokens"): one per integration, belonging to the
// account, so the same token works on every app's API and MCP server. Only the SHA-256 hash is kept;
// the secret is shown once. A token is 32 random bytes, so an indexed lookup by its hash leaks nothing
// a timing attack could use.

export const API_TOKEN_PREFIX = 'lwt_';
const TOKEN_RANDOM_BYTES = 32;
// Live tokens one account can hold.
export const MAX_API_TOKENS_PER_ACCOUNT = 20;
export const TOKEN_NAME_MAX_LENGTH = 80;
// last_used is stamped at most this often, so a burst of MCP calls costs one write a minute.
export const LAST_USED_STAMP_WINDOW_MS = 60_000;

export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(API_TOKEN_PREFIX) && value.length > API_TOKEN_PREFIX.length + 20;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function generateApiToken(): string {
  return API_TOKEN_PREFIX + base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_RANDOM_BYTES)));
}

export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Six calendar months from creation, the only lifetime there is.
export function apiTokenExpiry(createdAt: number): number {
  const date = new Date(createdAt);
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.getTime();
}

export interface ApiToken {
  id: string;
  name: string;
  readOnly: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number;
}

type Row = Omit<ApiToken, 'readOnly'> & { readOnly: number };
const toToken = ({ readOnly, ...row }: Row): ApiToken => ({ ...row, readOnly: readOnly === 1 });

// An account's live tokens, newest first.
export async function listApiTokens(
  db: D1Database,
  userId: string,
  now = Date.now(),
): Promise<ApiToken[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, readOnly, createdAt, lastUsedAt, expiresAt FROM api_token
       WHERE userId = ? AND revokedAt IS NULL AND expiresAt > ? ORDER BY createdAt DESC`,
    )
    .bind(userId, now)
    .all<Row>();
  return results.map(toToken);
}

export function cleanTokenName(value: unknown, fallback: string): string {
  const name = typeof value === 'string' ? value.trim().slice(0, TOKEN_NAME_MAX_LENGTH) : '';
  return name || fallback;
}

// Makes a token, unless the account already has the most it may. The count and the insert are one
// statement, so two at once can't both slip under the cap. The secret comes back here, once.
export async function mintApiToken(
  db: D1Database,
  userId: string,
  options: { name: string; readOnly: boolean },
  now = Date.now(),
): Promise<(ApiToken & { secret: string }) | null> {
  const secret = generateApiToken();
  const id = crypto.randomUUID();
  const expiresAt = apiTokenExpiry(now);
  const result = await db
    .prepare(
      `INSERT INTO api_token (id, userId, tokenHash, name, readOnly, createdAt, lastUsedAt, expiresAt, revokedAt)
       SELECT ?, ?, ?, ?, ?, ?, NULL, ?, NULL
       WHERE (SELECT COUNT(*) FROM api_token WHERE userId = ? AND revokedAt IS NULL AND expiresAt > ?) < ?`,
    )
    .bind(
      id,
      userId,
      await hashApiToken(secret),
      options.name,
      options.readOnly ? 1 : 0,
      now,
      expiresAt,
      userId,
      now,
      MAX_API_TOKENS_PER_ACCOUNT,
    )
    .run();
  if ((result.meta.changes ?? 0) === 0) return null;
  return {
    id,
    name: options.name,
    readOnly: options.readOnly,
    createdAt: now,
    lastUsedAt: null,
    expiresAt,
    secret,
  };
}

export async function revokeApiToken(
  db: D1Database,
  userId: string,
  id: string,
  now = Date.now(),
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE api_token SET revokedAt = ? WHERE id = ? AND userId = ? AND revokedAt IS NULL')
    .bind(now, id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export interface VerifiedToken {
  tokenId: string;
  userId: string;
  name: string;
  email: string | null;
  readOnly: boolean;
  expiresAt: number;
}

// The account behind a presented token, for an app's API: null when it is unknown, revoked or
// expired. Stamps last used, at most once a window.
export async function verifyApiToken(
  db: D1Database,
  token: string,
  now = Date.now(),
): Promise<VerifiedToken | null> {
  if (!isApiTokenFormat(token)) return null;
  const row = await db
    .prepare(
      `SELECT t.id, t.userId, t.name, t.readOnly, t.expiresAt, t.lastUsedAt, u.email, u.emailVerified
       FROM api_token t JOIN "user" u ON u.id = t.userId
       WHERE t.tokenHash = ? AND t.revokedAt IS NULL AND t.expiresAt > ?`,
    )
    .bind(await hashApiToken(token), now)
    .first<{
      id: string;
      userId: string;
      name: string;
      readOnly: number;
      expiresAt: number;
      lastUsedAt: number | null;
      email: string;
      emailVerified: number;
    }>();
  if (!row) return null;
  const staleBefore = now - LAST_USED_STAMP_WINDOW_MS;
  if ((row.lastUsedAt ?? 0) < staleBefore) {
    await db
      .prepare(
        'UPDATE api_token SET lastUsedAt = ? WHERE id = ? AND (lastUsedAt IS NULL OR lastUsedAt < ?)',
      )
      .bind(now, row.id, staleBefore)
      .run();
  }
  return {
    tokenId: row.id,
    userId: row.userId,
    name: row.name,
    email: row.emailVerified ? row.email.toLowerCase() : null,
    readOnly: row.readOnly === 1,
    expiresAt: row.expiresAt,
  };
}

// A token revoking itself (a CLI signing out): presenting the secret is the authority.
export async function revokeApiTokenBySecret(
  db: D1Database,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  if (!isApiTokenFormat(token)) return false;
  const result = await db
    .prepare('UPDATE api_token SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL')
    .bind(now, await hashApiToken(token))
    .run();
  return (result.meta.changes ?? 0) > 0;
}

// Which of these token ids still work: an app asks about the tokens it has seen, so what hangs off a
// token revoked here (an embed's pairing, say) ends there too.
export const MAX_LIVE_TOKEN_IDS = 100;
export async function liveApiTokenIds(
  db: D1Database,
  ids: string[],
  now = Date.now(),
): Promise<string[]> {
  const asked = [...new Set(ids)].slice(0, MAX_LIVE_TOKEN_IDS);
  if (asked.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT id FROM api_token WHERE id IN (${asked.map(() => '?').join(', ')})
         AND revokedAt IS NULL AND expiresAt > ?`,
    )
    .bind(...asked, now)
    .all<{ id: string }>();
  return results.map((row) => row.id);
}
