import { describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from './test-sqlite-d1';
import { liveDoc } from './db/test-trash-fixtures';
import { makeTestRouteContext } from './routes/test-route-context';
import type { Runtime } from './types';
import {
  GUEST_VOTERS_PER_NETWORK,
  admitGuestVoter,
  networkTagFor,
  refuseGuestVoteOverCap,
} from './vote-integrity';

// docs/specs/012-collaboration/vote-integrity.md: a guest id costs nothing to make, so guest voters are capped per
// network per document; an account votes freely.
describe('admitGuestVoter', () => {
  function seeded() {
    const db = sqliteD1();
    liveDoc(db.sql, 'd1');
    liveDoc(db.sql, 'd2');
    return db;
  }

  it('admits up to the cap from one network, then refuses a new guest but not one already in', async () => {
    const { env } = seeded();
    for (let i = 0; i < GUEST_VOTERS_PER_NETWORK; i++) {
      expect(await admitGuestVoter(env, 'd1', 'net-a', `p${i}`)).toBe(true);
    }
    expect(await admitGuestVoter(env, 'd1', 'net-a', 'one-too-many')).toBe(false);
    expect(await admitGuestVoter(env, 'd1', 'net-a', 'p0')).toBe(true);
  });

  it('counts each network and each document on its own', async () => {
    const { env } = seeded();
    for (let i = 0; i < GUEST_VOTERS_PER_NETWORK; i++)
      await admitGuestVoter(env, 'd1', 'net-a', `p${i}`);
    expect(await admitGuestVoter(env, 'd1', 'net-b', 'other-network')).toBe(true);
    expect(await admitGuestVoter(env, 'd2', 'net-a', 'other-document')).toBe(true);
  });

  it('is removed with the document', async () => {
    const { env, sql } = seeded();
    await admitGuestVoter(env, 'd1', 'net-a', 'p0');
    sql.prepare('PRAGMA foreign_keys = ON').run();
    sql.prepare("DELETE FROM documents WHERE id = 'd1'").run();
    expect(sql.prepare('SELECT COUNT(*) AS n FROM guest_voters').get()).toEqual({ n: 0 });
  });

  // The cap's whole cost is one batch over a primary-key range; a full network stays cheap.
  it('decides a vote on a full network within a small budget', async () => {
    const { env } = seeded();
    for (let i = 0; i < GUEST_VOTERS_PER_NETWORK; i++)
      await admitGuestVoter(env, 'd1', 'net-a', `p${i}`);
    const start = performance.now();
    for (let i = 0; i < 50; i++) await admitGuestVoter(env, 'd1', 'net-a', `late${i}`);
    expect((performance.now() - start) / 50).toBeLessThan(20);
  });
});

describe('networkTagFor', () => {
  it('is per scope, stable, and does not contain the network key', async () => {
    const a = await networkTagFor('d1', '203.0.113.7');
    expect(a).toHaveLength(32);
    expect(await networkTagFor('d1', '203.0.113.7')).toBe(a);
    expect(await networkTagFor('d2', '203.0.113.7')).not.toBe(a);
    expect(a).not.toContain('203');
  });
});

describe('refuseGuestVoteOverCap', () => {
  it('lets a verified account vote without touching the ledger', async () => {
    const batch = vi.fn();
    const ctx = makeTestRouteContext('POST', '/api/documents/d1/items/i1/vote', {
      env: { db: { batch } } as unknown as Runtime,
    });
    ctx.verifiedUserId = 'user_1';
    expect(await refuseGuestVoteOverCap(ctx, 'd1', 'user_1')).toBeNull();
    expect(batch).not.toHaveBeenCalled();
  });

  it('answers 429 vote_limit for a guest past the cap', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'd1');
    const ip = '198.51.100.9';
    const ctxFor = (owner: string) =>
      makeTestRouteContext('POST', '/api/documents/d1/items/i1/vote', {
        owner,
        env: db.env,
        headers: { 'CF-Connecting-IP': ip },
      });
    for (let i = 0; i < GUEST_VOTERS_PER_NETWORK; i++) {
      expect(await refuseGuestVoteOverCap(ctxFor(`g${i}`), 'd1', `g${i}`)).toBeNull();
    }
    const res = await refuseGuestVoteOverCap(ctxFor('g-late'), 'd1', 'g-late');
    expect(res?.status).toBe(429);
    expect(await res?.json()).toEqual({ error: 'vote_limit' });
  });
});
