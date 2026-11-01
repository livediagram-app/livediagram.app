// The migration door into a canvas's room (document-migration.ts, @liveworkspace/index-app migration-room.ts;
// docs/migration.md "The apps' migration door"): a first write, a re-run, a re-run after a new-side edit, the item
// row's rule, the outbox, the door's keys, and an import's cost at its worst sizes.
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { nodeDurableState } from '@liveworkspace/index-app/testing';
import type { MigrationRoomPayload, MigrationTab } from '@liveworkspace/migration';
import worker from '../index';
import { MAX_TAB_BYTES } from '../limits';
import type { Env } from '../types';
import { DocumentRoom } from './document-room';

vi.mock('../auth/accounts', () => ({
  getPersonIdentity: async () => null,
  accountCredentials: () => null,
}));

type Room = { room: DocumentRoom; db: DatabaseSync; counter: { transactions: number } };

function rooms(extra: Partial<Env> = {}) {
  const all = new Map<string, Room>();
  const env = { INDEX_ORIGIN: 'https://index.test', ...extra } as unknown as Env;
  const open = (name: string): Room => {
    let r = all.get(name);
    if (!r) {
      const { state, db, counter } = nodeDurableState(name);
      r = { room: new DocumentRoom(state as unknown as DurableObjectState, env), db, counter };
      all.set(name, r);
    }
    return r;
  };
  Reflect.set(env, 'DOCUMENT_ROOM', {
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => open(id.name).room,
  });
  return { env, open };
}

const body = (elements: unknown[]) => JSON.stringify({ elements });
const box = (id: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});

function tab(id: string, over: Partial<MigrationTab> = {}): MigrationTab {
  return {
    id,
    name: `Tab ${id}`,
    orderIndex: 0,
    folder: null,
    addedAt: 1_000,
    updatedAt: 2_000,
    data: body([box(`${id}-a`)]),
    elementCount: 1,
    ...over,
  };
}

function payload(over: Partial<MigrationRoomPayload> = {}): MigrationRoomPayload {
  return {
    v: 1,
    app: 'livediagram',
    id: 'D',
    name: 'Old canvas',
    ownerId: 'user_ali',
    teamId: 'team-1',
    createdAt: 1_000,
    savedAt: 3_000,
    source: null,
    presentation: '{"slides":[]}',
    opensIn: null,
    tabKind: null,
    tabs: [
      tab('t1', { data: body([box('a'), { id: 'img', type: 'image', imageId: 'img-1' }]) }),
      tab('t2', { orderIndex: 1, folder: 'Folder' }),
    ],
    changesets: [
      {
        id: 'cs1',
        tabId: 't1',
        rev: 4,
        baseRev: 3,
        authorId: 'user_ali',
        authorName: 'Ali',
        authorColor: '#000',
        tokenId: null,
        summary: 'Added a box',
        fingerprints: '[]',
        added: 1,
        changed: 0,
        removed: 0,
        createdTab: 0,
        revertOf: null,
        createdAt: 2_500,
        parts: [
          { part: 'ops', data: '[]' },
          { part: 'inverse', data: '[]' },
        ],
      },
    ],
    imageGrants: [{ imageId: 'img-1', createdAt: 1_500 }],
    imageOwners: [{ imageId: 'img-1', owner: 'user_bo' }],
    plan: null,
    ...over,
  };
}

const rows = (db: DatabaseSync, sql: string) =>
  db
    .prepare(sql)
    .all()
    .map((r) => ({ ...r }));
const one = (db: DatabaseSync, sql: string) => ({ ...db.prepare(sql).get() });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('importMigrated (the migration door into a canvas)', () => {
  it('writes the canvas with its own times, its tabs, changesets and image rows, in one transaction', async () => {
    const { open } = rooms();
    const r = open('D');
    const before = r.counter.transactions;
    const p = payload();
    // A changeset beside a tab the room doesn't hold has nowhere to go, and is left out.
    p.changesets.push({ ...p.changesets[0]!, id: 'cs-gone', tabId: 'elsewhere', rev: 1 });
    const answer = await r.room.importMigrated('D', p);
    expect(answer).toEqual({ written: ['t1', 't2'], edited: [], meta: true });
    expect(r.counter.transactions - before).toBe(1);
    expect(one(r.db, 'SELECT * FROM document')).toMatchObject({
      id: 'D',
      name: 'Old canvas',
      owner_id: 'user_ali',
      team_id: 'team-1',
      created_at: 1_000,
      saved_at: 3_000,
      presentation: '{"slides":[]}',
    });
    // A tab's first revision sits past its newest changeset's.
    expect(rows(r.db, 'SELECT id, rev, updated_at, element_count FROM tabs ORDER BY id')).toEqual([
      { id: 't1', rev: 4, updated_at: 2_000, element_count: 1 },
      { id: 't2', rev: 1, updated_at: 2_000, element_count: 1 },
    ]);
    expect(
      rows(r.db, 'SELECT tab_id, order_index, added_at, folder FROM document_tabs ORDER BY tab_id'),
    ).toEqual([
      { tab_id: 't1', order_index: 0, added_at: 1_000, folder: null },
      { tab_id: 't2', order_index: 1, added_at: 1_000, folder: 'Folder' },
    ]);
    expect(rows(r.db, 'SELECT tab_id, mode, element_count FROM tab_stats ORDER BY tab_id')).toEqual(
      [
        { tab_id: 't1', mode: 'diagram', element_count: 2 },
        { tab_id: 't2', mode: 'diagram', element_count: 1 },
      ],
    );
    expect(rows(r.db, 'SELECT * FROM image_refs')).toEqual([{ tab_id: 't1', image_id: 'img-1' }]);
    expect(rows(r.db, 'SELECT * FROM image_owners')).toEqual([
      { image_id: 'img-1', owner_id: 'user_bo' },
    ]);
    expect(rows(r.db, 'SELECT * FROM image_grants')).toEqual([
      { image_id: 'img-1', created_at: 1_500 },
    ]);
    expect(one(r.db, 'SELECT id, document_id, rev, created_at FROM agent_changesets')).toEqual({
      id: 'cs1',
      document_id: 'D',
      rev: 4,
      created_at: 2_500,
    });
    expect(rows(r.db, 'SELECT part FROM agent_changeset_parts ORDER BY part')).toEqual([
      { part: 'inverse' },
      { part: 'ops' },
    ]);
    expect(rows(r.db, 'SELECT tab_id, rev FROM migration_tabs ORDER BY tab_id')).toEqual([
      { tab_id: 't1', rev: 4 },
      { tab_id: 't2', rev: 1 },
    ]);
    // The outbox triggers saw the writes: the summary, each tab's collab rows and the images are owed.
    expect(rows(r.db, 'SELECT kind, key FROM outbox ORDER BY kind, key')).toEqual([
      { kind: 'images', key: '' },
      { kind: 'summary', key: '' },
      { kind: 'tab', key: 't1' },
      { kind: 'tab', key: 't2' },
    ]);
  });

  it('pushes the imported canvas to the index from its outbox, as any write', async () => {
    const calls: string[] = [];
    let summary: unknown = null;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      const path = new URL(req.url).pathname;
      calls.push(`${req.method} ${path}`);
      if (path.endsWith('/summary')) summary = await req.json();
      return Response.json({ ok: true });
    });
    const { open } = rooms({ INDEX_KEY: 'idx' });
    const r = open('D');
    await r.room.importMigrated('D', payload());
    await r.room.drain();
    expect(calls).toEqual(
      expect.arrayContaining([
        'PUT /api/index/app/items/D/summary',
        'PUT /api/index/app/items/D/collab/t1',
        'PUT /api/index/app/items/D/collab/t2',
      ]),
    );
    // The index already holds the item (made by the migrate tool): its change time is the old side's, never now.
    expect(summary).toMatchObject({ updatedAt: 3_000 });
  });

  it('replaces an unchanged re-run, moving each tab one revision on', async () => {
    const { open } = rooms();
    const r = open('D');
    await r.room.importMigrated('D', payload());
    const next = payload({
      savedAt: 4_000,
      name: 'Renamed on the old side',
      tabs: payload().tabs.map((t) => ({ ...t, data: body([box('new')]), updatedAt: 3_500 })),
    });
    expect(await r.room.importMigrated('D', next)).toEqual({
      written: ['t1', 't2'],
      edited: [],
      meta: true,
    });
    expect(rows(r.db, 'SELECT id, rev, updated_at FROM tabs ORDER BY id')).toEqual([
      { id: 't1', rev: 5, updated_at: 3_500 },
      { id: 't2', rev: 2, updated_at: 3_500 },
    ]);
    expect(one(r.db, 'SELECT name, saved_at FROM document')).toEqual({
      name: 'Renamed on the old side',
      saved_at: 4_000,
    });
    // Nothing doubled: one changeset, one image row each.
    expect(one(r.db, 'SELECT COUNT(*) AS n FROM agent_changesets').n).toBe(1);
    expect(one(r.db, 'SELECT COUNT(*) AS n FROM image_grants').n).toBe(1);
  });

  it('leaves a tab edited on the new side, and one deleted there, and answers them in `edited`', async () => {
    const { open } = rooms();
    const r = open('D');
    await r.room.importMigrated('D', payload());
    r.db.exec(`UPDATE tabs SET data = '{"elements":[]}', rev = rev + 1 WHERE id = 't1'`);
    r.db.exec(`DELETE FROM tabs WHERE id = 't2'`);
    const answer = await r.room.importMigrated(
      'D',
      payload({ tabs: payload().tabs.map((t) => ({ ...t, data: body([box('old-side')]) })) }),
    );
    expect(answer.written).toEqual([]);
    expect(answer.edited).toEqual(['t1', 't2']);
    expect(one(r.db, `SELECT data, rev FROM tabs WHERE id = 't1'`)).toEqual({
      data: '{"elements":[]}',
      rev: 5,
    });
    // Deleted on the new side: never brought back.
    expect(one(r.db, 'SELECT COUNT(*) AS n FROM tabs').n).toBe(1);
  });

  it('never writes over a tab the new side made under the same id', async () => {
    const { open } = rooms();
    const r = open('D');
    await r.room.importMigrated('D', payload({ tabs: [tab('t2')] }));
    r.db.exec(
      `INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t9', 'Mine', '{}', 5, 0, 3)`,
    );
    const answer = await r.room.importMigrated('D', payload({ tabs: [tab('t9')] }));
    expect(answer).toMatchObject({ written: [], edited: ['t9'] });
    expect(one(r.db, `SELECT name FROM tabs WHERE id = 't9'`).name).toBe('Mine');
  });

  it('writes the canvas row only while it is empty or still as the door wrote it', async () => {
    const { open } = rooms();
    // Saved on the new side since the import: the row is the new side's now.
    const a = open('A');
    await a.room.importMigrated('A', payload({ id: 'A' }));
    a.db.exec(`UPDATE document SET saved_at = 9000, name = 'Mine now'`);
    const again = await a.room.importMigrated(
      'A',
      payload({ id: 'A', name: 'Old', savedAt: 5000 }),
    );
    expect(again.meta).toBe(false);
    expect(one(a.db, 'SELECT name, saved_at FROM document')).toEqual({
      name: 'Mine now',
      saved_at: 9000,
    });
    // Started on the new side with a tab of its own, never imported: left as it is.
    const b = open('B');
    b.db.exec(`PRAGMA foreign_keys = ON`);
    await b.room.importMigrated('B', payload({ id: 'B', tabs: [] }));
    b.db.exec(`DELETE FROM migration_rows`);
    b.db.exec(`UPDATE document SET name = 'New side', saved_at = 7000`);
    b.db.exec(
      `INSERT INTO tabs (id, name, data, updated_at, rev) VALUES ('n1', 'N', '{}', 1, 1);
       INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('B', 'n1', 0, 1);`,
    );
    expect((await b.room.importMigrated('B', payload({ id: 'B' }))).meta).toBe(false);
    expect(one(b.db, 'SELECT name FROM document').name).toBe('New side');
  });
});

describe('PUT /api/internal/items/:id/migration on livehuddle', () => {
  const put = (env: Env, p: unknown, auth: string) =>
    worker.fetch(
      new Request('https://api.test/api/internal/items/D/migration', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      }),
      env,
    );

  it('takes MIGRATION_KEY or INDEX_KEY, refuses a wrong one, and is absent with neither', async () => {
    const { env } = rooms({ INDEX_KEY: 'idx', MIGRATION_KEY: 'mig' });
    expect((await put(env, payload(), 'mig')).status).toBe(200);
    expect((await put(env, payload(), 'idx')).status).toBe(200);
    expect((await put(env, payload(), 'nope')).status).toBe(401);
    const none = rooms();
    expect((await put(none.env, payload(), 'mig')).status).toBe(404);
  });

  it('refuses the whole part, naming the tab, when a tab is over the tab cap', async () => {
    const { env, open } = rooms({ MIGRATION_KEY: 'mig' });
    const huge = tab('big', { data: `{"elements":[],"pad":"${'x'.repeat(MAX_TAB_BYTES)}"}` });
    const res = await put(env, payload({ tabs: [tab('t1'), huge] }), 'mig');
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: 'tab_too_large', tabId: 'big' });
    // Nothing reached the room.
    expect(open('D').db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'tabs'").get()).toBe(
      undefined,
    );
  });
});

describe('the cost of an import', () => {
  it('writes a 200-tab canvas and a canvas with one tab near the cap within budget', async () => {
    const { open } = rooms();
    const many = payload({
      id: 'M',
      changesets: [],
      tabs: Array.from({ length: 200 }, (_, i) =>
        tab(`t${i}`, {
          orderIndex: i,
          data: body(Array.from({ length: 40 }, (_, j) => box(`t${i}-e${j}`))),
          elementCount: 40,
        }),
      ),
    });
    const m = open('M');
    const manyMs = await cpuMsOfAsync(async () => void (await m.room.importMigrated('M', many)));
    const manyAgainMs = await cpuMsOfAsync(
      async () => void (await m.room.importMigrated('M', many)),
    );
    const elements = Array.from({ length: 5_000 }, (_, j) => ({
      ...box(`e${j}`),
      label: 'x'.repeat(300),
    }));
    const data = body(elements);
    expect(data.length).toBeGreaterThan(1_900_000);
    expect(data.length).toBeLessThan(MAX_TAB_BYTES);
    const big = payload({
      id: 'B',
      changesets: [],
      tabs: [tab('t1', { data, elementCount: 5_000 })],
    });
    const b = open('B');
    const bigMs = await cpuMsOfAsync(async () => void (await b.room.importMigrated('B', big)));
    console.log('[perf] migration import', {
      tabs200Ms: manyMs,
      tabs200RerunMs: manyAgainMs,
      tab2MbMs: bigMs,
      tab2MbBytes: data.length,
    });
    expect(manyMs).toBeLessThan(cpuBudgetMs(400));
    expect(manyAgainMs).toBeLessThan(cpuBudgetMs(400));
    expect(bigMs).toBeLessThan(cpuBudgetMs(300));
  });
});
