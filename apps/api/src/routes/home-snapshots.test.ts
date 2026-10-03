import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { recordTabSave } from '../timeline';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// What What happened needs from the stored events (docs/specs/013-workspace/timeline.md §4.3;
// docs/specs/013-workspace/explorer-home.md "What happened"): a comment says whether it replies,
// on both comment write paths, and an assignment names its assignee.

let db: SqliteD1;
let pending: Promise<unknown>[];
const DOC = { id: 'd1', name: 'Payments', ownerId: 'owner', teamId: null };

function shape(id: string, extra: Record<string, unknown> = {}): Element {
  return {
    id,
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...extra,
  } as unknown as Element;
}
const comment = (id: string) => ({
  id,
  text: `text ${id}`,
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#000',
});

function snapshots(eventType: string): Record<string, unknown>[] {
  return (
    db.sql
      .prepare(
        'SELECT source_id, snapshot FROM timeline_events WHERE event_type = ? ORDER BY source_id',
      )
      .all(eventType) as { source_id: string; snapshot: string }[]
  ).map((r) => ({ ...(JSON.parse(r.snapshot) as Record<string, unknown>), id: r.source_id }));
}

beforeEach(() => {
  db = sqliteD1();
  pending = [];
  db.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Tab 1', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at)
      VALUES ('CODE', 'd1', 'view', NULL, 1);
  `);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the tab save', () => {
  it('marks a reply, and leaves a thread-starting comment unmarked', async () => {
    const prev = [shape('a', { commentThread: { comments: [comment('c1')] } })];
    const next = [
      shape('a', { commentThread: { comments: [comment('c1'), comment('c2')] } }),
      shape('b', { commentThread: { comments: [comment('c3')] } }),
    ];
    await recordTabSave(db.env, DOC, 'priya', next, prev);
    expect(snapshots('comment_added')).toEqual([
      expect.objectContaining({ id: 'c2', reply: true }),
      expect.objectContaining({ id: 'c3', reply: false }),
    ]);
  });

  it("names an assignment's assignee", async () => {
    const action = {
      id: 'act1',
      name: 'Fix',
      status: 'open',
      assignee: { userId: 'me', name: 'Me' },
    };
    await recordTabSave(db.env, DOC, 'priya', [shape('a', { action })], [shape('a')]);
    expect(snapshots('action_assigned')).toEqual([
      expect.objectContaining({ id: 'act1', assigneeId: 'me', actionName: 'Fix' }),
    ]);
  });
});

describe('the view-role comment', () => {
  async function post(elementId: string) {
    const res = await handleDocuments(
      makeTestRouteContext('POST', '/api/documents/d1/tabs/t1/comments', {
        env: db.env,
        owner: 'guest-visitor',
        headers: { 'X-Share-Code': 'CODE' },
        body: { elementId, text: 'hello' },
        waitUntil: (p) => void pending.push(p),
      }),
    );
    // The room relay has no room binding here; only the timeline emit matters.
    await Promise.allSettled(pending);
    return res;
  }

  it('marks a reply on a thread that already had a comment', async () => {
    db.sql.prepare("UPDATE tabs SET data = ? WHERE id = 't1'").run(
      JSON.stringify({
        elements: [shape('a'), shape('b', { commentThread: { comments: [comment('c1')] } })],
      }),
    );
    expect((await post('a')).status).toBe(200);
    expect((await post('b')).status).toBe(200);
    const replies = snapshots('comment_added').map((s) => s.reply);
    expect(replies.sort()).toEqual([false, true]);
  });
});
