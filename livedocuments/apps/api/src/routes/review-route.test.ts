import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import type { ItemGrant } from '@liveworkspace/index-app';
import type { PagesAnswer, ReviewResponse } from '@livedocuments/api-schema';
import {
  articleSuggestionList,
  articlesOf,
  rejectedArticleFlow,
  type ArticleFlow,
} from '@livedocuments/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// Suggestions on the api (docs/specs/007-editor/suggestions.md "Suggest Only", "The server is the rule";
// docs/specs/024-agents/pages-for-agents.md "Suggestions"): the review settings an Editor alone sets, an assistant's
// article write as suggestions, and an agent's read of the rejected view.

function roomRecorder() {
  const posted: string[] = [];
  const ops: { op: { kind: string; [k: string]: unknown } }[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        if (path === '/holds') return Response.json({ holds: [] });
        posted.push(path);
        if (init?.body) ops.push(sentJson(init) as (typeof ops)[number]);
        return new Response(null, { status: 204 });
      },
    }),
  };
  return { posted, ops, binding };
}

const ARTICLE: ArticleFlow = {
  blocks: [
    { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Plan' }] },
    { id: 'b2', type: 'paragraph', runs: [{ text: 'The quick fox.' }] },
  ],
};

async function setUp() {
  const room = roomRecorder();
  const db = sqliteD1({ DOCUMENT_ROOM: room.binding } as unknown as Partial<Env>);
  await handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      owner: 'user_o',
      accountUserId: 'user_o',
      verifiedUserId: 'user_o',
      body: {
        id: 'D',
        name: 'Doc',
        tabs: [
          {
            id: 't1',
            name: 'Brief',
            elements: [],
            pages: [{ id: 'p1', orientation: 'portrait', kind: 'article', flow: 'f1' }],
            articles: { f1: ARTICLE },
          },
        ],
      },
    }),
  );
  room.posted.length = 0;
  room.ops.length = 0;
  return { db, room };
}

const visitor = (level: ItemGrant['level'], tab: string | null = null): ItemGrant => ({
  item: 'D',
  level,
  tab,
  sub: 'guest_00000000-0000-4000-8000-000000000009',
  team: null,
  exp: 9_999_999_999,
  shareCode: 'CODE1',
  token: 'signed',
});

const review = (
  db: SqliteD1,
  method: 'GET' | 'PUT',
  { body, grant, token }: { body?: unknown; grant?: ItemGrant; token?: boolean } = {},
) =>
  handleDocuments(
    makeTestRouteContext(method, '/api/documents/D/review', {
      env: db.env,
      owner: grant ? 'visitor' : 'user_o',
      accountUserId: grant || token ? null : 'user_o',
      verifiedUserId: grant ? null : 'user_o',
      body,
      ...(grant ? { grant } : {}),
      token: token ? { id: 'tok_1' } : null,
    }),
  );

const write = (db: SqliteD1, article: Record<string, unknown>) =>
  handleDocuments(
    makeTestRouteContext('POST', '/api/documents/D/tabs/t1/pages', {
      env: db.env,
      owner: 'user_o',
      accountUserId: null,
      verifiedUserId: 'user_o',
      body: { article },
      token: { id: 'tok_1' },
    }),
  );

const storedFlow = (db: SqliteD1): ArticleFlow => {
  const row = db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get() as { data: string };
  return articlesOf(JSON.parse(row.data) as object).f1!;
};

afterEach(() => vi.restoreAllMocks());

describe('the review settings', () => {
  it('an Editor reads and sets them, the people seen and the pins kept but for those lifted, and the room is told', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const empty = await review(db, 'GET');
    expect(empty.status).toBe(200);
    expect(await empty.json<ReviewResponse>()).toEqual({
      review: { links: [], people: [], agents: false, seen: [], pins: [] },
    });
    db.sql.prepare('UPDATE document SET review = ?').run(
      JSON.stringify({
        links: ['CODE1', 'CODE2'],
        seen: [{ key: 'k1', name: 'Sam', at: 3 }],
        pins: [
          { key: 'k1', code: 'CODE1', at: 3 },
          { key: 'k2', code: 'CODE2', at: 3 },
          { key: 'k3', code: 'CODE1', at: 3 },
        ],
      }),
    );
    const set = await review(db, 'PUT', {
      // CODE2 leaves Suggest Only (its pin goes with it) and k3 is lifted; k1's pin stays.
      body: {
        links: ['CODE1', 'CODE1'],
        people: [{ key: 'k1', name: 'Sam' }],
        agents: true,
        lift: ['k3'],
      },
    });
    expect(set.status).toBe(200);
    const answer = await set.json<ReviewResponse>();
    expect(answer.review).toEqual({
      links: ['CODE1'],
      people: [{ key: 'k1', name: 'Sam' }],
      agents: true,
      seen: [{ key: 'k1', name: 'Sam', at: 3 }],
      pins: [{ key: 'k1', code: 'CODE1', at: 3 }],
    });
    expect(room.posted).toEqual(['/review']);
    expect((await (await review(db, 'GET')).json<ReviewResponse>()).review).toEqual(answer.review);
  });

  it('refuses a Participant, a Viewer, a tab-scoped Editor and a body that is no object', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    for (const level of ['participate', 'view'] as const) {
      expect((await review(db, 'GET', { grant: visitor(level) })).status).toBe(403);
      expect((await review(db, 'PUT', { body: {}, grant: visitor(level) })).status).toBe(403);
    }
    expect((await review(db, 'GET', { grant: visitor('edit', 't1') })).status).toBe(403);
    expect((await review(db, 'PUT', { body: 'yes' })).status).toBe(400);
    const readOnly = await handleDocuments(
      makeTestRouteContext('PUT', '/api/documents/D/review', {
        env: db.env,
        owner: 'user_o',
        verifiedUserId: 'user_o',
        body: { agents: true },
        token: { id: 'tok_1', readOnly: true },
      }),
    );
    expect(readOnly.status).toBe(403);
    const missing = await handleDocuments(
      makeTestRouteContext('GET', '/api/documents/Z/review', {
        env: db.env,
        owner: 'user_o',
        accountUserId: 'user_o',
      }),
    );
    expect(missing.status).toBe(404);
    expect(room.posted).toEqual([]);
  });

  it('keeps the settings when the room cannot be told', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db } = await setUp();
    const fetch = vi.fn(async () => {
      throw new Error('down');
    });
    (db.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
      idFromName: (n: string) => n,
      get: () => ({ fetch }),
    };
    const set = await review(db, 'PUT', { body: { agents: true } });
    expect(set.status).toBe(200);
    expect(warn).toHaveBeenCalledWith('[review] relay-failed', expect.anything());
  });
});

describe('an assistant’s article write as suggestions', () => {
  it('suggests the changes when asked, authored by the assistant and marked Generated by AI', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const res = await write(db, {
      markdown: '---\ntitle: Plan\n---\n\nThe slow fox.',
      as: 'suggestions',
    });
    expect(res.status).toBe(200);
    const body = await res.json<PagesAnswer>();
    expect(body.lines[0]).toBe(
      'Suggested 2 edits to the article "Plan": they wait for review in the editor.',
    );
    const flow = storedFlow(db);
    const made = articleSuggestionList(flow);
    expect(made.map((e) => [e.suggestion.k, e.text])).toEqual([
      ['del', 'quick'],
      ['ins', 'slow'],
    ]);
    for (const e of made) {
      expect(e.suggestion).toMatchObject({ by: 'agent:tok_1', ai: true });
      expect(e.suggestion.g).toMatch(/^cs-/);
    }
    expect(rejectedArticleFlow(flow).blocks).toEqual(ARTICLE.blocks);
    const frame = room.ops.find((o) => o.op.kind === 'article')!.op;
    expect(frame.suggested).toEqual({ n: expect.any(String), count: 2, g: made[0]!.suggestion.g });
  });

  it('suggests while Assistants Suggest is on, whatever the write asks', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    db.sql.prepare('UPDATE document SET review = ?').run(JSON.stringify({ agents: true }));
    const res = await write(db, { markdown: '---\ntitle: Plan\n---\n\nA new fox.', as: 'direct' });
    expect(res.status).toBe(200);
    expect(articleSuggestionList(storedFlow(db)).length).toBeGreaterThan(0);
  });

  it('writes straight in otherwise, and a new article as it is', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    await write(db, { markdown: '---\ntitle: Plan\n---\n\nA new fox.' });
    expect(articleSuggestionList(storedFlow(db))).toEqual([]);
    const fresh = await write(db, { markdown: '# Other', new: true, as: 'suggestions' });
    expect(fresh.status).toBe(200);
    expect((await fresh.json<PagesAnswer>()).lines[0]).toMatch(/^Started the article/);
  });

  it('shows an agent the rejected view on a tab read; the owner’s editor gets the suggestions', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    await write(db, { markdown: '---\ntitle: Plan\n---\n\nThe slow fox.', as: 'suggestions' });
    const read = (token: boolean) =>
      handleDocuments(
        makeTestRouteContext('GET', '/api/documents/D/tabs/t1', {
          env: db.env,
          owner: 'user_o',
          accountUserId: token ? null : 'user_o',
          verifiedUserId: 'user_o',
          token: token ? { id: 'tok_1' } : null,
        }),
      );
    const agent = await (await read(true)).json<{ tab: object }>();
    expect(articleSuggestionList(articlesOf(agent.tab).f1!)).toEqual([]);
    expect(articlesOf(agent.tab).f1!.blocks).toEqual(ARTICLE.blocks);
    const owner = await (await read(false)).json<{ tab: object }>();
    expect(articleSuggestionList(articlesOf(owner.tab).f1!)).toHaveLength(2);
  });
});
