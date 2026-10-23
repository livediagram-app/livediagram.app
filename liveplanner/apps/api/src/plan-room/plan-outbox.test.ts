import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import { deleteTabRow, upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { DRAIN_TABS, drainOutbox, readContentSummary } from './plan-outbox';
import {
  IndexError,
  type CollabPush,
  type IndexAppClient,
  type ItemSummary,
} from '@liveworkspace/index-client';

// What a plan pushes to the index (plan-outbox.ts): the triggers key each change in the write's own transaction,
// and a drain pushes the keys with this app's key. Real SQLite (test-sqlite-d1.ts); the index is a recording fake.

const T0 = 1_700_000_000_000;

const box = (id: string, extra: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label: id,
  ...extra,
});

const actionOn = (id: string): Element =>
  box(id, {
    action: {
      id: `act-${id}`,
      name: 'Do it',
      description: '',
      assignee: { userId: 'owner', name: 'Owner' },
      teamId: null,
      assignerId: 'owner',
      assignerName: 'Owner',
      status: 'open',
      createdAt: T0,
      updatedAt: T0,
    },
  });

function plan(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, saved_at, created_at)
               VALUES ('P', 'owner', 'P', ${T0}, ${T0})`);
  return db;
}

const rows = (db: SqliteD1, query: string) => db.sql.prepare(query).all();
const keys = (db: SqliteD1) =>
  rows(db, "SELECT kind || ':' || key AS k FROM outbox WHERE plan_id = 'P' ORDER BY id").map((r) =>
    String(r.k),
  );

// The index as the drain sees it: every push recorded, a failure on demand.
function fakeIndex(fail: (kind: string) => Error | null = () => null) {
  const collab: { tab: string; push: CollabPush }[] = [];
  const summaries: { summary: ItemSummary; savedAt: number | undefined }[] = [];
  const client = {
    pushCollab: async (_id: string, tab: string, push: CollabPush) => {
      const err = fail('collab');
      if (err) throw err;
      collab.push({ tab, push });
    },
    pushSummary: async (_id: string, summary: ItemSummary, savedAt?: number) => {
      const err = fail('summary');
      if (err) throw err;
      summaries.push({ summary, savedAt });
    },
  } as unknown as IndexAppClient;
  return { client, collab, summaries };
}

describe('the outbox', () => {
  it('keys a tab write in the same transaction, and a drain pushes its Inbox rows and summary and empties it', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    expect(keys(db)).toEqual(['tab:t1', 'summary:']);
    const index = fakeIndex();

    const pushed = await drainOutbox(db.env, 'P', index.client);

    expect(pushed).toMatchObject({ more: false, pushes: 2 });
    expect(keys(db)).toEqual([]);
    expect(index.collab).toHaveLength(1);
    expect(index.collab[0]!.tab).toBe('t1');
    expect(index.collab[0]!.push.actions.map((a) => a.actionId)).toEqual(['act-a']);
    expect(index.summaries[0]!.summary).toMatchObject({ elements: 1, empty: false });
  });

  it("stamps the owner's newest save for the lifecycle email with the summary", async () => {
    const db = plan();
    db.sql.exec(
      `INSERT INTO email_lifecycle (owner_id, email, created_at) VALUES ('owner', 'o@x.test', 1)`,
    );
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    const row = rows(db, "SELECT active_at FROM email_lifecycle WHERE owner_id = 'owner'")[0]!;
    expect(Number(row.active_at)).toBeGreaterThan(0);
  });

  it('pushes an empty collab for a tab that is gone', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    await deleteTabRow(db.env, 'P', 't1');
    const index = fakeIndex();
    await drainOutbox(db.env, 'P', index.client);
    expect(index.collab).toEqual([{ tab: 't1', push: { threads: [], actions: [] } }]);
  });

  it('keeps the keys of a failed push for the next drain, and drops those the index does not hold', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await expect(
      drainOutbox(
        db.env,
        'P',
        fakeIndex((k) => (k === 'summary' ? new Error('down') : null)).client,
      ),
    ).rejects.toThrow('down');
    expect(keys(db)).toEqual(['summary:']);
    const gone = fakeIndex(() => new IndexError(404, 'not_found'));
    await drainOutbox(db.env, 'P', gone.client);
    expect(keys(db)).toEqual([]);
  });

  it(`takes at most ${DRAIN_TABS} tabs a drain, saying there is more`, async () => {
    const db = plan();
    for (let i = 0; i < DRAIN_TABS + 5; i++) {
      await upsertTab(db.env, 'P', { id: `t${i}`, name: `T${i}`, elements: [] }, i);
    }
    expect(keys(db).filter((k) => k.startsWith('tab:')).length).toBe(DRAIN_TABS + 5);
    const index = fakeIndex();
    const first = await drainOutbox(db.env, 'P', index.client);
    expect(first.more).toBe(true);
    expect(index.collab).toHaveLength(DRAIN_TABS);
    const second = await drainOutbox(db.env, 'P', index.client);
    expect(second.more).toBe(false);
    expect(keys(db)).toEqual([]);
  });
});

describe('readContentSummary', () => {
  it('counts a Form tab with no elements as content', async () => {
    const db = plan();
    await upsertTab(
      db.env,
      'P',
      { id: 'f', name: 'Form', elements: [], form: { heading: 'Sign up' } } as never,
      0,
    );
    // A form is no drawn element: its tab counts none, and is still content.
    db.sql.exec("UPDATE tabs SET element_count = 0 WHERE id = 'f'");
    const { summary } = await readContentSummary(db.env, 'P');
    expect(summary).toMatchObject({ hasContent: true, firstTabCount: 0 });
  });

  it('is empty for a plan of empty tabs', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    expect((await readContentSummary(db.env, 'P')).summary.hasContent).toBe(false);
  });
});
