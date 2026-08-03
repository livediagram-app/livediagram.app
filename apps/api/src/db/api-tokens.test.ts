import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { MAX_API_TOKENS_PER_OWNER, mintApiToken } from './api-tokens';

// Minting is the one place spec/61's rules are enforced, now that both ways in
// share it: `POST /api/tokens` for a person in the Explorer, and the OAuth
// exchange for an MCP client (spec/62). Each used to carry its own copy of the
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

describe('mintApiToken (spec/61)', () => {
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
    // The whole security posture of spec/61: the plaintext leaves once, in the
    // return value, and the row keeps only a digest of it.
    const { env, writes } = envWithTokenCount(0);
    const minted = await mintApiToken(env, { ownerId: 'u1', name: 'CI' });
    const bound = insert(writes)!.bindings.map(String);
    expect(bound).not.toContain(minted!.secret);
    expect(bound.some((b) => /^[0-9a-f]{64}$/.test(b))).toBe(true);
  });

  it('always sets an expiry, and one in the future', async () => {
    // spec/61: `expires_at` is never null. A token that never expires is the
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
