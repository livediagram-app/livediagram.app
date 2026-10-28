import { describe, expect, it, vi } from 'vitest';
import { recordItemEditor } from '@liveworkspace/index-app';
import type { Element } from '@liveplanner/project';
import { deleteTabRow, upsertTab } from '../db/tabs';
import { insertItems } from '../db/items';
import { itemPersonId, presetSetup, type Item } from '@liveplanner/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { ACCOUNTS_ON, stubAccounts } from '../test-accounts';
import {
  DRAIN_TABS,
  drainOutbox,
  itemSummaryOf,
  readContentSummary,
  PLAN_OUTBOX,
} from './plan-outbox';
import {
  IndexError,
  type AppTimelineEvent,
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
    const db = plan();
    await drainOutbox(db.env, 'P', fakeIndex().client);
    const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
    recordItemEditor(exec, PLAN_OUTBOX, 'P', 'user_a', T0 + 1);
    recordItemEditor(exec, PLAN_OUTBOX, 'P', 'user_b', T0 + 2);
    recordItemEditor(exec, PLAN_OUTBOX, 'P', 'user_a', T0 + 3);
    // A person whose id starts like another's keeps their own key.
    recordItemEditor(exec, PLAN_OUTBOX, 'P', 'user_ab', T0 + 4);
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
  // emails"): the plan's owner, reported with its summary, never a guest.
  it("reports the owner's newest save to the accounts Worker with the summary", async () => {
    const accounts = stubAccounts();
    try {
      const db = sqliteD1(ACCOUNTS_ON);
      db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, saved_at, created_at)
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

describe('the cards push', () => {
  const person = async (id: string) => ({ id: await itemPersonId(id), name: id, color: '#000' });
  const card = async (
    id: string,
    key: number,
    fields: Item['fields'],
    by = 'owner',
  ): Promise<Item> => ({
    id,
    type: 'task',
    key,
    rank: 'i',
    fields: { title: `Card ${key}`, ...fields },
    rev: 1,
    createdAt: T0,
    updatedAt: T0 + key,
    createdBy: await person(by),
    updatedBy: await person(by),
  });
  const board = (): Element =>
    box('b1', {
      shape: 'plan-board',
      width: 800,
      height: 500,
      planBoard: presetSetup('bug-triage'),
    });

  it('keys a card write, and names its hashed assignee from the people the plan knows', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Sprint', elements: [board()] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
    // user_b edited the plan once: known from then on.
    recordItemEditor(exec, PLAN_OUTBOX, 'P', 'user_b', T0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    await insertItems(db.env, 'P', [
      await card('c1', 1, { status: 'new', assignee: await person('user_b') }),
      await card('c2', 2, { status: 'new', assignee: await person('user_stranger') }),
      await card('c3', 3, {
        comments: {
          resolved: false,
          comments: [
            {
              id: 'm1',
              authorId: 'user_c',
              authorName: 'Cat',
              authorColor: '#f00',
              text: 'hi',
              createdAt: T0 + 5,
            },
          ],
        },
      }),
    ]);
    expect(keys(db)).toContain('tab:~cards');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const index = fakeIndex();
    await drainOutbox(db.env, 'P', index.client);
    info.mockRestore();
    const cards = index.collab.find((c) => c.tab === '~cards')!.push;
    expect(cards.actions.map((a) => [a.actionId, a.assigneeId, a.assignerId])).toEqual([
      ['c1', 'user_b', 'owner'],
    ]);
    expect(cards.actions[0]!.card).toMatchObject({
      key: 1,
      title: 'Card 1',
      board: { tabId: 't1', elementId: 'b1', tabName: 'Sprint' },
    });
    expect(cards.threads.map((t) => [t.elementId, t.participantIds])).toEqual([
      ['c-c3', ['user_c']],
    ]);
    expect(rows(db, 'SELECT person_id FROM known_people')).toEqual([{ person_id: 'user_b' }]);
  });

  it('leaves a custom assignee out of the push, never counting them as unmatched', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Sprint', elements: [board()] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    await insertItems(db.env, 'P', [
      await card('c1', 1, {
        status: 'new',
        assignee: { id: 'n-casey', name: 'Casey', color: '#000' },
      }),
      await card('c2', 2, { status: 'new', assignee: await person('owner') }),
    ]);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const index = fakeIndex();
    await drainOutbox(db.env, 'P', index.client);
    expect(info.mock.calls.some(([tag]) => tag === '[outbox] cards-unmatched')).toBe(false);
    info.mockRestore();
    const cards = index.collab.find((c) => c.tab === '~cards')!.push;
    expect(cards.actions.map((a) => [a.actionId, a.assigneeId])).toEqual([['c2', 'owner']]);
  });

  it('pushes 1,000 cards among 500 known people within budget', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Sprint', elements: [board()] }, 0);
    const people = Array.from({ length: 500 }, (_, i) => `user_${i}`);
    const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
    people.forEach((p, i) => recordItemEditor(exec, PLAN_OUTBOX, 'P', p, T0 + i));
    await drainOutbox(db.env, 'P', fakeIndex().client);
    const cards = await Promise.all(
      Array.from({ length: 1_000 }, async (_, i) =>
        card(`c${i}`, i + 1, { status: 'new', assignee: await person(people[i % 500]!) }),
      ),
    );
    await insertItems(db.env, 'P', cards);
    const index = fakeIndex();
    const start = performance.now();
    await drainOutbox(db.env, 'P', index.client);
    const took = performance.now() - start;
    expect(index.collab.find((c) => c.tab === '~cards')!.push.actions).toHaveLength(500);
    // Measured about 17 ms on a laptop (500 hashes, 1,000 cards); the budget leaves room for a slow CI runner.
    expect(took).toBeLessThan(1_000);
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

  it('counts a card as content, even with no board drawn', async () => {
    const db = plan();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    const owner = { id: await itemPersonId('owner'), name: 'owner', color: '#000' };
    await insertItems(db.env, 'P', [
      {
        id: 'c1',
        type: 'task',
        key: 1,
        rank: 'i',
        fields: { title: 'Card 1' },
        rev: 1,
        createdAt: T0,
        updatedAt: T0,
        createdBy: owner,
        updatedBy: owner,
      },
    ]);
    expect((await readContentSummary(db.env, 'P')).summary.hasContent).toBe(true);
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
