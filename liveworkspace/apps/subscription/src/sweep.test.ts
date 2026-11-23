// The sweep (subscription.md "States"): it marks what the clock already ended, renews the mock provider's
// subscriptions as a real provider would, and drops expired sessions and counts nobody will read again.
import { RENEWAL_TOLERANCE_MS } from '@liveworkspace/subscription';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetMembers } from './seats';
import { endedAt, isLive, type SubscriptionRow } from './subscriptions/state';
import { oldestMonthKept, sweepSubscriptions } from './sweep';
import { testDb, type TestDb } from './test-sqlite-d1';
import { DAY, subscribe } from './test-kit';

const NOW = Date.UTC(2026, 10, 20, 12);

let db: TestDb;
beforeEach(() => {
  forgetMembers();
  db = testDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const states = () =>
  Object.fromEntries(
    (
      db.sql.prepare('SELECT owner, state FROM subscriptions').all() as {
        owner: string;
        state: string;
      }[]
    ).map((row) => [row.owner, row.state]),
  );

describe('lapsed subscriptions', () => {
  it('are marked ended once the clock has ended them, and no others', async () => {
    const stripe = { provider: 'stripe' };
    await subscribe(db.env, 'p:live', NOW);
    // A real provider's renewal is still on its way two days past the period's end; three days past, it never came.
    await subscribe(db.env, 'p:awaited', NOW - 40 * DAY, { ...stripe, period_end: NOW - 2 * DAY });
    await subscribe(db.env, 'p:silent', NOW - 40 * DAY, {
      ...stripe,
      period_end: NOW - RENEWAL_TOLERANCE_MS,
    });
    await subscribe(db.env, 'p:cancelled', NOW - 40 * DAY, {
      state: 'cancelling',
      period_end: NOW,
    });
    await subscribe(db.env, 'p:grace', NOW - 40 * DAY, {
      state: 'past_due',
      period_end: NOW - DAY,
      grace_end: NOW + DAY,
    });
    await subscribe(db.env, 'p:graceless', NOW - 40 * DAY, {
      state: 'past_due',
      period_end: NOW - 8 * DAY,
      grace_end: NOW,
    });
    // Grace ran out, but the month paid for has not: grace never ends Pro early.
    await subscribe(db.env, 'p:paid_ahead', NOW - 20 * DAY, {
      state: 'past_due',
      period_end: NOW + 10 * DAY,
      grace_end: NOW - DAY,
    });
    // Cancelled while past due: it keeps its grace.
    await subscribe(db.env, 'p:cancelled_late', NOW - 40 * DAY, {
      state: 'cancelling',
      period_end: NOW - DAY,
      grace_end: NOW + DAY,
    });
    await subscribe(db.env, 'p:gone', NOW - 90 * DAY, {
      state: 'ended',
      period_end: NOW - 60 * DAY,
    });
    const before = db.sql
      .prepare('SELECT owner, state, period_end, grace_end FROM subscriptions')
      .all();
    const result = await sweepSubscriptions(db.env, NOW);
    expect(result.ended).toBe(3);
    expect(result.renewed).toBe(0);
    expect(states()).toEqual({
      'p:live': 'active',
      'p:awaited': 'active',
      'p:silent': 'ended',
      'p:cancelled': 'ended',
      'p:grace': 'past_due',
      'p:graceless': 'ended',
      'p:paid_ahead': 'past_due',
      'p:cancelled_late': 'cancelling',
      'p:gone': 'ended',
    });
    // The sweep only writes what every read already said: each row it ended was not live, each it left was.
    for (const row of before as unknown as SubscriptionRow[]) {
      expect(states()[row.owner] === 'ended', row.owner).toBe(!isLive(row, NOW));
    }
    expect((await sweepSubscriptions(db.env, NOW)).ended).toBe(0);
  });

  it('write when each ended: the moment the clock ended it, which every read already said', async () => {
    await subscribe(db.env, 'p:silent', NOW - 40 * DAY, {
      provider: 'stripe',
      period_end: NOW - RENEWAL_TOLERANCE_MS - DAY,
    });
    await subscribe(db.env, 'p:cancelled', NOW - 40 * DAY, {
      state: 'cancelling',
      period_end: NOW - 2 * DAY,
    });
    await subscribe(db.env, 'p:graceless', NOW - 40 * DAY, {
      state: 'past_due',
      period_end: NOW - 8 * DAY,
      grace_end: NOW - DAY,
    });
    const before = db.sql.prepare('SELECT * FROM subscriptions').all() as SubscriptionRow[];
    await sweepSubscriptions(db.env, NOW);
    const ended = Object.fromEntries(
      (db.sql.prepare('SELECT owner, ended_at FROM subscriptions').all() as SubscriptionRow[]).map(
        (row) => [row.owner, row.ended_at],
      ),
    );
    expect(ended).toEqual({
      'p:silent': NOW - DAY,
      'p:cancelled': NOW - 2 * DAY,
      'p:graceless': NOW - DAY,
    });
    for (const row of before) expect(endedAt(row, NOW), row.owner).toBe(ended[row.owner]);
  });
});

describe('the mock provider’s renewals', () => {
  const period = (owner: string) =>
    db.sql
      .prepare('SELECT state, period_start, period_end FROM subscriptions WHERE owner = ?')
      .get(owner) as { state: string; period_start: number; period_end: number };

  it('renews an active mock subscription whose period has ended, so Renews is true of it', async () => {
    const taken = Date.UTC(2026, 9, 20, 12);
    await subscribe(db.env, 'p:user_ada', taken, { period_end: NOW });
    await subscribe(db.env, 'p:not_yet', NOW - DAY, { period_end: NOW + 1 });
    // Before the change the sweep ended it at this very moment, and its owner was back on Free.
    const result = await sweepSubscriptions(db.env, NOW);
    expect(result).toMatchObject({ renewed: 1, ended: 0 });
    expect(period('p:user_ada')).toEqual({
      state: 'active',
      period_start: NOW,
      period_end: Date.UTC(2026, 11, 20, 12),
    });
    expect(period('p:not_yet').period_end).toBe(NOW + 1);
    // Once: the new period is a month away.
    expect((await sweepSubscriptions(db.env, NOW)).renewed).toBe(0);
  });

  it('keeps the anchor day through a short month, and catches up after a sweep that did not run', async () => {
    await subscribe(db.env, 'p:user_ada', Date.UTC(2026, 11, 31), {
      period_end: Date.UTC(2027, 0, 31),
      anchor_day: 31,
    });
    await sweepSubscriptions(db.env, Date.UTC(2027, 0, 31, 1));
    expect(period('p:user_ada').period_end).toBe(Date.UTC(2027, 1, 28));
    await sweepSubscriptions(db.env, Date.UTC(2027, 1, 28, 1));
    expect(period('p:user_ada').period_end).toBe(Date.UTC(2027, 2, 31));
    // Three months with no sweep: it lands in the period now falls in, never months behind or ahead.
    await sweepSubscriptions(db.env, Date.UTC(2027, 5, 10));
    expect(period('p:user_ada')).toEqual({
      state: 'active',
      period_start: Date.UTC(2027, 4, 31),
      period_end: Date.UTC(2027, 5, 30),
    });
  });

  it('never renews a cancelled, past due or real provider’s subscription', async () => {
    await subscribe(db.env, 'p:cancelled', NOW - 30 * DAY, {
      state: 'cancelling',
      period_end: NOW,
    });
    await subscribe(db.env, 'p:late', NOW - 30 * DAY, {
      state: 'past_due',
      period_end: NOW,
      grace_end: NOW + DAY,
    });
    await subscribe(db.env, 'p:stripe', NOW - 30 * DAY, { provider: 'stripe', period_end: NOW });
    expect((await sweepSubscriptions(db.env, NOW)).renewed).toBe(0);
    expect(period('p:cancelled').state).toBe('ended');
    expect(period('p:late')).toMatchObject({ state: 'past_due', period_end: NOW });
    expect(period('p:stripe')).toMatchObject({ state: 'active', period_end: NOW });
  });

  it('never runs in production, where the mock does not exist: a mock row there ends like any unrenewed one', async () => {
    const production = { ...db.env, ENVIRONMENT: 'production' };
    await subscribe(db.env, 'p:user_ada', NOW - 30 * DAY, { period_end: NOW });
    expect(await sweepSubscriptions(production, NOW)).toMatchObject({ renewed: 0, ended: 0 });
    expect(await sweepSubscriptions(production, NOW + RENEWAL_TOLERANCE_MS)).toMatchObject({
      renewed: 0,
      ended: 1,
    });
    expect(period('p:user_ada')).toMatchObject({ state: 'ended', period_end: NOW });
  });

  it('leaves a row that changed while it was working', async () => {
    await subscribe(db.env, 'p:user_ada', NOW - 30 * DAY, { period_end: NOW });
    const batch = db.env.SUBSCRIPTION_DB.batch.bind(db.env.SUBSCRIPTION_DB);
    let raced = false;
    vi.spyOn(db.env.SUBSCRIPTION_DB, 'batch').mockImplementation(async (statements) => {
      if (!raced) {
        raced = true;
        // The owner cancels between the sweep's read and its write.
        db.sql
          .prepare("UPDATE subscriptions SET state = 'cancelling' WHERE owner = 'p:user_ada'")
          .run();
      }
      return batch(statements);
    });
    expect((await sweepSubscriptions(db.env, NOW)).renewed).toBe(0);
    expect(period('p:user_ada').period_end).toBe(NOW);
  });
});

describe('what nobody will read again', () => {
  it('goes: expired mock sessions', async () => {
    const insertCheckout = db.sql.prepare(
      "INSERT INTO mock_checkout_sessions VALUES (?, 'p:a', 'A', 'pro', 1, 'GBP', 8, 'http://localhost:3000/', 'a', 0, ?)",
    );
    const insertPortal = db.sql.prepare(
      "INSERT INTO mock_portal_sessions VALUES (?, 'p:a', 'A', 'http://localhost:3000/', 'a', 0, ?)",
    );
    insertCheckout.run('old', NOW);
    insertCheckout.run('new', NOW + 1);
    insertPortal.run('old', NOW - 1);
    insertPortal.run('new', NOW + 1);
    expect((await sweepSubscriptions(db.env, NOW)).sessions).toBe(2);
    expect(db.sql.prepare('SELECT id FROM mock_checkout_sessions').all()).toEqual([{ id: 'new' }]);
    expect(db.sql.prepare('SELECT id FROM mock_portal_sessions').all()).toEqual([{ id: 'new' }]);
  });

  it('goes: spend counters older than thirteen months', async () => {
    expect(oldestMonthKept(NOW)).toBe('2025-11');
    expect(oldestMonthKept(Date.UTC(2026, 0, 31))).toBe('2025-01');
    const insert = db.sql.prepare(
      "INSERT INTO spend_counters VALUES ('p:a', 'aiCredits', ?, 5, 0)",
    );
    for (const month of ['2024-12', '2025-10', '2025-11', '2026-10', '2026-11']) insert.run(month);
    expect((await sweepSubscriptions(db.env, NOW)).counters).toBe(2);
    expect(db.sql.prepare('SELECT month FROM spend_counters ORDER BY month').all()).toEqual([
      { month: '2025-11' },
      { month: '2026-10' },
      { month: '2026-11' },
    ]);
  });

  it('goes: a request for Pro for Teams older than thirty days', async () => {
    const insert = db.sql.prepare(
      "INSERT INTO team_requests (team, account, day, created_at) VALUES ('t:a', ?, '2026-10-01', ?)",
    );
    insert.run('old', NOW - 30 * DAY);
    insert.run('recent', NOW - 30 * DAY + 1);
    expect((await sweepSubscriptions(db.env, NOW)).requests).toBe(1);
    expect(db.sql.prepare('SELECT account FROM team_requests').all()).toEqual([
      { account: 'recent' },
    ]);
  });
});

describe("a subscribed team's seats", () => {
  const joined = (n: number) => ({
    team: { id: 't', name: 'T' },
    members: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, status: 'joined' })),
  });
  const withAccounts = (answer: (teamId: string) => Response) => ({
    ...db.env,
    ACCOUNTS_URL: 'https://accounts.test',
    ACCOUNTS_CLIENT_ID: 'client-1',
    ACCOUNTS_CLIENT_SECRET: 'secret-1',
    ACCOUNTS: {
      fetch: async (_input: string | Request, init?: RequestInit) =>
        answer((JSON.parse(String(init?.body)) as { teamId: string }).teamId),
    },
  });
  const seats = () =>
    Object.fromEntries(
      (
        db.sql
          .prepare("SELECT owner, seats, seats_checked_at FROM subscriptions WHERE tier = 'team'")
          .all() as {
          owner: string;
          seats: number;
          seats_checked_at: number;
        }[]
      ).map((row) => [row.owner, [row.seats, row.seats_checked_at]]),
    );

  it('follow its joined members once a day, never below three', async () => {
    await subscribe(db.env, 't:grew', NOW - 2 * DAY, { seats: 3 });
    await subscribe(db.env, 't:shrank', NOW - 2 * DAY, { seats: 9 });
    await subscribe(db.env, 't:same', NOW - 2 * DAY, { seats: 4 });
    await subscribe(db.env, 't:fresh', NOW - 60 * 1000, { seats: 3 });
    await subscribe(db.env, 't:ended', NOW - 2 * DAY, { seats: 3, state: 'ended' });
    await subscribe(db.env, 'p:person', NOW - 2 * DAY);
    const sizes: Record<string, number> = { grew: 8, shrank: 1, same: 4 };
    const asked: string[] = [];
    const env = withAccounts(
      (teamId) => (asked.push(teamId), Response.json(joined(sizes[teamId] ?? 50))),
    );
    expect((await sweepSubscriptions(env, NOW)).seats).toBe(2);
    expect(asked.sort()).toEqual(['grew', 'same', 'shrank']);
    expect(seats()).toEqual({
      't:grew': [8, NOW],
      't:shrank': [3, NOW],
      't:same': [4, NOW],
      't:fresh': [3, NOW - 60 * 1000],
      't:ended': [3, NOW - 2 * DAY],
    });
    // Checked a moment ago: the next run asks nobody.
    expect((await sweepSubscriptions(env, NOW + 1)).seats).toBe(0);
    expect(asked).toHaveLength(3);
  });

  it('are kept when accounts cannot answer, and asked again after the others', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await subscribe(db.env, 't:down', NOW - 2 * DAY, { seats: 6 });
    await subscribe(db.env, 't:deleted', NOW - 2 * DAY, { seats: 5 });
    const env = withAccounts((teamId) =>
      teamId === 'deleted'
        ? new Response(null, { status: 404 })
        : new Response(null, { status: 500 }),
    );
    expect((await sweepSubscriptions(env, NOW)).seats).toBe(0);
    expect(seats()).toEqual({ 't:down': [6, NOW], 't:deleted': [5, NOW] });
  });

  it('are checked a few teams a run, the ones checked longest ago first', async () => {
    for (let i = 0; i < 25; i++) {
      await subscribe(db.env, `t:team_${i}`, NOW - (30 - i) * DAY, {
        seats: 3,
        period_end: NOW + DAY,
      });
    }
    const asked: string[] = [];
    const env = withAccounts((teamId) => (asked.push(teamId), Response.json(joined(4))));
    expect((await sweepSubscriptions(env, NOW)).seats).toBe(20);
    expect(asked).toHaveLength(20);
    expect(asked).not.toContain('team_24');
    expect(asked).toContain('team_0');
    expect((await sweepSubscriptions(env, NOW)).seats).toBe(5);
  });

  it('are left alone without a client at accounts', async () => {
    await subscribe(db.env, 't:team_1', NOW - 2 * DAY, { seats: 6 });
    expect((await sweepSubscriptions(db.env, NOW)).seats).toBe(0);
    expect(seats()).toEqual({ 't:team_1': [6, NOW - 2 * DAY] });
  });

  it('runs at the present moment when given none', async () => {
    await subscribe(db.env, 'p:lapsed', 0, { state: 'cancelling', period_end: 1 });
    expect((await sweepSubscriptions(db.env)).ended).toBe(1);
  });
});
