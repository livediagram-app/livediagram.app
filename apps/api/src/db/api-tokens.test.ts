import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { fakeD1 } from '../test-d1';
import {
  apiTokensExpiringSoon,
  countLiveApiTokens,
  listApiTokensByOwner,
  markApiTokenExpiryWarned,
  MAX_API_TOKENS_PER_OWNER,
  mintApiToken,
  resolveApiToken,
  revokeApiToken,
} from './api-tokens';

// Minting is the one place docs/specs/015-api/public-api-and-tokens.md's rules are enforced, now that both ways in
// share it: `POST /api/tokens` for a person in the Explorer, and the OAuth
// exchange for an MCP client (docs/specs/015-api/mcp-server.md). Each used to carry its own copy of the
// cap, the expiry and the hashing, so this is where those are tested rather
// than twice over in the route suites.
//
// A D1 stub, not a real database: the SELECT returns whatever count the test
// wants and the INSERT records its bindings, which is enough to see what would
// have been written. What matters here is which values reach the row.

type Recorded = { sql: string; bindings: unknown[] };

function envWithTokenCount(count: number): { env: Env; writes: Recorded[] } {
  const writes: Recorded[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...bindings: unknown[]) => ({
          first: async () => ({ n: count }),
          run: async () => {
            writes.push({ sql, bindings });
          },
        }),
      }),
    },
  } as unknown as Env;
  return { env, writes };
}

const insert = (writes: Recorded[]) => writes.find((w) => w.sql.includes('INSERT INTO api_tokens'));

describe('mintApiToken (docs/specs/015-api/public-api-and-tokens.md)', () => {
  it('refuses once the owner is at the cap, and writes nothing', async () => {
    const { env, writes } = envWithTokenCount(MAX_API_TOKENS_PER_OWNER);
    expect(await mintApiToken(env, { ownerId: 'u1', name: 'CI' })).toBeNull();
    // Null is not enough on its own: a mint that refused but still inserted
    // would hand the caller a 409 for a token that exists.
    expect(insert(writes)).toBeUndefined();
  });

  it('mints below the cap', async () => {
    const { env, writes } = envWithTokenCount(MAX_API_TOKENS_PER_OWNER - 1);
    const minted = await mintApiToken(env, { ownerId: 'u1', name: 'CI' });
    expect(minted).not.toBeNull();
    expect(insert(writes)).toBeDefined();
  });

  it('stores the HASH and never the secret it returns', async () => {
    // The whole security posture of docs/specs/015-api/public-api-and-tokens.md: the plaintext leaves once, in the
    // return value, and the row keeps only a digest of it.
    const { env, writes } = envWithTokenCount(0);
    const minted = await mintApiToken(env, { ownerId: 'u1', name: 'CI' });
    const bound = insert(writes)!.bindings.map(String);
    expect(bound).not.toContain(minted!.secret);
    expect(bound.some((b) => /^[0-9a-f]{64}$/.test(b))).toBe(true);
  });

  it('always sets an expiry, and one in the future', async () => {
    // docs/specs/015-api/public-api-and-tokens.md: `expires_at` is never null. A token that never expires is the
    // one thing the design refuses.
    const { env } = envWithTokenCount(0);
    const minted = await mintApiToken(env, { ownerId: 'u1', name: null });
    expect(minted!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('defaults to a read-write token and honours read-only when asked', async () => {
    for (const [readOnly, expected] of [
      [undefined, 0],
      [false, 0],
      [true, 1],
    ] as const) {
      const { env, writes } = envWithTokenCount(0);
      await mintApiToken(env, { ownerId: 'u1', name: null, readOnly });
      // Last binding is read_only in the INSERT's column order.
      expect(insert(writes)!.bindings.at(-1), `readOnly=${String(readOnly)}`).toBe(expected);
    }
  });

  it('gives each token its own id and secret', async () => {
    const { env } = envWithTokenCount(0);
    const a = await mintApiToken(env, { ownerId: 'u1', name: null });
    const b = await mintApiToken(env, { ownerId: 'u1', name: null });
    expect(a!.id).not.toBe(b!.id);
    expect(a!.secret).not.toBe(b!.secret);
  });
});

// The rest of the table's life: listing, the cap's counter, the auth hot path
// that turns a presented secret into an owner, revocation, and the expiry
// warning sweep. `resolveApiToken` is the one that matters most — it is the
// whole of "who is this caller" for every programmatic request (docs/specs/015-api/public-api-and-tokens.md).

describe('listApiTokensByOwner (docs/specs/015-api/public-api-and-tokens.md)', () => {
  it('maps live rows to DTOs, newest first, scoped to the owner', async () => {
    const db = fakeD1(() => ({
      all: [
        {
          id: 't1',
          owner_id: 'u1',
          token_hash: 'deadbeef',
          name: 'CI',
          created_at: 5,
          last_used_at: 9,
          expires_at: 99,
          revoked: 0,
          read_only: 1,
        },
      ],
    }));
    expect(await listApiTokensByOwner(db.env, 'u1')).toEqual([
      { id: 't1', name: 'CI', createdAt: 5, lastUsedAt: 9, expiresAt: 99, readOnly: true },
    ]);
    const query = db.one('FROM api_tokens');
    expect(query.bindings).toEqual(['u1']);
    expect(query.sql).toContain('revoked = 0');
    expect(query.sql).toContain('ORDER BY created_at DESC');
  });

  it('never selects the hash it stores', async () => {
    // The listing is the one place a token row reaches a browser; the digest
    // must not travel with it even by accident of SELECT *.
    const db = fakeD1(() => ({ all: [] }));
    await listApiTokensByOwner(db.env, 'u1');
    expect(db.one('FROM api_tokens').sql).not.toContain('*');
  });

  it('survives a query that answers without results', async () => {
    const db = fakeD1(() => ({ all: undefined }));
    expect(await listApiTokensByOwner(db.env, 'u1')).toEqual([]);
  });
});

describe('countLiveApiTokens (the cap, docs/specs/015-api/public-api-and-tokens.md)', () => {
  it('counts only unrevoked, unexpired tokens', async () => {
    const db = fakeD1(() => ({ first: { n: 3 } }));
    expect(await countLiveApiTokens(db.env, 'u1')).toBe(3);
    const query = db.one('COUNT(*)');
    expect(query.sql).toContain('revoked = 0');
    expect(query.sql).toContain('expires_at > ?');
    expect(query.bindings[0]).toBe('u1');
  });

  it('reads an empty answer as zero rather than blocking minting', async () => {
    const db = fakeD1(() => ({ first: null }));
    expect(await countLiveApiTokens(db.env, 'u1')).toBe(0);
  });
});

describe('resolveApiToken (the auth hot path, docs/specs/015-api/public-api-and-tokens.md)', () => {
  it('resolves a live token to its owner and stamps last_used_at', async () => {
    const db = fakeD1(({ sql }) =>
      sql.includes('SELECT') ? { first: { id: 't1', owner_id: 'u1', read_only: 0 } } : {},
    );
    expect(await resolveApiToken(db.env, 'ld_secret')).toEqual({
      ownerId: 'u1',
      tokenId: 't1',
      readOnly: false,
    });
    expect(db.one('UPDATE api_tokens SET last_used_at').bindings[1]).toBe('t1');
  });

  it('looks up the hash, never the presented secret', async () => {
    // The plaintext exists only in the request; a query that bound it would
    // put it in logs and turn a leaked query log into account access.
    const db = fakeD1(() => ({ first: null }));
    await resolveApiToken(db.env, 'ld_secret');
    const query = db.one('SELECT id, owner_id, read_only');
    expect(query.bindings[0]).not.toBe('ld_secret');
    expect(query.bindings[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('collapses revoked, expired and unknown into "not authenticated"', async () => {
    const db = fakeD1(() => ({ first: null }));
    expect(await resolveApiToken(db.env, 'ld_secret')).toBeNull();
    // No row, no stamp: a miss must not write.
    expect(db.matching('UPDATE api_tokens')).toEqual([]);
  });

  it('enforces revoked and expiry in the lookup itself', async () => {
    const db = fakeD1(() => ({ first: null }));
    await resolveApiToken(db.env, 'ld_secret');
    const query = db.one('SELECT id, owner_id, read_only');
    expect(query.sql).toContain('revoked = 0');
    expect(query.sql).toContain('expires_at > ?');
  });

  it('carries the read-only flag through, so writes can be refused', async () => {
    const db = fakeD1(({ sql }) =>
      sql.includes('SELECT') ? { first: { id: 't1', owner_id: 'u1', read_only: 1 } } : {},
    );
    expect((await resolveApiToken(db.env, 'ld_secret'))?.readOnly).toBe(true);
  });
});

describe('revokeApiToken (docs/specs/015-api/public-api-and-tokens.md)', () => {
  it('reports success when a live row was flipped', async () => {
    const db = fakeD1(() => ({ changes: 1 }));
    expect(await revokeApiToken(db.env, 'u1', 't1')).toBe(true);
  });

  it('scopes the update to the caller’s own token', async () => {
    // The ownership check IS the WHERE clause — there is no prior SELECT to
    // fall back on, so losing it would let anyone revoke anyone's token.
    const db = fakeD1(() => ({ changes: 1 }));
    await revokeApiToken(db.env, 'u1', 't1');
    const update = db.one('UPDATE api_tokens SET revoked = 1');
    expect(update.sql).toContain('owner_id = ?');
    expect(update.bindings).toEqual(['t1', 'u1']);
  });

  it('reports failure when nothing matched, including a second revoke', async () => {
    const db = fakeD1(() => ({ changes: 0 }));
    expect(await revokeApiToken(db.env, 'u1', 't1')).toBe(false);
  });

  it('fails closed when the driver reports no change count at all', async () => {
    // "Probably worked" is the wrong reading of an ambiguous write here: the
    // caller turns true into a 200 that tells someone their token is dead.
    const db = fakeD1();
    expect(await revokeApiToken(db.env, 'u1', 't1')).toBe(false);
  });
});

describe('apiTokensExpiringSoon (docs/specs/014-identity/transactional-email.md heads-up)', () => {
  it('maps rows and bounds the window, the batch and the order', async () => {
    const db = fakeD1(() => ({
      all: [{ id: 't1', owner_id: 'u1', name: 'CI', expires_at: 500 }],
    }));
    expect(await apiTokensExpiringSoon(db.env, 100, 400, 25)).toEqual([
      { id: 't1', ownerId: 'u1', name: 'CI', expiresAt: 500 },
    ]);
    const query = db.one('FROM api_tokens');
    expect(query.bindings).toEqual([100, 500, 25]);
    expect(query.sql).toContain('ORDER BY expires_at ASC');
  });

  it('skips tokens already warned, so the cron mails once', async () => {
    const db = fakeD1(() => ({ all: [] }));
    await apiTokensExpiringSoon(db.env, 100, 400, 25);
    expect(db.one('FROM api_tokens').sql).toContain('expiry_warned_at IS NULL');
  });

  it('survives a query that answers without results', async () => {
    const db = fakeD1(() => ({ all: undefined }));
    expect(await apiTokensExpiringSoon(db.env, 100, 400, 25)).toEqual([]);
  });
});

describe('markApiTokenExpiryWarned (docs/specs/014-identity/transactional-email.md)', () => {
  it('stamps the row so the next sweep passes it over', async () => {
    const db = fakeD1();
    await markApiTokenExpiryWarned(db.env, 't1');
    expect(db.one('expiry_warned_at = ?').bindings[1]).toBe('t1');
  });
});
