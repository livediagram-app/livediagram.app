import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemHistoryResponse, ItemResponse, ItemsResponse } from '@liveplanner/api-schema';
import { presetSetup, type Item } from '@liveplanner/items';
import { sqliteD1, testCopyPlan, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// A card's history through the api (docs/specs/026-plan/items.md "History", blueprint item-store.md "History"): each
// card write keeps its entry, tagged for an agent or an undo (a tally, a rank and a seed keep none); who may read it
// (Editor, Participant, Viewer, a tab-scoped link, an agent); the author redaction; the cascade; copies; and that it
// rides the plan's own storage, never the room's item ops.

let sql: SqliteD1;
let relayed: unknown[];

type Who = { owner?: string | null; code?: string; agent?: boolean };

async function call<T = unknown>(method: string, path: string, body?: unknown, who: Who = {}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/projects/p1${path}`, {
    env: sql.env,
    owner: who.owner === undefined ? 'owner' : who.owner,
    ...(who.code ? { headers: { 'X-Share-Code': who.code } } : {}),
    ...(who.agent ? { token: { id: 'tok-1' } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const make = async (fields: Item['fields'], type = 'task', who: Who = {}) =>
  (await call<ItemResponse>('POST', '/items', { type, fields }, who)).body.item;

const history = (itemId: string, who: Who = {}, query = '') =>
  call<ItemHistoryResponse>('GET', `/items/${itemId}/history${query}`, undefined, who);

const kinds = async (itemId: string) =>
  (await history(itemId)).body.entries.map((e) => [e.tag ?? '', e.changes.map((c) => c.kind)]);

// Entries a minute and more apart, so none group.
let clock = 1_800_000_000_000;
const tick = () => {
  clock += 120_000;
  vi.setSystemTime(clock);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(init.body);
        return new Response(null, { status: 204 });
      },
    }),
  };
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('visitor', 'Vee', '#16a34a');
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('bug-triage'),
  };
  sql.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                VALUES ('p1', 'owner', 'Plan', 1, 1, 1)`);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(
    `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('p1', 't1', 0, 1)`,
  );
  testShareLink(sql, 'p1', 'PART', 'participate');
  testShareLink(sql, 'p1', 'LOOK', 'view');
  testShareLink(sql, 'p1', 'TAB1', 'edit', 'never', 't1');
});

describe('what each write keeps', () => {
  it('keeps a create, a move, a patch, many patches and a bulk create, newest first', async () => {
    const card = await make({ title: 'Login', status: 'todo' });
    tick();
    await call('POST', `/items/${card.id}/move`, { status: 'doing' });
    tick();
    await call('POST', `/items/${card.id}`, { set: { priority: 'high' } });
    tick();
    await call('POST', '/items/patches', { items: [{ id: card.id, set: { flagged: true } }] });
    expect(await kinds(card.id)).toEqual([
      ['', ['flagged']],
      ['', ['set']],
      ['', ['moved']],
      ['', ['created']],
    ]);
    const bulk = await call<ItemsResponse>('POST', '/items/bulk', {
      items: [
        { type: 'task', fields: { title: 'a' } },
        { type: 'task', fields: { title: 'b' } },
      ],
    });
    for (const made of bulk.body.items) expect(await kinds(made.id)).toEqual([['', ['created']]]);
  });

  it('names the person who made each change, by name and colour, and marks only the reader’s own', async () => {
    const card = await make({ title: 'Login' });
    tick();
    await call(
      'POST',
      `/items/${card.id}`,
      { set: { priority: 'low' } },
      { owner: 'visitor', code: 'PART' },
    );
    const mine = (await history(card.id)).body.entries;
    expect(mine.map((e) => [e.by.name, e.mine ?? false])).toEqual([
      ['Vee', false],
      ['Webber', true],
    ]);
    const theirs = (await history(card.id, { owner: 'visitor', code: 'PART' })).body.entries;
    expect(theirs.map((e) => e.mine ?? false)).toEqual([true, false]);
    // No author id leaves: only names and colours.
    for (const e of [...mine, ...theirs])
      expect(Object.keys(e.by).sort()).toEqual(['color', 'name']);
  });

  it('tags an agent’s write and an undo, and a restore as an undo', async () => {
    const card = await make({ title: 'Login', status: 'todo' }, 'task', { agent: true });
    tick();
    await call('POST', `/items/${card.id}/move`, { status: 'doing' });
    tick();
    await call('POST', `/items/${card.id}/move`, { status: 'todo', undo: true });
    tick();
    await call('POST', '/items/patches', {
      undo: true,
      items: [{ id: card.id, set: { flagged: true } }],
    });
    expect(await kinds(card.id)).toEqual([
      ['undo', ['flagged']],
      ['undo', ['moved']],
      ['', ['moved']],
      ['ai', ['created']],
    ]);
    await call('DELETE', `/items/${card.id}`);
    const back = await call<ItemResponse>('POST', '/items', {
      type: 'task',
      id: card.id,
      key: card.key,
      fields: { title: 'Login', status: 'todo' },
    });
    // The card came back with a fresh history: its old one went with it.
    expect(await kinds(back.body.item.id)).toEqual([['undo', ['created']]]);
  });

  it('tags a bulk card put back by its number as an undo, and an imported card with its thread as new', async () => {
    const thread = {
      id: 'th-aaaaaaaaaaaaaaaa',
      title: 'Imported comments',
      resolved: false,
      comments: [
        {
          id: 'c0',
          text: 'Ana · 1 Mar 2025\nHi',
          createdAt: 1,
          authorName: 'Jira import',
          authorColor: '#71717a',
        },
      ],
      createdAt: 1,
      createdBy: { name: 'Jira import', color: '#71717a' },
      updatedAt: 1,
      home: 'p1',
      cards: [{ projectId: 'p1', itemId: 'imported1', key: null }],
      rev: 1,
    };
    const imported = await call<ItemsResponse>('POST', '/items/bulk', {
      items: [{ type: 'task', id: 'imported1', fields: { title: 'Imported' }, threads: [thread] }],
    });
    expect(imported.status).toBe(201);
    expect(await kinds('imported1')).toEqual([['', ['created']]]);
    const back = await call<ItemsResponse>('POST', '/items/bulk', {
      items: [{ type: 'task', id: 'putback01', key: 41, fields: { title: 'Back' } }],
    });
    expect(back.status).toBe(201);
    expect(await kinds('putback01')).toEqual([['undo', ['created']]]);
  });

  it('keeps nothing for a tally, a rank-only move or a project create’s seed', async () => {
    const card = await make({ title: 'Vote on me', status: 'todo' }, 'note');
    const other = await make({ title: 'Above', status: 'todo' }, 'note');
    tick();
    await call('POST', '/items/tally', { items: [{ id: card.id, votes: { v1: 2 } }] });
    await call('POST', `/items/${card.id}/move`, { status: 'todo', before: other.id });
    expect(await kinds(card.id)).toEqual([['', ['created']]]);
  });

  it('deletes a card’s history with the card', async () => {
    const card = await make({ title: 'Gone' });
    await call('DELETE', `/items/${card.id}`);
    expect(
      sql.sql.prepare('SELECT COUNT(*) AS n FROM item_history WHERE item_id = ?').get(card.id),
    ).toEqual({ n: 0 });
    expect((await history(card.id)).status).toBe(404);
  });

  it('never rides the room’s item ops', async () => {
    const card = await make({ title: 'Quiet' });
    await call('POST', `/items/${card.id}`, { set: { priority: 'high' } });
    await history(card.id);
    expect(JSON.stringify(relayed)).not.toMatch(/history|"changes"/);
  });

  it('is never copied with the plan', async () => {
    const card = await make({ title: 'Copied' });
    await testCopyPlan(sql.env, 'p1', 'p2', 'owner', 'Copy');
    const rows = sql.sql
      .prepare("SELECT COUNT(*) AS n FROM item_history WHERE plan_id = 'p2'")
      .get() as { n: number };
    expect(rows.n).toBe(0);
    expect(await kinds(card.id)).toEqual([['', ['created']]]);
  });
});

describe('who may read it', () => {
  let bug: Item;
  let task: Item;
  beforeEach(async () => {
    bug = await make({ title: 'On the board', status: 'new' }, 'bug');
    task = await make({ title: 'Off the board', status: 'todo' });
  });

  it('answers an Editor, a Participant, a Viewer and an agent alike', async () => {
    for (const who of [
      {},
      { owner: 'visitor', code: 'PART' },
      { owner: 'visitor', code: 'LOOK' },
      { agent: true },
    ]) {
      const res = await history(bug.id, who);
      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
    }
  });

  it('confines a tab-scoped link to the cards its tab shows', async () => {
    // A tab holding only a Plan card for the bug: its link reaches that card alone.
    const planCard = {
      id: 'c1',
      type: 'shape',
      shape: 'plan-card',
      x: 0,
      y: 0,
      width: 240,
      height: 120,
    };
    sql.sql
      .prepare(`UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'`)
      .run(JSON.stringify({ elements: [{ ...planCard, planCard: { itemId: bug.id } }] }));
    const who = { owner: 'visitor', code: 'TAB1' };
    expect((await history(bug.id, who, '?tabId=t1')).status).toBe(200);
    expect((await history(task.id, who, '?tabId=t1')).body).toMatchObject({
      error: 'item_not_found',
    });
  });

  it('refuses someone with no access, and answers a card not in the plan as not found', async () => {
    expect((await history(bug.id, { owner: 'stranger' })).status).toBeGreaterThanOrEqual(403);
    expect((await history('nope-nope-nope')).status).toBe(404);
  });

  it('is read only', async () => {
    expect((await call('POST', `/items/${bug.id}/history`, {})).status).toBe(405);
  });
});
