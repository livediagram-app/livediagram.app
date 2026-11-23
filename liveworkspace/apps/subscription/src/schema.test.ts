// The database as the migrations leave it (blueprints/README.md "Tables"): every table the Worker reads, and an
// index under every statement on a hot path or in the sweep, so none of them walks a whole table.
import { describe, expect, it } from 'vitest';
import { ENDS_RUN_OUT, ENDS_UNRENEWED } from './sweep';
import { ownRequests, requestsOfTeams } from './team-requests';
import { testDb } from './test-sqlite-d1';

const { sql } = testDb();

const plan = (query: string, ...args: (string | number)[]) =>
  (sql.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...args) as { detail: string }[]).map(
    (row) => row.detail,
  );

/** A plan step that reads a table from end to end: a SCAN with no index under it. */
const fullScans = (steps: string[]) =>
  steps.filter(
    (step) =>
      step.startsWith('SCAN ') &&
      // A subquery's own rows, already narrowed by the search inside it.
      !/^SCAN \(subquery-\d+\)/.test(step) &&
      !/USING (COVERING )?INDEX/.test(step) &&
      !/CONSTANT ROW/.test(step),
  );

describe('the schema', () => {
  it('has every table the Worker reads', () => {
    const tables = (
      sql.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    expect(tables).toEqual([
      'gauge_entries',
      'item_usage',
      'mock_checkout_sessions',
      'mock_portal_sessions',
      'spend_counters',
      'stripe_customers',
      'subscriptions',
      'team_requests',
    ]);
  });

  it('refuses a tier, a state or a seat count that is not one', () => {
    const insert = (tier: string, state: string, seats: number) =>
      sql
        .prepare(
          `INSERT INTO subscriptions (owner, tier, state, seats, currency, unit_amount, period_start, period_end,
             provider, subscribed_by, created_at, updated_at) VALUES ('p:a', ?, ?, ?, 'GBP', 8, 0, 1, 'mock', 'a', 0, 0)`,
        )
        .run(tier, state, seats);
    expect(() => insert('free', 'active', 1)).toThrow();
    expect(() => insert('pro', 'paused', 1)).toThrow();
    expect(() => insert('pro', 'active', 0)).toThrow();
    expect(() => insert('pro', 'active', 1)).not.toThrow();
  });

  it('keeps the day a subscription renews on, a day of a month', () => {
    const anchor = (day: number) =>
      sql.prepare("UPDATE subscriptions SET anchor_day = ? WHERE owner = 'p:a'").run(day);
    expect(() => anchor(0)).toThrow();
    expect(() => anchor(32)).toThrow();
    expect(() => anchor(31)).not.toThrow();
  });

  const INDEXED: [string, string, (string | number)[]][] = [
    ['an entitlement', 'SELECT * FROM subscriptions WHERE owner = ?', ['p:a']],
    ['the sweep of renewals that never came', ENDS_UNRENEWED, [1, 1, 1]],
    ['the sweep of cancelled and past due ones run out', ENDS_RUN_OUT, [1, 1, 1]],
    ['old requests for Pro for Teams', 'DELETE FROM team_requests WHERE created_at <= ?', [1]],
    ["several teams' requests", requestsOfTeams('?, ?'), ['t:a', 't:b', 1, 5]],
    ["a member's own requests today", ownRequests('?, ?'), ['t:a', 't:b', 'acc', '2026-11-21']],
    [
      "a member's request today",
      'SELECT created_at FROM team_requests WHERE team = ? AND account = ? AND day = ?',
      ['t:a', 'acc', '2026-11-21'],
    ],
    [
      "the mock provider's renewals",
      `SELECT owner, state, period_start, period_end, anchor_day FROM subscriptions
       WHERE state = 'active' AND period_end <= ? AND provider = ? ORDER BY period_end LIMIT ?`,
      [1, 'mock', 200],
    ],
    [
      'the seat check',
      `SELECT owner, seats FROM subscriptions WHERE tier = 'team' AND state != 'ended' AND seats_checked_at <= ?
       ORDER BY seats_checked_at LIMIT ?`,
      [1, 20],
    ],
    ['expired checkouts', 'DELETE FROM mock_checkout_sessions WHERE expires_at <= ?', [1]],
    ['expired portal sessions', 'DELETE FROM mock_portal_sessions WHERE expires_at <= ?', [1]],
    ['old spend counters', 'DELETE FROM spend_counters WHERE month < ?', ['2025-11']],
    [
      "an owner's spend this month",
      'SELECT owner, meter, used FROM spend_counters WHERE owner IN (?, ?) AND month = ?',
      ['p:a', 't:b', '2026-11'],
    ],
    [
      "an owner's gauge entries",
      'SELECT owner, gauge, COUNT(*) FROM gauge_entries WHERE owner IN (?, ?) GROUP BY owner, gauge',
      ['p:a', 't:b'],
    ],
    [
      "an owner's standing counts",
      'SELECT owner, meter, SUM(used) AS used FROM item_usage WHERE owner IN (?, ?) GROUP BY owner, meter',
      ['p:a', 't:b'],
    ],
  ];

  for (const [what, query, args] of INDEXED) {
    it(`reads ${what} through an index`, () => {
      const steps = plan(query, ...args);
      expect(steps.join('\n')).toMatch(/USING (COVERING )?(INDEX|PRIMARY KEY)|SEARCH/);
      expect(fullScans(steps), steps.join('\n')).toEqual([]);
    });
  }
});
