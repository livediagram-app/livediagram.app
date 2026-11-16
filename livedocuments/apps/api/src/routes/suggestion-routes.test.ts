import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import type { ItemGrant } from '@liveworkspace/index-app';
import type { Element } from '@livedocuments/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// Canvas suggestions end to end on real SQLite (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md
// "Share roles", "Reviewing"): who may suggest, who may accept, one changeset per accept, a stale one flagged, the
// room told without content, and the review settings an Editor alone sets.

const OWNER = 'user_owner';
const GUEST = 'guest_00000000-0000-4000-8000-000000000009';
const box = (id: string, x = 0): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 120,
  height: 60,
  label: id,
});

function room() {
  const calls: { path: string; body: unknown }[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (input: string, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        calls.push({ path, body: init?.body ? sentJson(init) : null });
        if (path === '/selections') return Response.json({ selections: [] });
        return new Response(null, { status: 204 });
      },
    }),
  };
  return { calls, binding };
}

const grantOf = (level: ItemGrant['level'], tab: string | null = null): ItemGrant => ({
  item: 'D',
  level,
  tab,
  sub: GUEST,
  team: null,
  exp: 9_999_999_999,
  shareCode: 'CODE1',
  token: 'signed',
});

type Who = { grant?: ItemGrant };

function call(db: SqliteD1, method: string, path: string, body?: unknown, who: Who = {}) {
  const owner = who.grant ? GUEST : OWNER;
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      accountUserId: who.grant ? null : owner,
      verifiedUserId: who.grant ? null : owner,
      body,
      ...(who.grant ? { grant: who.grant } : {}),
    }),
  );
}

async function setUp() {
  const r = room();
  const db = sqliteD1({ DOCUMENT_ROOM: r.binding } as unknown as Partial<Env>);
  clearTestProfiles();
  setTestProfile(OWNER, 'Webber', '#123456');
  const created = await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [{ id: 't1', name: 'Board', elements: [box('a'), box('b', 200)] }],
  });
  expect(created.status).toBe(201);
  r.calls.length = 0;
  return { db, room: r };
}

const PATH = '/api/documents/D/tabs/t1/suggestions';
const stored = (db: SqliteD1) =>
  (
    JSON.parse(db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string) as {
      elements: Element[];
    }
  ).elements;
const changesets = (db: SqliteD1) =>
  db.sql.prepare('SELECT summary, token_id FROM agent_changesets').all() as {
    summary: string;
    token_id: string | null;
  }[];

afterEach(() => vi.restoreAllMocks());
const quiet = () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('suggestion routes', () => {
  it('lets a Participant suggest without touching the canvas, and tells the room without content', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const res = await call(
      db,
      'POST',
      PATH,
      { ops: [{ kind: 'update', element: box('a', 50) }] },
      {
        grant: grantOf('participate'),
      },
    );
    expect(res.status).toBe(201);
    const { suggestion } = await res.json<{ suggestion: { author: { key: string } } }>();
    expect(suggestion.author.key).toMatch(/^[0-9a-f]{32}$/);
    expect(stored(db)[0]).toEqual(box('a'));
    expect(r.calls).toEqual([{ path: '/suggestions', body: { kind: 'suggestions', tabId: 't1' } }]);
    const list = await call(db, 'GET', PATH, undefined, { grant: grantOf('participate') });
    expect((await list.json<{ suggestions: unknown[] }>()).suggestions).toHaveLength(1);
  });

  it('refuses a Viewer, and a Participant accepting', async () => {
    quiet();
    const { db } = await setUp();
    const viewer = await call(
      db,
      'POST',
      PATH,
      { ops: [{ kind: 'remove', id: 'a' }] },
      {
        grant: grantOf('view'),
      },
    );
    expect(viewer.status).toBe(403);
    expect((await viewer.json<{ error: string }>()).error).toBe('viewer_cannot_suggest');
    const read = await call(db, 'GET', PATH, undefined, { grant: grantOf('view') });
    expect(read.status).toBe(403);
    await call(
      db,
      'POST',
      PATH,
      { ops: [{ kind: 'remove', id: 'a' }] },
      { grant: grantOf('participate') },
    );
    const accept = await call(
      db,
      'POST',
      `${PATH}/accept`,
      { all: true },
      {
        grant: grantOf('participate'),
      },
    );
    expect(accept.status).toBe(403);
    expect(stored(db)).toHaveLength(2);
  });

  it('reads another tab as missing for a tab-scoped grant', async () => {
    quiet();
    const { db } = await setUp();
    const res = await call(db, 'GET', PATH, undefined, { grant: grantOf('edit', 'other') });
    expect(res.status).toBe(404);
  });

  it('accepts all as one changeset by the Editor, and flags a stale one', async () => {
    quiet();
    const { db } = await setUp();
    const p = { grant: grantOf('participate') };
    await call(db, 'POST', PATH, { ops: [{ kind: 'update', element: box('a', 50) }] }, p);
    await call(db, 'POST', PATH, { ops: [{ kind: 'add', element: box('c', 400), at: 2 }] }, p);
    await call(db, 'POST', PATH, { ops: [{ kind: 'update', element: box('b', 300) }] }, p);
    // b moves under the third suggestion's feet: it is stale.
    const put = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a'), box('b', 250)],
    });
    expect(put.status).toBeLessThan(300);
    const res = await call(db, 'POST', `${PATH}/accept`, { all: true });
    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: string[]; conflicts: { elements: string[] }[] }>();
    expect(body.accepted).toHaveLength(2);
    expect(body.conflicts.map((c) => c.elements)).toEqual([['b']]);
    expect(stored(db).map((e) => [e.id, (e as { x?: number }).x])).toEqual([
      ['a', 50],
      ['b', 250],
      ['c', 400],
    ]);
    expect(changesets(db)).toEqual([{ summary: 'Accepted 2 suggestions', token_id: null }]);
    const left = await call(db, 'GET', PATH);
    const { suggestions } = await left.json<{ suggestions: { conflict?: string[] }[] }>();
    expect(suggestions.map((s) => s.conflict)).toEqual([['b']]);
    const again = await call(db, 'POST', `${PATH}/accept`, { all: true });
    expect(again.status).toBe(409);
    expect(changesets(db)).toHaveLength(1);
  });

  it('rejects without touching the canvas', async () => {
    quiet();
    const { db } = await setUp();
    await call(
      db,
      'POST',
      PATH,
      { ops: [{ kind: 'remove', id: 'a' }] },
      { grant: grantOf('participate') },
    );
    const res = await call(db, 'POST', `${PATH}/reject`, { all: true });
    expect(res.status).toBe(200);
    expect(stored(db)).toHaveLength(2);
    expect(changesets(db)).toHaveLength(0);
  });
});

describe('review route', () => {
  it('is an Editor’s alone, and tells the room', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const p = await call(db, 'GET', '/api/documents/D/review', undefined, {
      grant: grantOf('participate'),
    });
    expect(p.status).toBe(403);
    const put = await call(db, 'PUT', '/api/documents/D/review', {
      links: ['CODE1'],
      people: [],
      agents: false,
    });
    expect(put.status).toBe(200);
    expect(r.calls.map((c) => c.path)).toContain('/review');
    const got = await call(db, 'GET', '/api/documents/D/review');
    expect((await got.json<{ review: { links: string[] } }>()).review.links).toEqual(['CODE1']);
  });
});
