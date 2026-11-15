import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ProjectCommentsResponse } from '@liveplanner/api-schema';
import type { Comment, Element } from '@liveplanner/project';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments", blueprint "REST"): add, delete-own,
// reply, resolve and reopen through the tab's revision, relayed without author or token ids; the listing across
// the project with refs and labels.

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
// New comments go on a Sheet cell (docs/specs/029-sheets/sheet.md "Cell comments"): an element's own thread takes
// none (docs/specs/026-plan/plan-mode.md "No comment thread on any canvas element").
const CELL = 'row004:colb01';
const sheet = (id: string, extra: Record<string, unknown> = {}): Element =>
  shape(id, { shape: 'plan-sheet', ...extra });
const cellThreadOf = async (elementId: string, tabId = 't1') =>
  (
    (await stored(tabId)).elements.find((e) => e.id === elementId) as {
      cellComments?: Record<string, { resolved: boolean; comments: Comment[] }>;
    }
  ).cellComments?.[CELL];
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
  return handleProjects(
    makeTestRouteContext(method, `/api/projects/d1${path}`, {
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
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Detail', '{"elements":[]}', 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('TAB2', 'd1', 'view', 'participate', 't2', 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('LOOK', 'd1', 'view', NULL, 1);
  `);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('add', () => {
  it('stamps the author and, for an agent, the token, and bumps the revision', async () => {
    seed([sheet('a')]);
    const before = (await stored()).rev;
    const res = await call({
      path: '/tabs/t1/comments',
      body: { elementId: 'a', cell: CELL, text: '  hello  ' },
      token: 'tok_1',
    });
    expect(res.status).toBe(201);
    const { comment: posted } = await res.json<{ comment: Comment }>();
    expect(posted).toMatchObject({
      text: 'hello',
      authorName: 'Webber',
      authorColor: '#3b82f6',
      authorId: 'owner',
      tokenId: 'tok_1',
    });
    expect((await stored()).rev).toBe(before + 1);
    expect((await cellThreadOf('a'))!.comments[0]).toMatchObject({
      id: posted.id,
      tokenId: 'tok_1',
    });
  });

  // docs/specs/026-plan/plan-mode.md "No comment thread on any canvas element" (Work Tracker 751).
  it('refuses a new comment with no cell, on any element, and writes nothing', async () => {
    seed([shape('a'), sheet('s'), shape('b', { shape: 'plan-board' })]);
    const before = (await stored()).rev;
    for (const elementId of ['a', 's', 'b']) {
      const res = await call({ path: '/tabs/t1/comments', body: { elementId, text: 'x' } });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'element_comments_retired' });
    }
    expect((await stored()).rev).toBe(before);
    expect(await threadOf('a')).toBeUndefined();
  });

  it('refuses a missing element, an arrow, empty or long text, and a body that is not an object', async () => {
    seed([sheet('a'), { id: 'ar', type: 'arrow' } as unknown as Element]);
    const add = (body: unknown, tab = 't1') => call({ path: `/tabs/${tab}/comments`, body });
    expect((await add({ elementId: 'zz', cell: CELL, text: 'x' })).status).toBe(404);
    expect((await add({ elementId: 'ar', cell: CELL, text: 'x' })).status).toBe(404);
    expect((await add({ elementId: 'a', cell: CELL, text: '  ' })).status).toBe(400);
    expect((await add({ elementId: 'a', cell: CELL, text: 'x'.repeat(2001) })).status).toBe(400);
    expect((await add({ text: 'x' })).status).toBe(400);
    expect((await add([1])).status).toBe(400);
    expect((await add({ elementId: 'a', cell: CELL, text: 'x' }, 't9')).status).toBe(404);
  });

  // docs/specs/013-workspace/share-roles.md: commenting is a Participant's; a Viewer only looks.
  it('lets a Participant link comment, refuses a view link, and keeps a tab-scoped link to its tab', async () => {
    seed([sheet('a')], [sheet('b')]);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', cell: CELL, text: 'x' },
          owner: 'looker',
          code: 'LOOK',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', cell: CELL, text: 'x' },
          owner: 'guest',
          code: 'VIEW',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', cell: CELL, text: 'x' },
          owner: 'guest',
          code: 'TAB2',
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call({
          path: '/tabs/t1/comments',
          body: { elementId: 'a', cell: CELL, text: 'x' },
          owner: 'stranger',
        })
      ).status,
    ).toBe(403);
  });
});

describe('reply, resolve and reopen', () => {
  it('replies on the thread holding a comment, and reopens a resolved one by replying', async () => {
    seed([sheet('a', { cellComments: { [CELL]: { resolved: true, comments: [comment('c1')] } } })]);
    const res = await call({ path: '/tabs/t1/comments/c1/reply', body: { text: 'agreed' } });
    expect(res.status).toBe(201);
    const thread = await cellThreadOf('a');
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

  // docs/specs/026-plan/plan-mode.md "No comment thread on any canvas element" (Work Tracker 751): a stored element
  // thread takes no reply, but still resolves and reopens (below).
  it('refuses a reply on an element’s stored thread and leaves it as it was', async () => {
    const thread = { resolved: false, comments: [comment('c1')] };
    seed([shape('a', { commentThread: thread })]);
    const rev = (await stored()).rev;
    const res = await call({ path: '/tabs/t1/comments/c1/reply', body: { text: 'more' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'element_comments_retired' });
    expect((await stored()).rev).toBe(rev);
    expect(await threadOf('a')).toEqual(thread);
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
});

// docs/specs/013-workspace/history.md: a tab deleted whole takes every comment's words with it,
// from the project it left only; a project still holding the tab keeps its own events.
describe('a lost race', () => {
  it('re-reads and repeats once, then answers 409 tab_busy', async () => {
    seed([sheet('a')]);
    const write = vi.spyOn(db, 'upsertTabAtRev');
    const stale = Object.assign(new Error('tab_rev_stale'), { code: 'tab_rev_stale' });
    write.mockRejectedValueOnce(stale);
    const body = { elementId: 'a', cell: CELL, text: 'x' };
    expect((await call({ path: '/tabs/t1/comments', body })).status).toBe(201);
    write.mockRejectedValueOnce(stale).mockRejectedValueOnce(stale);
    const busy = await call({ path: '/tabs/t1/comments', body });
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
      body: await res.json<ProjectCommentsResponse & { error?: string }>(),
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
      projectId: 'd1',
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
        projectId: 'd1',
        tabId: null,
        route: 'list',
        agent: false,
        status: 400,
        code: 'invalid_status',
      },
      {
        projectId: 'd1',
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
