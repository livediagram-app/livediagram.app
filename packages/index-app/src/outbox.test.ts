import { describe, expect, it, vi } from 'vitest';
import { COLLAB_MAX_THREADS, IndexError, type IndexAppClient } from '@liveworkspace/index-client';
import {
  capCollabPush,
  DRAIN_TABS,
  drainIndexOutbox,
  editedOf,
  editKeyOf,
  FLUSH_IDLE_MS,
  FLUSH_MIN_GAP_MS,
  nextFlushAt,
  recordItemEditor,
  type SqlExec,
} from './outbox';
import { nodeSql } from './test-sqlite';

const sqlite = (): SqlExec => nodeSql();

function fakeIndex(fail: (kind: string) => unknown = () => null) {
  const calls = { summary: [] as unknown[], collab: [] as string[], events: [] as unknown[] };
  const client = {
    pushSummary: async (_id: string, summary: unknown) => {
      const err = fail('summary');
      if (err) throw err;
      calls.summary.push(summary);
    },
    pushCollab: async (_id: string, tab: string) => {
      const err = fail('collab');
      if (err) throw err;
      calls.collab.push(tab);
    },
    pushEvents: async (_id: string, events: unknown[]) => {
      const err = fail('events');
      if (err) throw err;
      calls.events.push(...events);
    },
  } as unknown as IndexAppClient;
  return { client, calls };
}

const source = {
  collab: async () => ({ threads: [], actions: [] }),
  summary: async () => ({ summary: { elements: 1 }, updatedAt: 5, ownerId: 'user_a' }),
};

const row = (id: number, kind: string, key = '') => ({ id, kind, key });

describe('the outbox', () => {
  it("keeps one edit per person per item in an app's own outbox table", () => {
    const sql = sqlite();
    sql.exec('CREATE TABLE outbox (id INTEGER PRIMARY KEY, plan_id TEXT, kind TEXT, key TEXT)');
    const exec = (q: string, ...b: (string | number)[]) => sql.exec(q, ...b);
    const outbox = { table: 'outbox', itemColumn: 'plan_id' };
    recordItemEditor(exec, outbox, 'P', 'user_a', 1);
    recordItemEditor(exec, outbox, 'Q', 'user_a', 2);
    recordItemEditor(exec, outbox, 'P', 'user_a', 3);
    recordItemEditor(exec, outbox, 'P', 'user_ab', 4);
    const rows = sql.exec('SELECT plan_id, key FROM outbox ORDER BY id').toArray();
    expect(rows).toEqual([
      { plan_id: 'Q', key: 'user_a@2' },
      { plan_id: 'P', key: 'user_a@3' },
      { plan_id: 'P', key: 'user_ab@4' },
    ]);
  });

  it('pushes everything once', async () => {
    const rows = [row(1, 'summary'), row(2, 'tab', 't1'), row(3, 'edit', editKeyOf('user_a', 7))];
    const { client, calls } = fakeIndex();
    const onSummary = vi.fn(async () => {});
    const out = await drainIndexOutbox('I', rows, client, { ...source, onSummary });
    expect(out).toEqual({ done: [1, 2, 3], failures: [], pushes: 3, more: false });
    expect(calls.events).toEqual([{ type: 'edited', actorId: 'user_a', at: 7 }]);
    expect(onSummary).toHaveBeenCalledWith('user_a', 5);
  });

  it('keeps what failed, and drops what the index no longer holds', async () => {
    const { client } = fakeIndex((kind) =>
      kind === 'collab'
        ? new Error('down')
        : kind === 'summary'
          ? new IndexError(404, 'not_found')
          : null,
    );
    const rows = [row(1, 'summary'), row(2, 'tab', 't1')];
    const out = await drainIndexOutbox('I', rows, client, source);
    expect(out.done).toEqual([1]);
    expect(out.failures).toEqual([new Error('down')]);
  });

  it(`takes at most ${DRAIN_TABS} tabs a drain`, async () => {
    const rows = Array.from({ length: DRAIN_TABS + 5 }, (_, i) => row(i + 1, 'tab', `t${i}`));
    const { client, calls } = fakeIndex();
    const out = await drainIndexOutbox('I', rows, client, source);
    expect(out.more).toBe(true);
    expect(out.done).toHaveLength(DRAIN_TABS);
    expect(calls.collab).toHaveLength(DRAIN_TABS);
  });

  it('drops every key without an index', async () => {
    expect((await drainIndexOutbox('I', [row(1, 'summary')], null, source)).done).toEqual([1]);
  });
});

describe('helpers', () => {
  it('reads edit keys back, refusing malformed ones', () => {
    expect(editedOf(editKeyOf('guest_x', 9))).toEqual({
      type: 'edited',
      actorId: 'guest_x',
      at: 9,
    });
    expect(editedOf('@9')).toBeNull();
    expect(editedOf('user_a@soon')).toBeNull();
  });

  it('caps a collab push to the newest', () => {
    const threads = Array.from(
      { length: COLLAB_MAX_THREADS + 3 },
      (_, i) => ({ latestAt: i }) as never,
    );
    const capped = capCollabPush({ threads, actions: [] });
    expect(capped.threads).toHaveLength(COLLAB_MAX_THREADS);
    expect((capped.threads[0] as { latestAt: number }).latestAt).toBe(COLLAB_MAX_THREADS + 2);
  });

  it('waits for idle and at most once a minute', () => {
    expect(nextFlushAt(1_000_000, 0)).toBe(1_000_000 + FLUSH_IDLE_MS);
    expect(nextFlushAt(1_000_000, 990_000)).toBe(990_000 + FLUSH_MIN_GAP_MS);
  });
});
