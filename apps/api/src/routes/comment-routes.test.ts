import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentCommentsResponse } from '@livediagram/api-schema';
import type { Comment, Element } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments", blueprint "REST"): add, delete-own,
// reply, resolve and reopen through the tab's revision, relayed without author or token ids; the listing across
// the document with refs and labels.

let sql: SqliteD1;
let pending: Promise<unknown>[];

const shape = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
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

function call({ method = 'POST', path, body, owner = 'owner', code, token }: Call) {
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
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1, 1);
    INSERT INTO participants (id, name, color, created_at) VALUES ('owner', 'Webber', '#3b82f6', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Detail', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
    INSERT INTO share_links (code, document_id, role, level, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO share_links (code, document_id, role, level, tab_id, created_at) VALUES ('TAB2', 'd1', 'view', 'participate', 't2', 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('LOOK', 'd1', 'view', NULL, 1);
  `);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('add', () => {
  it('stamps the author and, for an agent, the token, and bumps the revision', async () => {
    seed([shape('a')]);
    const before = (await stored()).rev;
    const res = await call({
      path: '/tabs/t1/comments',
      body: { elementId: 'a', text: '  hello  ' },
      token: 'tok_1',
    });
    expect(res.status).toBe(201);
    const { comment: posted } = (await res.json()) as { comment: Comment };
    expect(posted).toMatchObject({
      text: 'hello',
      authorName: 'Webber',
      authorColor: '#3b82f6',
      authorId: 'owner',
      tokenId: 'tok_1',
    });
    expect((await stored()).rev).toBe(before + 1);
    expect((await threadOf('a'))!.comments[0]).toMatchObject({ id: posted.id, tokenId: 'tok_1' });
  });

  it('refuses a missing element, an arrow, empty or long text, and a body that is not an object', async () => {
    seed([shape('a'), { id: 'ar', type: 'arrow' } as unknown as Element]);
    expect(
      (await call({ path: '/tabs/t1/comments', body: { elementId: 'zz', text: 'x' } })).status,
    ).toBe(404);
    expect(
      (await call({ path: '/tabs/t1/comments', body: { elementId: 'ar', text: 'x' } })).status,
    ).toBe(404);
    expect(
      (await call({ path: '/tabs/t1/comments', body: { elementId: 'a', text: '  ' } })).status,
    ).toBe(400);
    expect(
      (await call({ path: '/tabs/t1/comments', body: { elementId: 'a', text: 'x'.repeat(2001) } }))
        .status,
    ).toBe(400);
    expect((await call({ path: '/tabs/t1/comments', body: { text: 'x' } })).status).toBe(400);
    expect((await call({ path: '/tabs/t1/comments', body: [1] })).status).toBe(400);
    expect(
      (await call({ path: '/tabs/t9/comments', body: { elementId: 'a', text: 'x' } })).status,
    ).toBe(404);
  });

  // docs/specs/013-workspace/share-roles.md: commenting is a Participant's; a Viewer only looks.
  it('lets a Participant link comment, refuses a view link, and keeps a tab-scoped link to its tab', async () => {
    seed([shape('a')], [shape('b')]);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', text: 'x' },
          owner: 'looker',
          code: 'LOOK',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', text: 'x' },
          owner: 'guest',
          code: 'VIEW',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', text: 'x' },
          owner: 'guest',
          code: 'TAB2',
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', text: 'x' },
          owner: 'stranger',
        })
      ).status,
    ).toBe(403);
  });
});

describe('reply, resolve and reopen', () => {
  it('replies on the thread holding a comment, and reopens a resolved one by replying', async () => {
    seed([shape('a', { commentThread: { resolved: true, comments: [comment('c1')] } })]);
    const res = await call({ path: '/tabs/t1/comments/c1/reply', body: { text: 'agreed' } });
    expect(res.status).toBe(201);
    const thread = await threadOf('a');
    expect(thread!.comments.map((c) => c.text)).toEqual(['text c1', 'agreed']);
    expect(thread!.resolved).toBe(false);
    expect((await call({ path: '/tabs/t1/comments/nope/reply', body: { text: 'x' } })).status).toBe(
      404,
    );
    expect((await call({ path: '/tabs/t1/comments/c1/reply', body: { text: '' } })).status).toBe(
      400,
    );
    expect((await call({ path: '/tabs/t1/comments/c1/reply', body: 'x' })).status).toBe(400);
  });

  it('resolves and reopens, writing nothing when the thread is already so', async () => {
    seed([shape('a', { commentThread: { resolved: false, comments: [comment('c1')] } })]);
    expect((await call({ path: '/tabs/t1/comments/c1/resolve' })).status).toBe(204);
    expect((await threadOf('a'))!.resolved).toBe(true);
    const rev = (await stored()).rev;
    expect((await call({ path: '/tabs/t1/comments/c1/resolve' })).status).toBe(204);
    expect((await stored()).rev).toBe(rev);
    expect((await call({ path: '/tabs/t1/comments/c1/reopen' })).status).toBe(204);
    expect((await threadOf('a'))!.resolved).toBe(false);
    expect((await call({ path: '/tabs/t1/comments/nope/resolve' })).status).toBe(404);
    expect((await call({ method: 'GET', path: '/tabs/t1/comments/c1/resolve' })).status).toBe(405);
  });
});

describe('delete-own', () => {
  it('deletes the caller’s own comment only', async () => {
    seed([
      shape('a', {
        commentThread: {
          resolved: false,
          comments: [comment('c1', { authorId: 'owner' }), comment('c2')],
        },
      }),
    ]);
    expect((await call({ method: 'DELETE', path: '/tabs/t1/comments/c2' })).status).toBe(403);
    expect((await call({ method: 'DELETE', path: '/tabs/t1/comments/c1' })).status).toBe(204);
    expect((await threadOf('a'))!.comments.map((c) => c.id)).toEqual(['c2']);
    expect((await call({ method: 'DELETE', path: '/tabs/t1/comments/c1' })).status).toBe(404);
  });

  it('takes the comment’s words off the Timeline, with its thread’s resolved snippet', async () => {
    seed([
      shape('a', {
        commentThread: { resolved: false, comments: [comment('c1', { authorId: 'owner' })] },
      }),
    ]);
    // Posted and resolved: two events carrying c1's text.
    const posted = await call({ path: '/tabs/t1/comments/c1/reply', body: { text: 'reply' } });
    expect(posted.status).toBe(201);
    const reply = ((await posted.json()) as { comment: Comment }).comment.id;
    const insert = sql.sql.prepare(
      `INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, title,
         description, occurred_at, snapshot, created_at)
       VALUES (?, 'owner', 'document', ?, ?, 't', 'text c1', 1, ?, 1)`,
    );
    insert.run('e-c1', 'c1', 'comment_added', JSON.stringify({ documentId: 'd1' }));
    insert.run('e-res', 'd1:a', 'comment_resolved', JSON.stringify({ documentId: 'd1' }));
    // Another document's event under the same comment id is never reached.
    insert.run('e-other', 'c1', 'comment_resolved', JSON.stringify({ documentId: 'd2' }));
    await Promise.allSettled(pending);
    const events = () =>
      (sql.sql.prepare('SELECT id FROM timeline_events ORDER BY id').all() as { id: string }[]).map(
        (r) => r.id,
      );
    expect(events()).toHaveLength(4);

    // The reply is not the thread's opening comment: only its own event goes.
    expect((await call({ method: 'DELETE', path: `/tabs/t1/comments/${reply}` })).status).toBe(204);
    await Promise.allSettled(pending);
    expect(events()).toEqual(['e-c1', 'e-other', 'e-res']);

    expect((await call({ method: 'DELETE', path: '/tabs/t1/comments/c1' })).status).toBe(204);
    await Promise.allSettled(pending);
    expect(events()).toEqual(['e-other']);
  });
});

// docs/specs/013-workspace/timeline.md §4.3: a tab deleted whole takes every comment's words with it,
// from the document it left only; a document still holding the tab keeps its own events.
describe('deleting the tab', () => {
  it('retracts its comments from the document it left, and the last one to hold it', async () => {
    seed([
      shape('a', { commentThread: { resolved: true, comments: [comment('c1'), comment('c2')] } }),
    ]);
    sql.sql.exec(`
      INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
        VALUES ('d2', 'owner', 'Linked', 1, 1, 1);
      INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d2', 't1', 0, 1);
    `);
    const insert = sql.sql.prepare(
      `INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, title,
         description, occurred_at, snapshot, created_at)
       VALUES (?, 'owner', 'document', ?, ?, 't', 'text', 1, ?, 1)`,
    );
    const on = (doc: string) => JSON.stringify({ documentId: doc });
    // A comment's event is pinned to the document whose save recorded it: c1 through d1, c2 through d2.
    insert.run('d1-c1', 'c1', 'comment_added', on('d1'));
    insert.run('d1-res', 'd1:a', 'comment_resolved', on('d1'));
    insert.run('d1-t2', 'c9', 'comment_added', on('d1'));
    insert.run('d2-c2', 'c2', 'comment_added', on('d2'));
    insert.run('d2-res', 'd2:a', 'comment_resolved', on('d2'));
    const events = () =>
      (sql.sql.prepare('SELECT id FROM timeline_events ORDER BY id').all() as { id: string }[]).map(
        (r) => r.id,
      );

    // Unlinked from d1: d1's events for it go; the other tab's, and d2's, stay.
    expect((await call({ method: 'DELETE', path: '/tabs/t1' })).status).toBe(204);
    await Promise.all(pending);
    expect(events()).toEqual(['d1-t2', 'd2-c2', 'd2-res']);

    // d2 was the last to hold it: the tab row goes, and d2's events with it.
    const res = await handleDocuments(
      makeTestRouteContext('DELETE', '/api/documents/d2/tabs/t1', {
        env: sql.env,
        owner: 'owner',
        waitUntil: (p) => void pending.push(p),
      }),
    );
    expect(res.status).toBe(204);
    await Promise.all(pending);
    expect(events()).toEqual(['d1-t2']);
    expect(sql.sql.prepare("SELECT id FROM tabs WHERE id = 't1'").get()).toBeUndefined();
  });
});

describe('a lost race', () => {
  it('re-reads and repeats once, then answers 409 tab_busy', async () => {
    seed([shape('a')]);
    const write = vi.spyOn(db, 'upsertTabAtRev');
    const stale = Object.assign(new Error('tab_rev_stale'), { code: 'tab_rev_stale' });
    write.mockRejectedValueOnce(stale);
    expect(
      (await call({ path: '/tabs/t1/comments', body: { elementId: 'a', text: 'x' } })).status,
    ).toBe(201);
    write.mockRejectedValueOnce(stale).mockRejectedValueOnce(stale);
    const busy = await call({ path: '/tabs/t1/comments', body: { elementId: 'a', text: 'x' } });
    expect(busy.status).toBe(409);
    expect(await busy.json()).toMatchObject({ error: 'tab_busy' });
  });
});

describe('the thread listing', () => {
  beforeEach(() =>
    seed(
      [
        shape('a', {
          commentThread: {
            resolved: false,
            comments: [comment('c1', { authorId: 'owner', tokenId: 'tok_1' })],
          },
        }),
        shape('b', { commentThread: { resolved: true, comments: [comment('c2')] } }),
        shape('c', { commentThread: { resolved: false, comments: [] } }),
      ],
      [shape('d', { commentThread: { resolved: false, comments: [comment('c3')] } })],
    ),
  );

  const list = async (query = '', owner: string | null = 'owner', code?: string) => {
    const res = await call({
      method: 'GET',
      path: `/comments${query}`,
      owner,
      ...(code ? { code } : {}),
    });
    return {
      status: res.status,
      body: (await res.json()) as DocumentCommentsResponse & { error?: string },
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
    expect(body.threads[0]!.comments[0]).toMatchObject({ authorId: 'owner', tokenId: 'tok_1' });
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
    expect(warn.mock.calls.filter((c) => c[0] === '[comments] refused').map((c) => c[1])).toEqual([
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
        status: 404,
        code: 'not_found',
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
});
