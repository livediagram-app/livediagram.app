import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testD1 } from './test-d1.ts';
import {
  apiTokenExpiry,
  isApiTokenFormat,
  LAST_USED_STAMP_WINDOW_MS,
  listApiTokens,
  MAX_API_TOKENS_PER_ACCOUNT,
  mintApiToken,
  revokeApiToken,
  revokeApiTokenBySecret,
  verifyApiToken,
  API_TOKEN_PREFIX,
  generateApiToken,
  hashApiToken,
} from './tokens.ts';
import { tokenBySecret } from './workbench/revoke.ts';
import type { DatabaseSync } from 'node:sqlite';

let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  ({ db, sql } = testD1());
  addUser(sql, { id: 'user_ada', email: 'Ada@Example.com' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com' });
});

describe('API tokens', () => {
  it('shows the secret once and keeps only its hash', async () => {
    const token = await mintApiToken(db, 'user_ada', { name: 'Script', readOnly: false }, 1_000);
    expect(token && isApiTokenFormat(token.secret)).toBe(true);
    const stored = sql.prepare('SELECT * FROM api_token').all();
    expect(JSON.stringify(stored)).not.toContain(token!.secret);
    expect(await listApiTokens(db, 'user_ada', 2_000)).toEqual([
      expect.objectContaining({
        name: 'Script',
        readOnly: false,
        expiresAt: apiTokenExpiry(1_000),
      }),
    ]);
  });

  it('checks a token to its account, with the verified address lower-cased', async () => {
    const token = await mintApiToken(db, 'user_ada', { name: 'MCP', readOnly: true });
    expect(await verifyApiToken(db, token!.secret)).toMatchObject({
      userId: 'user_ada',
      email: 'ada@example.com',
      readOnly: true,
    });
    expect(await verifyApiToken(db, `${token!.secret}x`)).toBeNull();
    expect(await verifyApiToken(db, 'lvd_somethingelse_entirely_here')).toBeNull();
  });

  it('stops a revoked or expired token, and only its owner can revoke it', async () => {
    const now = Date.now();
    const token = await mintApiToken(db, 'user_ada', { name: 'x', readOnly: false }, now);
    expect(await revokeApiToken(db, 'user_bea', token!.id)).toBe(false);
    expect(await verifyApiToken(db, token!.secret, apiTokenExpiry(now) + 1)).toBeNull();
    expect(await revokeApiToken(db, 'user_ada', token!.id)).toBe(true);
    expect(await verifyApiToken(db, token!.secret)).toBeNull();
    expect(await listApiTokens(db, 'user_ada')).toEqual([]);
  });

  it('caps live tokens per account', async () => {
    for (let i = 0; i < MAX_API_TOKENS_PER_ACCOUNT; i++) {
      expect(await mintApiToken(db, 'user_ada', { name: `t${i}`, readOnly: false })).not.toBeNull();
    }
    expect(await mintApiToken(db, 'user_ada', { name: 'one more', readOnly: false })).toBeNull();
    expect(await mintApiToken(db, 'user_bea', { name: 'hers', readOnly: false })).not.toBeNull();
  });

  it('stamps last used at most once a window', async () => {
    const now = Date.now();
    const token = await mintApiToken(db, 'user_ada', { name: 'x', readOnly: false }, now);
    await verifyApiToken(db, token!.secret, now + 1);
    await verifyApiToken(db, token!.secret, now + 2);
    const lastUsed = () =>
      (sql.prepare('SELECT lastUsedAt FROM api_token').get() as { lastUsedAt: number }).lastUsedAt;
    expect(lastUsed()).toBe(now + 1);
    await verifyApiToken(db, token!.secret, now + 2 + LAST_USED_STAMP_WINDOW_MS);
    expect(lastUsed()).toBe(now + 2 + LAST_USED_STAMP_WINDOW_MS);
  });

  it('goes with its account', async () => {
    await mintApiToken(db, 'user_ada', { name: 'x', readOnly: false });
    sql.prepare(`DELETE FROM "user" WHERE id = 'user_ada'`).run();
    expect(sql.prepare('SELECT COUNT(*) AS n FROM api_token').get()).toEqual({ n: 0 });
  });
});

describe('tokens carried over from the old livediagram.app', () => {
  // The migrate tool copies the old row as it was: the lowercase SHA-256 hex of the whole `lvd_` token.
  const legacy = `lvd_${'Q'.repeat(43)}`;
  const importRow = async (expiresAt = Date.now() + 86_400_000) =>
    sql
      .prepare(
        `INSERT INTO api_token (id, userId, tokenHash, name, readOnly, createdAt, expiresAt)
         VALUES ('tok_old', 'user_ada', ?, 'Old script', 1, 1, ?)`,
      )
      .run(await hashApiToken(legacy), expiresAt);

  it('verifies an imported lvd_ row to its account', async () => {
    expect(isApiTokenFormat(legacy)).toBe(true);
    await importRow();
    expect(await verifyApiToken(db, legacy)).toMatchObject({
      userId: 'user_ada',
      readOnly: true,
    });
    expect(await tokenBySecret(db, legacy)).toEqual({ id: 'tok_old', userId: 'user_ada' });
  });

  it('stops an imported token once it expires or is revoked by its secret', async () => {
    await importRow();
    expect(await verifyApiToken(db, legacy, Date.now() + 2 * 86_400_000)).toBeNull();
    expect(await revokeApiTokenBySecret(db, legacy)).toBe(true);
    expect(await verifyApiToken(db, legacy)).toBeNull();
  });

  it('still mints only lwt_', async () => {
    const token = await mintApiToken(db, 'user_bea', { name: 'New', readOnly: false });
    expect(token!.secret.startsWith(API_TOKEN_PREFIX)).toBe(true);
    for (let i = 0; i < 20; i++) expect(generateApiToken().startsWith('lwt_')).toBe(true);
  });
});
