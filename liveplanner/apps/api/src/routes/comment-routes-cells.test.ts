import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ProjectCommentsResponse } from '@liveplanner/api-schema';
import type { Comment, Element } from '@liveplanner/project';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// Cell comments on the comment endpoints (docs/specs/029-sheets/sheet.md "Cell comments"): add with a cell, reply,
// resolve, reopen and delete-own find the cell's thread, the room hears the cell, and the listing gives each cell
// thread its cell and A1.

let sql: SqliteD1;
let pending: Promise<unknown>[];

const B4 = 'row004:colb01';
const sheet = (extra: Record<string, unknown> = {}): Element =>
  ({
    id: 'sh',
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 960,
    height: 560,
    label: 'Budget',
    planSheet: { sheetId: 'sheet01' },
    ...extra,
  }) as unknown as Element;
const square = { id: 'sq', type: 'shape', shape: 'square', x: 0, y: 0, width: 50, height: 50 };
const comment = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: `text ${id}`,
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#000',
  authorId: 'priya',
  ...extra,
});

function seed(elements: unknown[]) {
  sql.sql
    .prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?')
    .run(JSON.stringify({ elements }), 't1');
}

function call(method: string, path: string, body?: unknown, owner = 'owner', code?: string) {
  return handleProjects(
    makeTestRouteContext(method, `/api/projects/d1${path}`, {
      env: sql.env,
      owner,
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
      ...(body === undefined ? {} : { body }),
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

const cellThread = async () =>
  (
    (await db.getTab(sql.env, 'd1', 't1'))!.elements.find((e) => e.id === 'sh') as {
      cellComments?: Record<string, { resolved: boolean; comments: Comment[] }>;
    }
  ).cellComments?.[B4];

beforeEach(() => {
  sql = sqliteD1();
  pending = [];
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[]}', 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('LOOK', 'd1', 'view', NULL, 1);
    INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
      VALUES ('d1', 'sheet01', 't1', 'Budget',
        '{"rows":["row001","row002","row003","row004"],"cols":["cola01","colb01"]}', 0, 1, 1, '{}');
  `);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('cell comments over the comment endpoints', () => {
  it('adds a comment to a cell thread, leaving the Sheet thread alone', async () => {
    seed([sheet()]);
    const res = await call('POST', '/tabs/t1/comments', {
      elementId: 'sh',
      cell: B4,
      text: 'Why?',
    });
    expect(res.status).toBe(201);
    const thread = await cellThread();
    expect(thread?.comments.map((c) => c.text)).toEqual(['Why?']);
    const tab = await db.getTab(sql.env, 'd1', 't1');
    expect((tab!.elements[0] as { commentThread?: unknown }).commentThread).toBeUndefined();
  });

  it('refuses a malformed cell, and a cell on an element that is not a Sheet', async () => {
    seed([sheet(), square]);
    expect(
      (await call('POST', '/tabs/t1/comments', { elementId: 'sh', cell: 'B4', text: 'x' })).status,
    ).toBe(400);
    expect(
      (await call('POST', '/tabs/t1/comments', { elementId: 'sq', cell: B4, text: 'x' })).status,
    ).toBe(400);
  });

  it('replies, resolves and reopens the cell thread a comment is in', async () => {
    seed([sheet({ cellComments: { [B4]: { comments: [comment('c1')], resolved: false } } })]);
    expect((await call('POST', '/tabs/t1/comments/c1/reply', { text: 'Fixed' })).status).toBe(201);
    expect((await cellThread())?.comments).toHaveLength(2);
    expect((await call('POST', '/tabs/t1/comments/c1/resolve')).status).toBe(204);
    expect((await cellThread())?.resolved).toBe(true);
    // Resolving again writes nothing.
    const rev = (await db.getTab(sql.env, 'd1', 't1'))!.rev;
    expect((await call('POST', '/tabs/t1/comments/c1/resolve')).status).toBe(204);
    expect((await db.getTab(sql.env, 'd1', 't1'))!.rev).toBe(rev);
    expect((await call('POST', '/tabs/t1/comments/c1/reopen')).status).toBe(204);
    expect((await cellThread())?.resolved).toBe(false);
  });

  it("deletes the caller's own cell comment, and refuses someone else's", async () => {
    seed([
      sheet({
        cellComments: {
          [B4]: {
            comments: [comment('mine', { authorId: 'owner' }), comment('theirs')],
            resolved: false,
          },
        },
      }),
    ]);
    expect((await call('DELETE', '/tabs/t1/comments/theirs')).status).toBe(403);
    expect((await call('DELETE', '/tabs/t1/comments/mine')).status).toBe(204);
    expect((await cellThread())?.comments.map((c) => c.id)).toEqual(['theirs']);
  });

  it('lets a Participant comment on a cell, and refuses a Viewer', async () => {
    seed([sheet()]);
    expect(
      (
        await call(
          'POST',
          '/tabs/t1/comments',
          { elementId: 'sh', cell: B4, text: 'Hi' },
          'guest',
          'VIEW',
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await call(
          'POST',
          '/tabs/t1/comments',
          { elementId: 'sh', cell: B4, text: 'Hi' },
          'guest',
          'LOOK',
        )
      ).status,
    ).toBe(403);
  });

  it('lists each cell thread with its cell and A1, the gone cell without one', async () => {
    seed([
      sheet({
        commentThread: { comments: [comment('own')], resolved: false },
        cellComments: {
          [B4]: { comments: [comment('c1')], resolved: false },
          'row999:colb01': { comments: [comment('c2')], resolved: false },
        },
      }),
    ]);
    const res = await call('GET', '/comments?status=open');
    const { threads } = (await res.json()) as ProjectCommentsResponse;
    expect(threads.map((t) => [t.cell ?? null, t.cellRef ?? null])).toEqual([
      [null, null],
      [B4, 'B4'],
      ['row999:colb01', null],
    ]);
    // Author ids stay redacted for anyone but their author.
    expect(JSON.stringify(threads)).not.toContain('"priya"');
  });
});
