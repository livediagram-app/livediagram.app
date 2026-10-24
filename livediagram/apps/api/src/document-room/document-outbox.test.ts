import { describe, expect, it, vi } from 'vitest';
import { recordItemEditor } from '@liveworkspace/index-app';
import type { Element } from '@livediagram/document';
import { deleteTabRow, upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { accountsServiceFor } from '../test-accounts-service';
import {
  DRAIN_TABS,
  drainOutbox,
  itemSummaryOf,
  readContentSummary,
  DOCUMENT_OUTBOX,
} from './document-outbox';
import {
  IndexError,
  type AppTimelineEvent,
  type CollabPush,
  type IndexAppClient,
  type ItemSummary,
} from '@liveworkspace/index-client';

// What a document pushes to the index (document-outbox.ts): the triggers key each change in the write's own transaction,
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

function document(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
               VALUES ('P', 'owner', 'P', ${T0}, ${T0})`);
  return db;
}

const rows = (db: SqliteD1, query: string) => db.sql.prepare(query).all();
const keys = (db: SqliteD1) =>
  rows(db, "SELECT kind || ':' || key AS k FROM outbox WHERE document_id = 'P' ORDER BY id").map(
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
    const db = document();
    await drainOutbox(db.env, 'P', fakeIndex().client);
    const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_a', T0 + 1);
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_b', T0 + 2);
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_a', T0 + 3);
    // A person whose id starts like another's keeps their own key.
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_ab', T0 + 4);
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
    const db = document();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    // A new tab also owes the media service the document's images (none here, and no service to tell).
    expect(keys(db)).toEqual(['tab:t1', 'images:', 'summary:']);
    const index = fakeIndex();

    const pushed = await drainOutbox(db.env, 'P', index.client);

    expect(pushed).toMatchObject({ more: false, pushes: 2 });
    expect(keys(db)).toEqual([]);
    expect(index.collab).toHaveLength(1);
    expect(index.collab[0]!.tab).toBe('t1');
    expect(index.collab[0]!.push.actions.map((a) => a.actionId)).toEqual(['act-a']);
    expect(index.summaries[0]!.summary).toMatchObject({
      elements: 1,
      empty: false,
      hasContent: true,
    });
  });

  it('names the one person who saved since the last push as who closed an action, and nobody among several', async () => {
    const db = document();
    const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
    const done = box('a', {
      action: {
        ...(actionOn('a') as { action: Record<string, unknown> }).action,
        status: 'done',
        updatedAt: T0 + 5,
      },
    });
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [done] }, 0);
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_a', T0 + 5);
    const one = fakeIndex();
    await drainOutbox(db.env, 'P', one.client);
    expect(one.collab[0]!.push.actions[0]).toMatchObject({ status: 'done', doneById: 'user_a' });

    await upsertTab(db.env, 'P', { id: 't1', name: 'Board 2', elements: [done] }, 0);
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_a', T0 + 6);
    recordItemEditor(exec, DOCUMENT_OUTBOX, 'P', 'user_b', T0 + 7);
    const two = fakeIndex();
    await drainOutbox(db.env, 'P', two.client);
    expect(two.collab[0]!.push.actions[0]).toMatchObject({ doneById: null });
  });

  it("reports the owner's newest save to liveworkspace's onboarding emails with the summary", async () => {
    const db = sqliteD1();
    const accounts = accountsServiceFor(db.env);
    db.sql.exec(`INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
                 VALUES ('P', 'user_ada', 'P', ${T0}, ${T0})`);
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    expect(accounts.activity).toEqual([{ userId: 'user_ada', at: expect.any(Number) }]);
    vi.unstubAllGlobals();
  });

  it('pushes an empty collab for a tab that is gone', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    await deleteTabRow(db.env, 'P', 't1');
    const index = fakeIndex();
    await drainOutbox(db.env, 'P', index.client);
    expect(index.collab).toEqual([{ tab: 't1', push: { threads: [], actions: [] } }]);
  });

  it('keeps the keys of a failed push for the next drain, and drops those the index does not hold', async () => {
    const db = document();
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

  it('tells the media service the images the document places, the whole set, when it changes', async () => {
    const db = sqliteD1({ MEDIA_KEY: 'k', MEDIA_URL: 'https://media.test' });
    db.sql.exec(`INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
                 VALUES ('P', 'owner', 'P', ${T0}, ${T0})`);
    const synced: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      if (new URL(req.url).pathname.endsWith('/refs')) synced.push(await req.json());
      return Response.json({ ok: true });
    });
    const picture = (id: string, imageId: string): Element =>
      ({ id, type: 'image', x: 0, y: 0, width: 10, height: 10, imageId }) as unknown as Element;
    await upsertTab(db.env, 'P', { id: 't1', name: 'A', elements: [picture('p1', 'img-1')] }, 0);
    await upsertTab(db.env, 'P', { id: 't2', name: 'B', elements: [picture('p2', 'img-1')] }, 1);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    expect(synced).toEqual([{ documents: [{ document: 'P', images: ['img-1'] }], complete: true }]);

    // A save that keeps what the tabs place owes the service nothing.
    synced.length = 0;
    await upsertTab(
      db.env,
      'P',
      { id: 't2', name: 'Renamed', elements: [picture('p2', 'img-1')] },
      1,
    );
    expect(keys(db)).not.toContain('images:');
    // A tab that stops placing one sends the whole set again: still img-1 (t1 places it), then none.
    await upsertTab(db.env, 'P', { id: 't2', name: 'B', elements: [] }, 1);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    await upsertTab(db.env, 'P', { id: 't1', name: 'A', elements: [] }, 0);
    await drainOutbox(db.env, 'P', fakeIndex().client);
    expect(synced).toEqual([
      { documents: [{ document: 'P', images: ['img-1'] }], complete: true },
      { documents: [{ document: 'P', images: [] }], complete: true },
    ]);
    vi.unstubAllGlobals();
  });

  it(`takes at most ${DRAIN_TABS} tabs a drain, saying there is more`, async () => {
    const db = document();
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
  it('counts an article tab with no elements as content', async () => {
    const db = document();
    const article = { blocks: [{ id: 'b1', type: 'title', runs: [{ text: 'Notes' }] }] };
    await upsertTab(
      db.env,
      'P',
      { id: 'a', name: 'Essay', elements: [], articles: { f1: article } } as never,
      0,
    );
    // An article's writing lives beside the elements: its tab counts none, and is still content.
    const { summary } = await readContentSummary(db.env, 'P');
    expect(summary).toMatchObject({ hasContent: true, firstTabCount: 0 });
  });

  it('counts a body that is not JSON as content, failing safe', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    db.sql.exec("UPDATE tabs SET data = '{not json', rev = rev + 1 WHERE id = 't'");
    expect((await readContentSummary(db.env, 'P')).summary.hasContent).toBe(true);
  });

  it('is empty for a document of empty tabs', async () => {
    const db = document();
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
