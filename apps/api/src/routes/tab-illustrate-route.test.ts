import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IllustrateAnswer } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { illustrateRoomOps } from '../changesets/illustrate';
import { layoutCatalogueFor } from '@livediagram/templates';

// POST /api/documents/:id/tabs/:tabId/illustrate (docs/specs/024-agents/illustrate-for-agents.md
// "The route"): page changes or an article write, at the tab's revision, relayed to the room as an
// editor's own edit.

function roomRecorder(status = 204) {
  const bodies: { op: { kind: string; [k: string]: unknown } }[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (_url: string, init?: RequestInit) => {
        if (init?.body) bodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status });
      },
    }),
  };
  return { bodies, binding };
}

const call = (
  db: SqliteD1,
  body: unknown,
  { owner = 'user_o', token = true, path = '/api/documents/D/tabs/t1/illustrate' } = {},
) =>
  handleDocuments(
    makeTestRouteContext('POST', path, {
      env: db.env,
      owner,
      clerkUserId: token ? null : owner,
      verifiedUserId: owner,
      body,
      token: token ? { id: 'tok_1' } : null,
    }),
  );

async function setUp(status = 204, tab: Record<string, unknown> = {}) {
  const room = roomRecorder(status);
  const db = sqliteD1({ DOCUMENT_ROOM: room.binding } as unknown as Partial<Env>);
  await handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      owner: 'user_o',
      clerkUserId: 'user_o',
      verifiedUserId: 'user_o',
      body: { id: 'D', name: 'Doc', tabs: [{ id: 't1', name: 'Board', elements: [], ...tab }] },
    }),
  );
  room.bodies.length = 0;
  return { db, room };
}

const stored = (db: SqliteD1) => {
  const row = db.sql.prepare("SELECT data, rev FROM tabs WHERE id = 't1'").get() as {
    data: string;
    rev: number;
  };
  return { ...JSON.parse(row.data), rev: row.rev };
};

afterEach(() => vi.restoreAllMocks());

describe('page changes', () => {
  it('switches the tab into Illustrate, writes the pages at the next revision and relays them', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const res = await call(db, {
      pages: [
        { op: 'add', kind: 'slide' },
        { op: 'add', kind: 'slide', name: 'Two' },
      ],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as IllustrateAnswer;
    expect(body.switched).toBe(true);
    expect(body.lines[0]).toBe('Switched the tab to Illustrate.');
    expect(body.pages.map((p) => [p.place, p.kind, p.name])).toEqual([
      [1, 'slide', null],
      [2, 'slide', 'Two'],
    ]);
    expect(body.changesetId).toBeNull();
    const tab = stored(db);
    expect(tab.opensIn).toBe('illustrate');
    expect(tab.pages).toHaveLength(2);
    expect(body.tab.rev).toBe(tab.rev);
    expect(room.bodies.map((b) => b.op.kind)).toEqual(['tab-meta']);
    expect(room.bodies[0]!.op).toMatchObject({ tabId: 't1', patch: { opensIn: 'illustrate' } });
    expect(info).toHaveBeenCalledWith(
      '[illustrate-agent] applied',
      expect.objectContaining({ kind: 'pages', changes: 2 }),
    );
  });

  it('lands a layout’s elements as a changeset, relayed before the pages', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const layout = layoutCatalogueFor('slide').layouts[0]!.id;
    const res = await call(db, { pages: [{ op: 'add', kind: 'slide', layout }] });
    const body = (await res.json()) as IllustrateAnswer;
    expect(body.changesetId).toMatch(/^cs_/);
    expect(body.pages[0]!.elements).toBeGreaterThan(0);
    expect(room.bodies.map((b) => b.op.kind)).toEqual(['changeset', 'tab-meta']);
    expect(stored(db).elements.length).toBe(body.pages[0]!.elements);
  });

  it('refuses a malformed body and an engine refusal with 400 and the code', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    const bad = await call(db, { pages: [{ op: 'fly' }] });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'invalid_value', change: 0 });
    const res = await call(db, { pages: [{ op: 'delete', page: 4 }] });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'page_unknown', change: 0 });
    expect(stored(db).opensIn).toBeUndefined();
  });

  it('is gated like any write (a read-only token is refused in index.ts): a stranger is refused, a missing tab is 404', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    expect(
      (await call(db, { pages: [{ op: 'add', kind: 'logo' }] }, { owner: 'user_x' })).status,
    ).toBe(403);
    expect(
      (
        await call(
          db,
          { pages: [{ op: 'add', kind: 'logo' }] },
          { path: '/api/documents/D/tabs/nope/illustrate' },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call(
          db,
          { pages: [{ op: 'add', kind: 'logo' }] },
          { path: '/api/documents/Z/tabs/t1/illustrate' },
        )
      ).status,
    ).toBe(404);
  });

  it('keeps the write when the room cannot be reached, logging it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db } = await setUp(500);
    const res = await call(db, { pages: [{ op: 'add', kind: 'logo' }] });
    expect(res.status).toBe(200);
    expect(stored(db).pages).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      '[illustrate-agent] relay-missed',
      expect.objectContaining({ op: 'tab-meta' }),
    );
  });
});

describe('an article write', () => {
  it('starts an article and relays its writing as agent-marked frames', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const res = await call(db, { article: { markdown: '---\ntitle: Brief\n---\n# Goals\n- One' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as IllustrateAnswer;
    expect(body.article).toMatchObject({ title: 'Brief', pages: [1], blocks: 3, created: true });
    const tab = stored(db);
    expect(Object.values(tab.articles)).toHaveLength(1);
    const kinds = room.bodies.map((b) => b.op.kind);
    expect(kinds).toEqual(['tab-meta', 'article']);
    expect(room.bodies[1]!.op).toMatchObject({ created: true, agent: true });
  });

  it('refuses an ambiguous write with 400', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp(204, {
      opensIn: 'illustrate',
      pages: [
        { id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' },
        { id: 'b', orientation: 'portrait', kind: 'article', flow: 'g' },
      ],
      articles: { f: { blocks: [] }, g: { blocks: [] } },
    });
    const res = await call(db, { article: { markdown: 'x' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'article_ambiguous' });
  });
});

describe('the room ops', () => {
  it('patches what changed and clears what went', () => {
    const before = {
      id: 't',
      name: 'T',
      elements: [],
      opensIn: 'illustrate' as const,
      pageOrientation: 'portrait' as const,
    };
    const after = { id: 't', name: 'T', elements: [], opensIn: 'illustrate' as const, pages: [] };
    expect(illustrateRoomOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't', patch: { pages: [] }, clear: ['pageOrientation'] },
    ]);
    expect(illustrateRoomOps(after, after)).toEqual([]);
  });
});
