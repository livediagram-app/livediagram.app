import { describe, expect, it, vi } from 'vitest';
import { recordItemEditor } from '@liveworkspace/index-app';
import type { Element } from '@livedesign/design';
import { deleteTabRow, upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { ACCOUNTS_ENV, fakeAccounts } from '../test-accounts';
import {
  DRAIN_TABS,
  drainOutbox,
  itemSummaryOf,
  readContentSummary,
  DESIGN_OUTBOX,
} from './design-outbox';
import {
  IndexError,
  type AppTimelineEvent,
  type CollabPush,
  type IndexAppClient,
  type ItemSummary,
} from '@liveworkspace/index-client';

// What a design pushes to the index (design-outbox.ts): the triggers key each change in the write's own transaction,
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

function design(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_designs (id, owner_id, name, saved_at, created_at)
               VALUES ('P', 'owner', 'P', ${T0}, ${T0})`);
  return db;
}

const rows = (db: SqliteD1, query: string) => db.sql.prepare(query).all();
const keys = (db: SqliteD1) =>
  rows(db, "SELECT kind || ':' || key AS k FROM outbox WHERE design_id = 'P' ORDER BY id").map(
    (r) => String(r.k),
  );

// The index as the drain sees it: every push recorded, a failure on demand.
function fakeIndex(fail: (kind: string) => Error | null = () => null) {
  const collab: { tab: string; push: CollabPush }[] = [];
  const summaries: { summary: ItemSummary; savedAt: number | undefined }[] = [];
  const events: AppTimelineEvent[][] = [];
  const client = {
    pushEvents: async (_id: string, batch: AppTimelineEvent[]) => {
      const err = fail('events');
      if (err) throw err;
      events.push(batch);
    },
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
  return { client, collab, summaries, events };
}

describe('the outbox', () => {
  it('keeps one edit key per person at their latest write, and reports them all in one batch', async () => {
    const db = design();
    await drainOutbox(db.env, 'P', fakeIndex().client);
    const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
    recordItemEditor(exec, DESIGN_OUTBOX, 'P', 'user_a', T0 + 1);
    recordItemEditor(exec, DESIGN_OUTBOX, 'P', 'user_b', T0 + 2);
    recordItemEditor(exec, DESIGN_OUTBOX, 'P', 'user_a', T0 + 3);
    // A person whose id starts like another's keeps their own key.
    recordItemEditor(exec, DESIGN_OUTBOX, 'P', 'user_ab', T0 + 4);
    expect(keys(db)).toEqual([
      `edit:user_b@${T0 + 2}`,
      `edit:user_a@${T0 + 3}`,
      `edit:user_ab@${T0 + 4}`,
    ]);

    const failing = fakeIndex((kind) => (kind === 'events' ? new Error('down') : null));
    await expect(drainOutbox(db.env, 'P', failing.client)).rejects.toThrow('down');
    expect(keys(db)).toHaveLength(3);

    const index = fakeIndex();
    await drainOutbox(db.env, 'P', index.client);
    expect(index.events).toEqual([
      [
        { type: 'edited', actorId: 'user_b', at: T0 + 2 },
        { type: 'edited', actorId: 'user_a', at: T0 + 3 },
        { type: 'edited', actorId: 'user_ab', at: T0 + 4 },
      ],
    ]);
    expect(keys(db)).toEqual([]);
  });

  it('keys a tab write in the same transaction, and a drain pushes its Inbox rows and summary and empties it', async () => {
    const db = design();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    expect(keys(db)).toEqual(['tab:t1', 'summary:']);
    const index = fakeIndex();

    const pushed = await drainOutbox(db.env, 'P', index.client);

    expect(pushed).toMatchObject({ more: false, pushes: 2 });
    expect(keys(db)).toEqual([]);
    expect(index.collab).toHaveLength(1);
    expect(index.collab[0]!.tab).toBe('t1');
    expect(index.collab[0]!.push.actions.map((a) => a.actionId)).toEqual(['act-a']);
    // The tab's name and each action's note and names ride along, for the Inbox's rows.
    expect(index.collab[0]!.push.tabName).toBe('Board');
    expect(Object.keys(index.collab[0]!.push.actions[0]!)).toEqual(
      expect.arrayContaining(['description', 'assigneeName', 'assignerName']),
    );
    expect(index.summaries[0]!.summary).toMatchObject({
      elements: 1,
      empty: false,
      hasContent: true,
    });
  });

  // liveworkspace's onboarding emails read when someone last saved (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding
  // emails"): the design's owner, reported with its summary, never a guest.
  it("reports the owner's newest save to the accounts Worker with the summary", async () => {
    const accounts = fakeAccounts();
    vi.stubGlobal('fetch', accounts.fetch);
    try {
      const db = sqliteD1(ACCOUNTS_ENV);
      db.sql.exec(`INSERT INTO test_designs (id, owner_id, name, saved_at, created_at)
                   VALUES ('P', 'user_owner', 'P', ${T0}, ${T0}),
                          ('G', 'guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880', 'G', ${T0}, ${T0})`);
      await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
      await upsertTab(db.env, 'G', { id: 't2', name: 'Board', elements: [actionOn('b')] }, 0);
      await drainOutbox(db.env, 'P', fakeIndex().client);
      await drainOutbox(db.env, 'G', fakeIndex().client);
      expect(accounts.activity).toHaveLength(1);
      expect(accounts.activity[0]!.userId).toBe('user_owner');
      expect(accounts.activity[0]!.at).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pushes an empty collab for a tab that is gone', async () => {
    const db = design();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    await deleteTabRow(db.env, 'P', 't1');
    const index = fakeIndex();
    await drainOutbox(db.env, 'P', index.client);
    expect(index.collab).toEqual([{ tab: 't1', push: { threads: [], actions: [] } }]);
  });

  it('keeps the keys of a failed push for the next drain, and drops those the index does not hold', async () => {
    const db = design();
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
    const db = design();
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
  it('is empty for a design of empty tabs', async () => {
    const db = design();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    expect((await readContentSummary(db.env, 'P')).summary.hasContent).toBe(false);
  });
});

// The index's daily empty clean-up reads `hasContent` (liveworkspace/apps/index/src/purge.ts sweepEmpty).
describe('itemSummaryOf', () => {
  it('tells the index whether any tab holds anything', () => {
    const blank = { firstTabCount: null, tabCounts: {}, stats: null, hasContent: false };
    expect(itemSummaryOf(blank)).toMatchObject({ empty: true, hasContent: false });
    expect(itemSummaryOf({ ...blank, firstTabCount: 0, hasContent: true })).toMatchObject({
      empty: true,
      hasContent: true,
    });
  });
});
