import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { NOTIFY_EMAIL_DEDUPE_MS } from '@liveworkspace/auth-client';
import {
  accountsAllowance,
  claimNotice,
  claimNotices,
  type SenderAllowance,
} from './notify-claims';

// The item's SQLite behind the D1 surface the apps hand in.
function claimsDb() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(
    `CREATE TABLE notify_claims (key TEXT PRIMARY KEY, sender TEXT NOT NULL, at INTEGER NOT NULL)`,
  );
  const prepare = (query: string) => {
    const statement = (bindings: unknown[]) => ({
      bind: (...more: unknown[]) => statement([...bindings, ...more]),
      run: async () => {
        const out = sql.prepare(query).run(...(bindings as never[]));
        return { meta: { changes: Number(out.changes) } };
      },
    });
    return statement([]);
  };
  const db = {
    prepare,
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;
  return { db, sql };
}

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const mention = (key: string, now = NOW) => ({
  key,
  sender: 'user_s',
  now,
  dedupeSince: now - NOTIFY_EMAIL_DEDUPE_MS,
  rate: { max: 2, windowMs: HOUR },
});

// The sender's allowance, as one per-person store keeps it for every item.
function allowance(): SenderAllowance & { calls: number } {
  let uses: number[] = [];
  const take = Object.assign(
    async ({ max, windowMs, now, count }: Parameters<SenderAllowance>[0]) => {
      take.calls++;
      uses = uses.filter((at) => at > now - windowMs);
      const taken = Math.max(0, Math.min(count, max - uses.length));
      for (let i = 0; i < taken; i++) uses.push(now);
      return taken;
    },
    { calls: 0 },
  );
  return take;
}

describe('claimNotice', () => {
  it('sends an email once per key, however its triggers race', async () => {
    const { db } = claimsDb();
    const quota = allowance();
    const [a, b] = await Promise.all([
      claimNotice(db, mention('k1'), quota),
      claimNotice(db, mention('k1'), quota),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await claimNotice(db, mention('k1', NOW + HOUR), quota)).toBe(false);
    expect(await claimNotice(db, mention('k1', NOW + NOTIFY_EMAIL_DEDUPE_MS + 1), quota)).toBe(
      true,
    );
  });

  it('caps the sender across items with one allowance, and releases a refused claim', async () => {
    const quota = allowance();
    const items = [claimsDb(), claimsDb(), claimsDb()];
    const sent = [];
    for (const [i, { db }] of items.entries())
      sent.push(await claimNotice(db, mention(`k${i}`), quota));
    expect(sent).toEqual([true, true, false]);
    // The refused one left no claim: it goes once the hour allows.
    expect(items[2]!.sql.prepare('SELECT COUNT(*) AS n FROM notify_claims').get()).toEqual({
      n: 0,
    });
    expect(await claimNotice(items[2]!.db, mention('k2', NOW + HOUR + 1), quota)).toBe(true);
  });

  it('asks no allowance for a claim with no rate or a duplicate, and sends nothing when it cannot be reached', async () => {
    const { db } = claimsDb();
    const quota = allowance();
    expect(
      await claimNotice(
        db,
        { key: 'join', sender: 'user_o', now: NOW, dedupeSince: NOW - HOUR },
        quota,
      ),
    ).toBe(true);
    expect(await claimNotice(db, mention('k1'), quota)).toBe(true);
    expect(await claimNotice(db, mention('k1'), quota)).toBe(false);
    expect(quota.calls).toBe(1);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down: SenderAllowance = async () => {
      throw new Error('unreachable');
    };
    expect(await claimNotice(db, mention('k9'), down)).toBe(false);
    expect(await claimNotice(db, mention('k9'), quota)).toBe(true);
  });

  it("claims a whole save's emails with one batch and one allowance call, earliest first", async () => {
    const { db, sql } = claimsDb();
    const quota = allowance();
    const out = await claimNotices(
      db,
      ['a', 'b', 'a', 'c'].map((key) => mention(key)),
      quota,
    );
    // The repeated key loses in the item; of the rest, the cap (2) takes the first two.
    expect(out).toEqual([true, true, false, false]);
    expect(quota.calls).toBe(1);
    expect(sql.prepare('SELECT key FROM notify_claims ORDER BY key').all()).toEqual([
      { key: 'a' },
      { key: 'b' },
    ]);
  });

  it('keeps no claim past a day', async () => {
    const { db, sql } = claimsDb();
    for (let i = 0; i < 50; i++) {
      await claimNotice(db, { key: `k${i}`, sender: 's', now: NOW + i, dedupeSince: 0 });
    }
    await claimNotice(db, {
      key: 'late',
      sender: 's',
      now: NOW + NOTIFY_EMAIL_DEDUPE_MS + 100,
      dedupeSince: 0,
    });
    expect(sql.prepare('SELECT COUNT(*) AS n FROM notify_claims').get()).toEqual({ n: 1 });
  });
});

describe('accountsAllowance', () => {
  it("takes from the sender's allowance at liveworkspace with the app's credentials", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return Response.json({ taken: 1 });
    }) as unknown as typeof fetch;
    const take = accountsAllowance(
      { accountsUrl: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev', clientId: 'liveplanner', clientSecret: 's' },
      fetcher,
    );
    const input = {
      personId: 'user_a',
      kind: 'notify-email',
      max: 60,
      windowMs: 1,
      now: 5,
      count: 2,
    };
    expect(await take(input)).toBe(1);
    expect(calls).toEqual([
      {
        url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/account/internal/allowance',
        body: { personId: 'user_a', kind: 'notify-email', max: 60, windowMs: 1, count: 2 },
      },
    ]);
  });

  it('takes nothing without credentials', async () => {
    const input = { personId: 'user_a', kind: 'k', max: 1, windowMs: 1, now: 1, count: 1 };
    expect(await accountsAllowance(null)(input)).toBe(0);
  });
});
