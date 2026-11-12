import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentCommentsResponse } from '@livehuddle/api-schema';
import type { Comment, Element } from '@livehuddle/document';
import { accountsServiceFor } from '../test-accounts-service';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments", blueprint "REST"): the listing across
// the document with refs and labels, and the writes, which answer 410 comments_gone.

let sql: SqliteD1;
let pending: Promise<unknown>[];

const shape = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'signpost',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    label: id.toUpperCase(),
    ...extra,
  }) as unknown as Element;
const comment = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: `text ${id}`,
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#000',
  authorId: 'priya',
  ...extra,
});

function seed(t1: Element[], t2: Element[] = []) {
  sql.sql
    .prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?')
    .run(JSON.stringify({ elements: t1 }), 't1');
  sql.sql
    .prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?')
    .run(JSON.stringify({ elements: t2 }), 't2');
}

type Call = {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string | null;
  code?: string;
  token?: string;
};

function call({
  method = 'POST',
  path,
  body,
  owner = 'guest_00000000-0000-4000-8000-000000000001',
  code,
  token,
}: Call) {
  return handleDocuments(
    makeTestRouteContext(method, `/api/documents/d1${path}`, {
      env: sql.env,
      owner,
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
      ...(token ? { token: { id: token } } : {}),
      ...(body === undefined ? {} : { body }),
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

const stored = async (tabId = 't1') => (await db.getTab(sql.env, 'd1', tabId))!;
const threadOf = async (elementId: string, tabId = 't1') =>
  (
    (await stored(tabId)).elements.find((e) => e.id === elementId) as {
      commentThread?: { resolved: boolean; comments: Comment[] };
    }
  ).commentThread;

beforeEach(() => {
  sql = sqliteD1();
  pending = [];
  sql.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
      VALUES ('d1', 'guest_00000000-0000-4000-8000-000000000001', 'Payments', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Detail', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
  `);
  testShareLink(sql, 'd1', 'VIEW', 'participate');
  testShareLink(sql, 'd1', 'TAB2', 'participate', 't2');
  testShareLink(sql, 'd1', 'LOOK', 'view');
  accountsServiceFor(sql.env).profiles.set('guest_00000000-0000-4000-8000-000000000001', {
    name: 'Webber',
    color: '#3b82f6',
    createdAt: 1,
  });
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// livehuddle has no comments (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and
// notes"): every write answers 410 comments_gone, for every role and an agent alike, and leaves the stored thread as
// it was.
describe('the writes are gone', () => {
  const held = {
    resolved: false,
    comments: [comment('c1', { authorId: 'guest_00000000-0000-4000-8000-000000000001' })],
  };

  it('answers 410 comments_gone to an add, a reply, a delete, a resolve and a reopen, writing nothing', async () => {
    seed([shape('a', { commentThread: held })]);
    const rev = (await stored()).rev;
    const writes: Call[] = [
      { path: '/tabs/t1/comments', body: { elementId: 'a', text: 'hello' } },
      { path: '/tabs/t1/comments', body: { elementId: 'a', text: 'hello' }, token: 'tok_1' },
      {
        path: '/tabs/t1/comments',
        body: { elementId: 'a', text: 'x' },
        owner: 'guest',
        code: 'VIEW',
      },
      { path: '/tabs/t1/comments/c1/reply', body: { text: 'agreed' } },
      { method: 'DELETE', path: '/tabs/t1/comments/c1' },
      { path: '/tabs/t1/comments/c1/resolve' },
      { path: '/tabs/t1/comments/c1/reopen' },
    ];
    for (const w of writes) {
      const res = await call(w);
      expect(res.status).toBe(410);
      expect(await res.json()).toMatchObject({ error: 'comments_gone' });
    }
    expect((await stored()).rev).toBe(rev);
    expect(await threadOf('a')).toEqual(held);
    expect(pending).toEqual([]);
  });

  it('answers 405 to a thread verb that is not a POST, and nothing for a path that is not a comment route', async () => {
    expect((await call({ method: 'GET', path: '/tabs/t1/comments/c1/resolve' })).status).toBe(405);
    expect((await call({ path: '/tabs/t1/comments/c1/shout' })).status).toBe(404);
  });
});

describe('the thread listing', () => {
  beforeEach(() =>
    seed(
      [
        shape('a', {
          commentThread: {
            resolved: false,
            comments: [
              comment('c1', {
                authorId: 'guest_00000000-0000-4000-8000-000000000001',
                tokenId: 'tok_1',
              }),
            ],
          },
        }),
        shape('b', { commentThread: { resolved: true, comments: [comment('c2')] } }),
        shape('c', { commentThread: { resolved: false, comments: [] } }),
      ],
      [shape('d', { commentThread: { resolved: false, comments: [comment('c3')] } })],
    ),
  );

  const list = async (
    query = '',
    owner: string | null = 'guest_00000000-0000-4000-8000-000000000001',
    code?: string,
  ) => {
    const res = await call({
      method: 'GET',
      path: `/comments${query}`,
      owner,
      ...(code ? { code } : {}),
    });
    return {
      status: res.status,
      body: await res.json<DocumentCommentsResponse & { error?: string }>(),
    };
  };

  it('lists open threads across tabs in order, with refs, labels and the caller’s own ids only', async () => {
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.threads.map((t) => [t.tabName, t.elementId, t.label])).toEqual([
      ['Main', 'a', 'A'],
      ['Detail', 'd', 'D'],
    ]);
    expect(body.threads[0]!.ref).toBeTypeOf('string');
    expect(body.threads[0]!.comments[0]).toMatchObject({
      authorId: 'guest_00000000-0000-4000-8000-000000000001',
      tokenId: 'tok_1',
    });
    expect(body.threads[1]!.comments[0]).not.toHaveProperty('authorId');
  });

  it('filters by status and refuses one it does not know', async () => {
    expect((await list('?status=resolved')).body.threads.map((t) => t.elementId)).toEqual(['b']);
    expect((await list('?status=all')).body.threads.map((t) => t.elementId)).toEqual([
      'a',
      'b',
      'd',
    ]);
    expect(await list('?status=closed')).toMatchObject({
      status: 400,
      body: { error: 'invalid_status' },
    });
  });

  it('leaves out a tab whose body does not parse, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    sql.sql.exec(
      `UPDATE tabs SET data = '{"commentThread": broken', rev = rev + 1 WHERE id = 't2'`,
    );
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.threads.map((t) => t.elementId)).toEqual(['a']);
    expect(warn.mock.calls[0]![0]).toBe('[comments] list skipped tab');
    expect(console.info).toHaveBeenCalledWith('[comments] listed', {
      documentId: 'd1',
      status: 'open',
      tabsRead: 1,
      threads: 1,
    });
  });

  it('logs each refusal once, with its route and code', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await list('?status=closed');
    await call({ path: '/tabs/t1/comments/nope/resolve', token: 'tok_1' });
    expect(
      warn.mock.calls.filter((c) => c[0] === '[comments] refused').map((c): unknown => c[1]),
    ).toEqual([
      {
        documentId: 'd1',
        tabId: null,
        route: 'list',
        agent: false,
        status: 400,
        code: 'invalid_status',
      },
      {
        documentId: 'd1',
        tabId: 't1',
        route: 'resolve',
        agent: true,
        status: 410,
        code: 'comments_gone',
      },
    ]);
  });

  it('keeps a tab-scoped link to its tab, hides others’ ids from a visitor, and refuses a stranger', async () => {
    expect((await list('', 'guest', 'TAB2')).body.threads.map((t) => t.elementId)).toEqual(['d']);
    const visitor = (await list('', 'guest', 'VIEW')).body.threads[0]!.comments[0]!;
    expect(visitor).not.toHaveProperty('authorId');
    expect(visitor).not.toHaveProperty('tokenId');
    expect((await list('', 'stranger')).status).toBe(403);
    expect((await call({ method: 'POST', path: '/comments' })).status).toBe(405);
  });

  it('answers a tab-scoped link whose tab has no comments with an empty list, not a refusal', async () => {
    seed(
      [shape('a', { commentThread: { resolved: false, comments: [comment('c1')] } })],
      [shape('d')],
    );
    const res = await list('?status=all', 'guest', 'TAB2');
    expect(res.status).toBe(200);
    expect(res.body.threads).toEqual([]);
  });
});
