import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OUTBOX_MAX_ATTEMPTS,
  outboxDueAt,
  PARKED_RETRY_MS,
  recordItemEditor,
  RETRY_MAX_MS,
} from '@liveworkspace/index-app';
import { nodeItemSql, nodeSql } from '@liveworkspace/index-app/testing';
import { IndexError, type IndexAppClient, type ItemSummary } from '@liveworkspace/index-client';
import { upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { drainOutbox, PLAN_OUTBOX } from './plan-outbox';
import { migratePlanSchema } from './plan-schema';

// The outbox's parked keys in a plan's room (@liveworkspace/index-app outbox-parked.ts;
// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "When a push fails"): let back in after a healthy
// drain, and never swallowing a Community change. Real SQLite (test-sqlite-d1.ts); the index is a recording fake.

const T0 = 1_700_000_000_000;

function plan(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, saved_at, created_at)
               VALUES ('P', 'owner', 'P', ${T0}, ${T0})`);
  return db;
}

const stored = (db: SqliteD1) =>
  db.sql
    .prepare("SELECT kind || ':' || key AS k, attempts FROM outbox WHERE plan_id = 'P' ORDER BY id")
    .all()
    .map((r) => ({ k: String(r.k), attempts: Number(r.attempts) }));

function fakeIndex(fail: (kind: string) => Error | null) {
  const collab: string[] = [];
  const summaries: ItemSummary[] = [];
  const client = {
    pushEvents: async () => {
      const err = fail('events');
      if (err) throw err;
    },
    pushCollab: async (_id: string, tab: string) => {
      const err = fail('collab');
      if (err) throw err;
      collab.push(tab);
    },
    pushSummary: async (_id: string, summary: ItemSummary) => {
      const err = fail('summary');
      if (err) throw err;
      summaries.push(summary);
    },
  } as unknown as IndexAppClient;
  return { client, collab, summaries };
}

describe("a plan's parked outbox keys", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('queues a fresh summary key for a Community change after a parked summary row', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    // The index refuses the summary for good: its key is parked.
    let refuse = true;
    const index = fakeIndex((kind) =>
      kind === 'summary' && refuse ? new IndexError(422, 'bad_summary') : null,
    );
    await drainOutbox(db.env, 'P', index.client);
    expect(stored(db)).toEqual([{ k: 'summary:', attempts: OUTBOX_MAX_ATTEMPTS }]);
    // Listing it in the Community replaces the parked key with a fresh one, never left swallowed.
    db.sql.exec(`INSERT INTO community_post (share_code, author_id, post_id, title)
                 VALUES ('CODE2345', 'owner', 'post1', 'P')`);
    expect(stored(db)).toEqual([{ k: 'summary:', attempts: 0 }]);
    refuse = false;
    await drainOutbox(db.env, 'P', index.client);
    expect(index.summaries.at(-1)).toMatchObject({ public: true });
    // Hidden, and taken down: each a fresh key over a parked one.
    for (const change of [
      'UPDATE community_post SET hidden_at = 7',
      'DELETE FROM community_post',
    ]) {
      db.sql.exec(`INSERT INTO outbox (plan_id, kind, key, attempts)
                   VALUES ('P', 'summary', '', ${OUTBOX_MAX_ATTEMPTS})`);
      db.sql.exec(change);
      expect(stored(db)).toEqual([{ k: 'summary:', attempts: 0 }]);
      await drainOutbox(db.env, 'P', index.client);
      expect(index.summaries.at(-1)).not.toHaveProperty('public');
    }
  });

  it("delivers a tab's and the cards' Inbox rows parked during an outage once the index is healthy, without a write to them", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'A', elements: [] }, 0);
    // A card moved (what the items triggers key, plan-schema.ts outbox_cards_update): the push Automations'
    // webhooks and the Inbox read.
    db.sql.exec("INSERT INTO outbox (plan_id, kind, key) VALUES ('P', 'tab', '~cards')");
    let down = true;
    const index = fakeIndex(() => (down ? new IndexError(503, 'unavailable') : null));
    for (let i = 0; i < OUTBOX_MAX_ATTEMPTS; i++) {
      await drainOutbox(db.env, 'P', index.client);
      vi.setSystemTime(Date.now() + RETRY_MAX_MS);
    }
    expect(stored(db).every((r) => r.attempts === OUTBOX_MAX_ATTEMPTS)).toBe(true);
    expect(stored(db).map((r) => r.k)).toEqual(expect.arrayContaining(['tab:t1', 'tab:~cards']));
    expect(outboxDueAt(nodeSql(db.sql))).toBeNull();
    // Parking stamped each row, so the 30 days' retention counts from now.
    const parkedAt = db.sql
      .prepare("SELECT MIN(parked_at) AS at FROM outbox WHERE plan_id = 'P'")
      .get()!.at;
    expect(Number(parkedAt)).toBeGreaterThan(0);

    // The index is back, a day on. Someone's write elsewhere drains in full, which lets the parked keys back in.
    down = false;
    vi.setSystemTime(Date.now() + PARKED_RETRY_MS);
    recordItemEditor(
      (q, ...b) => db.sql.prepare(q).run(...b),
      PLAN_OUTBOX,
      'P',
      'user_b',
      Date.now(),
    );
    await drainOutbox(db.env, 'P', index.client);
    expect(stored(db).every((r) => r.attempts === OUTBOX_MAX_ATTEMPTS - 1)).toBe(true);
    await drainOutbox(db.env, 'P', index.client);
    expect(index.collab).toEqual(expect.arrayContaining(['t1', '~cards']));
    expect(stored(db)).toEqual([]);
  });
});

describe('the parking schema step (V27)', () => {
  it('brings a plan whose version ran ahead of its retry columns up to date, behind delete-then-insert Community triggers', () => {
    const raw = new DatabaseSync(':memory:');
    const sql = nodeItemSql(raw);
    const exec = (q: string) => sql.exec(q);
    migratePlanSchema(exec);
    // An old local plan: at version 26, but its outbox without the retry columns ("no such column: retry_at").
    raw.exec('DROP INDEX outbox_due');
    for (const column of ['parked_at', 'retry_at', 'attempts'])
      raw.exec(`ALTER TABLE outbox DROP COLUMN ${column}`);
    raw.exec('UPDATE _plan_schema SET version = 26');
    expect(() => outboxDueAt(nodeSql(raw))).toThrow();
    migratePlanSchema(exec);
    expect(outboxDueAt(nodeSql(raw))).toBeNull();
    // The Community triggers key the summary by delete-then-insert (V16).
    const triggers = raw
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'outbox_community_%'",
      )
      .all()
      .map((r) => String(r.sql));
    expect(triggers).toHaveLength(3);
    for (const body of triggers) {
      expect(body).not.toMatch(/OR IGNORE/);
      expect(body).toMatch(/DELETE FROM outbox/);
    }
  });

  it('reads the next-due key through the (attempts, retry_at) index, so parked rows cost it nothing', () => {
    const db = plan();
    const detail = db.sql
      .prepare('EXPLAIN QUERY PLAN SELECT MIN(retry_at) FROM outbox WHERE attempts < ?')
      .all(OUTBOX_MAX_ATTEMPTS)
      .map((r) => String(r.detail));
    expect(detail.join(' ')).toContain('outbox_due');
  });
});
