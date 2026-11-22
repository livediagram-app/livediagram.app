import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import type { PagesAnswer } from '@liveknowledge/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { pagesRoomOps } from '../changesets/pages';

// POST /api/documents/:id/tabs/:tabId/pages (docs/specs/024-agents/pages-for-agents.md
// "The route"): page changes or an article write, at the tab's revision, relayed to the room as an
// editor's own edit.

function roomRecorder(status = 204) {
  type Relayed = { op: { kind: string; [k: string]: unknown } };
  const bodies: Relayed[] = [];
  // The paragraph holds the room answers (docs/specs/024-agents/pages-for-agents.md "Held paragraphs"), and the
  // tabs it was asked about.
  const holds: unknown[] = [];
  const holdReads: string[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string, init?: RequestInit) => {
        if (String(url).includes('/holds?')) {
          holdReads.push(new URL(String(url)).searchParams.get('tab') ?? '');
          return status === 204 ? Response.json({ holds }) : new Response(null, { status });
        }
        if (init?.body) bodies.push(sentJson(init) as Relayed);
        return new Response(null, { status });
      },
    }),
  };
  return { bodies, binding, holds, holdReads };
}

const call = (
  db: SqliteD1,
  body: unknown,
  { owner = 'user_o', token = true, path = '/api/documents/D/tabs/t1/pages' } = {},
) =>
  handleDocuments(
    makeTestRouteContext('POST', path, {
      env: db.env,
      owner,
      accountUserId: token ? null : owner,
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
      accountUserId: 'user_o',
      verifiedUserId: 'user_o',
      body: { id: 'D', name: 'Doc', tabs: [{ id: 't1', name: 'Board', elements: [], ...tab }] },
    }),
  );
  room.bodies.length = 0;
  return { db, room };
}

// The stored tab, as far as these tests read it.
type StoredTab = {
  elements: unknown[];
  pages?: unknown[];
  articles: Record<string, unknown>;
};

const stored = (db: SqliteD1) => {
  const row = db.sql.prepare("SELECT data, rev FROM tabs WHERE id = 't1'").get() as {
    data: string;
    rev: number;
  };
  return { ...(JSON.parse(row.data) as StoredTab), rev: row.rev };
};

afterEach(() => vi.restoreAllMocks());

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page": a page is one article on one
// page, so no page is added, laid out, moved, copied or deleted.
describe('page changes', () => {
  it('are refused whole, writing and relaying nothing', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const before = stored(db);
    for (const pages of [
      [{ op: 'add', kind: 'slide' }],
      [{ op: 'add', kind: 'infographic' }],
      [{ op: 'delete', page: 1 }],
      [{ op: 'set', page: 1, size: 'letter' }],
    ]) {
      const res = await call(db, { pages });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'kind_not_offered' });
    }
    expect(stored(db)).toEqual(before);
    expect(room.bodies).toHaveLength(0);
  });
});

describe('the route', () => {
  const write = { article: { markdown: 'x' } };

  it('is gated like any write (a read-only token is refused in index.ts): a stranger is refused, a missing tab is 404', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    expect((await call(db, write, { owner: 'user_x' })).status).toBe(403);
    expect((await call(db, write, { path: '/api/documents/D/tabs/nope/pages' })).status).toBe(404);
    expect((await call(db, write, { path: '/api/documents/Z/tabs/t1/pages' })).status).toBe(404);
  });

  it('keeps the write when the room cannot be reached, logging it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db } = await setUp(500);
    const res = await call(db, write);
    expect(res.status).toBe(200);
    expect(stored(db).pages).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      '[pages-agent] relay-missed',
      expect.objectContaining({ op: 'article' }),
    );
  });
});

describe('an article write', () => {
  // A tab of no page kind reads as an empty article page (describe-to-set-up.md "The start screen"): the write fills
  // that page's article.
  it("writes the page's article and relays its writing", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const res = await call(db, { article: { markdown: '---\ntitle: Brief\n---\n# Goals\n- One' } });
    expect(res.status).toBe(200);
    const body = await res.json<PagesAnswer>();
    expect(body.article).toMatchObject({ title: 'Brief', pages: [1], blocks: 3, created: false });
    // The answer says how many pages the writing takes, as estimated.
    expect(body.lines.at(-1)).toMatch(/^It takes about 1 page once laid out \(estimated/);
    const tab = stored(db);
    expect(Object.values(tab.articles)).toHaveLength(1);
    const kinds = room.bodies.map((b) => b.op.kind);
    // The page as now stored, its writing, and the tree: the Title named the page (knowledgebases-and-pages.md
    // "Name").
    expect(kinds).toEqual(['tab-meta', 'article', 'document-meta']);
    expect(
      (db.sql.prepare("SELECT name FROM tabs WHERE id = 't1'").get() as { name: string }).name,
    ).toBe('Brief');
  });

  it('refuses an ambiguous write with 400', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp(204, {
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

describe('held paragraphs', () => {
  const tab = {
    pages: [{ id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' }],
    articles: {
      f: {
        blocks: [
          { id: 'b1', type: 'heading', level: 1, runs: [{ text: 'Brief' }] },
          { id: 'b2', type: 'paragraph', runs: [{ text: 'Sam is writing this one' }] },
        ],
      },
    },
  };
  const samHolds = { flow: 'f', blockId: 'b2', name: 'Sam Lee', color: '#f00' };

  it('refuses an agent write over a held paragraph whole, saying who and where, and writes nothing', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp(204, tab);
    room.holds.push(samHolds);
    const before = stored(db);
    const res = await call(db, { article: { article: 'f', markdown: '# Brief\n\nRewritten' } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'paragraphs_held',
      message:
        'Sam Lee is writing in "Sam is writing this one". Try again once they pause, or leave that paragraph as it is.',
      held: [{ flow: 'f', blockId: 'b2', by: { name: 'Sam Lee', color: '#f00' } }],
    });
    expect(room.holdReads).toEqual(['t1']);
    expect(stored(db).rev).toBe(before.rev);
    expect(room.bodies).toHaveLength(0);
    expect(info).toHaveBeenCalledWith('[pages-agent] held', {
      documentId: 'D',
      tabId: 't1',
      held: 1,
    });
  });

  it('lets a write that leaves every held paragraph as it is go ahead', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp(204, tab);
    room.holds.push(samHolds);
    const res = await call(db, {
      article: { article: 'f', markdown: 'An added line', mode: 'append' },
    });
    expect(res.status).toBe(200);
  });

  it("never holds a person's own write, and asks the room nothing for it", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp(204, tab);
    room.holds.push(samHolds);
    const res = await call(db, { article: { article: 'f', markdown: 'Mine' } }, { token: false });
    expect(res.status).toBe(200);
    expect(room.holdReads).toEqual([]);
  });

  it('writes when the room cannot say who holds what, logging it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db } = await setUp(500, tab);
    const res = await call(db, { article: { article: 'f', markdown: 'Over' } });
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      '[pages-agent] holds-unreachable',
      expect.objectContaining({ documentId: 'D', tabId: 't1' }),
    );
  });
});

describe('the room ops', () => {
  it('patches what changed and clears what went', () => {
    const before = {
      id: 't',
      name: 'T',
      elements: [],
      pageOrientation: 'portrait' as const,
    };
    const after = { id: 't', name: 'T', elements: [], pages: [] };
    expect(pagesRoomOps(before, after)).toEqual([
      {
        kind: 'tab-meta',
        tabId: 't',
        patch: { pages: [] },
        clear: ['pageOrientation'],
        // The pages' steps, so an open editor keeps a page it added meanwhile (collab-race-hardening.md "Pages").
        pageSteps: [{ kind: 'remove', id: 'page-1' }],
      },
    ]);
    expect(pagesRoomOps(after, after)).toEqual([]);
  });
});
