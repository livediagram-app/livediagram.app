import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { presetSetup } from '@liveplanner/items';
import type { Element } from '@liveplanner/project';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// A tab-scoped Editor keeps to its tab's content (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"):
// the tab's name, its boards, plan views and Plan cards, and where its form sends responses stay the owner's, on
// every api door (the rename route, the whole-tab save, a changeset, a revert and an agent's form write).

const OWNER = 'user_owner';
const board: Element = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 500,
  planBoard: presetSetup('kanban'),
};
const sticky = (id: string, x = 0): Element =>
  ({ id, type: 'sticky', x, y: 600, width: 160, height: 160, text: id }) as Element;
const view = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'plan-view',
  x: 0,
  y: 900,
  width: 400,
  height: 300,
  planView: { view: 'gantt' },
});
const planCard = (id: string, itemId: string): Element => ({
  id,
  type: 'shape',
  shape: 'plan-card',
  x: 900,
  y: 0,
  width: 240,
  height: 120,
  planCard: { itemId },
});

const room = {
  idFromName: (n: string) => n,
  get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
};

let db: SqliteD1;

function call(method: string, path: string, body?: unknown, code?: string) {
  const owner = code ? 'user_visitor' : OWNER;
  return handleProjects(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      accountUserId: owner,
      verifiedUserId: owner,
      body,
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
    }),
  );
}

const storedTab = (tab = 't1') => {
  const row = db.sql.prepare('SELECT name, data FROM tabs WHERE id = ?').get(tab) as {
    name: string;
    data: string;
  };
  return { name: row.name, ...(JSON.parse(row.data) as { elements: Element[]; form?: unknown }) };
};
const ids = (tab = 't1') => storedTab(tab).elements.map((e) => e.id);

beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  db = sqliteD1({ PLAN_ROOM: room } as unknown as Partial<Env>);
  const created = await call('POST', '/api/projects', {
    id: 'D',
    name: 'Plan',
    tabs: [
      { id: 't1', name: 'Board', elements: [board, sticky('s1')] },
      { id: 't2', name: 'Elsewhere', elements: [] },
    ],
  });
  expect(created.status).toBe(201);
  testShareLink(db, 'D', 'TAB1', 'edit', 'never', 't1');
  testShareLink(db, 'D', 'ALL', 'edit', 'never', null);
});

afterEach(() => vi.restoreAllMocks());

describe('a tab-scoped Editor and its tab’s name', () => {
  it('cannot rename its tab; an Editor of every tab can', async () => {
    const refused = await call('PUT', '/api/projects/D/tabs/t1/name', { name: 'Mine' }, 'TAB1');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: 'tab_structure' });
    expect(storedTab().name).toBe('Board');
    expect(
      (await call('PUT', '/api/projects/D/tabs/t1/name', { name: 'Ours' }, 'ALL')).status,
    ).toBe(200);
    expect(storedTab().name).toBe('Ours');
  });

  it('keeps the stored name on a whole-tab save, landing the rest', async () => {
    const res = await call(
      'PUT',
      '/api/projects/D/tabs/t1',
      { id: 't1', name: 'Renamed', elements: [board, sticky('s1', 300)] },
      'TAB1',
    );
    expect(res.status).toBe(200);
    expect(storedTab().name).toBe('Board');
    expect(storedTab().elements.find((e) => e.id === 's1')).toMatchObject({ x: 300 });
  });
});

describe('a tab-scoped Editor and the cards its tab pulls in', () => {
  it('saves without adding a board, plan view or Plan card, or removing the board', async () => {
    const res = await call(
      'PUT',
      '/api/projects/D/tabs/t1',
      {
        id: 't1',
        name: 'Board',
        elements: [sticky('s1'), view('v1'), planCard('c1', 'i_other'), sticky('s2')],
      },
      'TAB1',
    );
    expect(res.status).toBe(200);
    // The new sticky lands; the board stays, the plan view and Plan card do not.
    expect(ids()).toEqual(['s1', 's2', 'b1']);
  });

  it('moves the board it has, and cannot turn a sticky into a board', async () => {
    const moved = { ...board, x: 50 } as Element;
    const turned = { ...board, id: 's1' };
    const res = await call(
      'PUT',
      '/api/projects/D/tabs/t1',
      { id: 't1', name: 'Board', elements: [moved, turned] },
      'TAB1',
    );
    expect(res.status).toBe(200);
    expect(storedTab().elements).toEqual([moved, sticky('s1')]);
  });

  it('refuses a changeset that adds a plan view, and lets one through that moves the board', async () => {
    const add = await call(
      'POST',
      '/api/projects/D/tabs/t1/changesets',
      { operations: [{ op: 'add', element: view('v1') }] },
      'TAB1',
    );
    expect(add.status).toBe(403);
    expect(await add.json()).toMatchObject({ error: 'tab_structure' });
    const rm = await call(
      'POST',
      '/api/projects/D/tabs/t1/changesets',
      { operations: [{ op: 'rm', target: 'b1' }] },
      'TAB1',
    );
    expect(rm.status).toBe(403);
    const move = await call(
      'POST',
      '/api/projects/D/tabs/t1/changesets',
      { operations: [{ op: 'set', target: 'b1', fields: { x: 40 } }] },
      'TAB1',
    );
    expect(move.status).toBe(200);
    expect(ids()).toEqual(['b1', 's1']);
    // Every tab's Editor adds one.
    expect(
      (
        await call(
          'POST',
          '/api/projects/D/tabs/t1/changesets',
          { operations: [{ op: 'add', element: view('v1') }] },
          'ALL',
        )
      ).status,
    ).toBe(200);
  });

  it('cannot revert a changeset that added a plan view', async () => {
    const added = await call('POST', '/api/projects/D/tabs/t1/changesets', {
      operations: [{ op: 'add', element: view('v1') }],
    });
    const id = (await added.json<{ changeset: { id: string } }>()).changeset.id;
    const revert = await call('POST', `/api/projects/D/changesets/${id}/revert`, {}, 'TAB1');
    expect(revert.status).toBe(403);
    expect(await revert.json()).toMatchObject({ error: 'tab_structure' });
    expect(ids()).toContain('v1');
  });
});

describe('a tab-scoped Editor and its form’s destination', () => {
  const form = (destinationTab: string) => ({
    v: 1,
    heading: 'Bugs',
    sections: [{ id: 's', title: 'Bugs', questions: [] }],
    destination: { tabId: destinationTab, typeId: 'task', status: 'todo' },
  });

  it('keeps a whole-tab save’s form pointed where it was stored', async () => {
    await call('PUT', '/api/projects/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [board, sticky('s1')],
      form: form('t1'),
    });
    await call(
      'PUT',
      '/api/projects/D/tabs/t1',
      { id: 't1', name: 'Board', elements: [board, sticky('s1')], form: form('t2') },
      'TAB1',
    );
    expect(storedTab().form).toMatchObject({ destination: { tabId: 't1' } });
  });

  it('refuses an agent form write that points the form at another tab', async () => {
    const res = await call('POST', '/api/projects/D/tabs/t1/form', { form: form('t2') }, 'TAB1');
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'tab_structure' });
  });
});
