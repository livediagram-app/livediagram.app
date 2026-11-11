// A collab push writes only what changed (blueprints/inbox.md "The pushes"): a tab's rows are made to match the push,
// a row it no longer holds deleted and the rest upserted only where a column differs, so a push that changes one of
// 500 actions writes one row, not a thousand, on the platform's one database.
import type { CollabActionInput, CollabThreadInput } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const asApp = (path: string, payload: unknown) =>
  call(path, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: payload,
  });

const thread = (i: number, patch: Partial<CollabThreadInput> = {}): CollabThreadInput => ({
  elementId: `el-${i}`,
  elementLabel: `Card ${i}`,
  resolved: false,
  commentCount: 2,
  participantIds: ['user_a', `user_${i % 7}`],
  mentionedIds: i % 3 === 0 ? ['user_b'] : [],
  latestText: `Note ${i}`,
  latestAuthorName: 'Bob',
  firstAt: 1,
  latestAt: 2,
  ...patch,
});

const action = (i: number, patch: Partial<CollabActionInput> = {}): CollabActionInput => ({
  elementId: `el-${i}`,
  actionId: `act-${i}`,
  elementLabel: `Card ${i}`,
  name: `Do ${i}`,
  status: 'open',
  assigneeId: 'user_b',
  assignerId: 'user_a',
  teamId: null,
  createdAt: 1,
  updatedAt: 2,
  ...(i % 4 === 0
    ? { card: { key: i, type: 'task', typeLabel: 'Task', title: `Card ${i}`, board: null } }
    : {}),
  ...patch,
});

const N = 500;
const threads = Array.from({ length: N }, (_, i) => thread(i));
const actions = Array.from({ length: N }, (_, i) => action(i));

// The rows a tab holds, in a stable order, every column.
function held(itemId: string) {
  const all = (table: string, order: string) =>
    h.db.sql.prepare(`SELECT * FROM ${table} WHERE item_id = ? ORDER BY ${order}`).all(itemId);
  return {
    threads: all('collab_threads', 'element_id'),
    people: all('collab_thread_people', 'element_id, person_id'),
    actions: all('collab_actions', 'element_id, action_id'),
  };
}

// The rows the push's write batch changed, summed over its statements (the event log's own rows aside).
async function writesOf(push: () => Promise<Response>): Promise<number> {
  const db = h.db.env.INDEX_DB;
  const batch = db.batch.bind(db);
  let changes = 0;
  db.batch = (async (statements: D1PreparedStatement[]) => {
    const results = await batch(statements);
    for (const r of results) changes += r.meta?.changes ?? 0;
    return results;
  }) as typeof db.batch;
  try {
    expect((await push()).status).toBe(204);
  } finally {
    db.batch = batch;
  }
  return changes;
}

describe('a collab push', () => {
  it('writes only the rows that changed, and reads back as a full replace would', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth, { title: 'Plan' });
    const path = `/app/items/${item.id}/collab/t1`;
    const first = await writesOf(() => asApp(path, { tabName: 'Board', threads, actions }));
    expect(first).toBeGreaterThanOrEqual(2 * N);

    // The same push again writes nothing.
    expect(await writesOf(() => asApp(path, { tabName: 'Board', threads, actions }))).toBe(0);

    // One action changed, one thread gone, one person off a thread, one new action.
    const nextThreads = threads
      .filter((_, i) => i !== 10)
      .map((t, i) => (i === 20 ? { ...t, participantIds: ['user_a'] } : t));
    const nextActions = actions.map((a, i) =>
      i === 5 ? { ...a, status: 'done' as const } : i === 7 ? action(N) : a,
    );
    const changed = await writesOf(() =>
      asApp(path, { tabName: 'Board', threads: nextThreads, actions: nextActions }),
    );
    expect(changed).toBeLessThan(12);

    // What a full replace of the tab would hold: the same rows, pushed into a fresh item.
    const fresh = await makeItem(ada.auth, { title: 'Plan' });
    await asApp(`/app/items/${fresh.id}/collab/t1`, {
      tabName: 'Board',
      threads: nextThreads,
      actions: nextActions,
    });
    const strip = (rows: Record<string, unknown>[]) =>
      rows.map(({ item_id: _item, ...rest }) => rest);
    const mine = held(item.id);
    const theirs = held(fresh.id);
    expect(strip(mine.threads as never)).toEqual(strip(theirs.threads as never));
    expect(strip(mine.people as never)).toEqual(strip(theirs.people as never));
    expect(strip(mine.actions as never)).toEqual(strip(theirs.actions as never));
    expect(mine.actions).toHaveLength(N);
  });

  it('renames every row with its tab, and empties a tab pushed empty', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth, { title: 'Plan' });
    const path = `/app/items/${item.id}/collab/t1`;
    await asApp(path, {
      tabName: 'Board',
      threads: threads.slice(0, 3),
      actions: actions.slice(0, 3),
    });
    await asApp(path, {
      tabName: 'Renamed',
      threads: threads.slice(0, 3),
      actions: actions.slice(0, 3),
    });
    const rows = held(item.id);
    expect(new Set(rows.threads.map((r) => r.tab_name))).toEqual(new Set(['Renamed']));
    expect(new Set(rows.actions.map((r) => r.tab_name))).toEqual(new Set(['Renamed']));
    await asApp(path, { tabName: 'Renamed', threads: [], actions: [] });
    expect(held(item.id)).toEqual({ threads: [], people: [], actions: [] });
  });
});
