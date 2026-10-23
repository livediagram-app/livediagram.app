import { describe, expect, it, vi } from 'vitest';
import { COLLAB_MAX_THREADS, IndexError, type IndexAppClient } from '@liveworkspace/index-client';
import {
  capCollabPush,
  DRAIN_TABS,
  drainOutboxTable,
  editedOf,
  editKeyOf,
  ensureOutboxSchema,
  FLUSH_IDLE_MS,
  FLUSH_MIN_GAP_MS,
  nextFlushAt,
  outboxPending,
  queueOutbox,
  recordEditor,
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

describe('the outbox', () => {
  it('keeps one key per thing and one edit per person', () => {
    const sql = sqlite();
    ensureOutboxSchema(sql);
    queueOutbox(sql, 'summary');
    queueOutbox(sql, 'summary');
    queueOutbox(sql, 'tab', 't1');
    recordEditor(sql, 'user_a', 1);
    recordEditor(sql, 'user_a', 2);
    recordEditor(sql, 'user_ab', 3);
    const rows = sql.exec('SELECT kind, key FROM index_outbox ORDER BY id').toArray();
    expect(rows).toEqual([
      { kind: 'summary', key: '' },
      { kind: 'tab', key: 't1' },
      { kind: 'edit', key: 'user_a@2' },
      { kind: 'edit', key: 'user_ab@3' },
    ]);
  });

  it('pushes everything once, then is empty', async () => {
    const sql = sqlite();
    ensureOutboxSchema(sql);
    queueOutbox(sql, 'summary');
    queueOutbox(sql, 'tab', 't1');
    recordEditor(sql, 'user_a', 7);
    const { client, calls } = fakeIndex();
    const onSummary = vi.fn(async () => {});
    const out = await drainOutboxTable(sql, 'I', client, { ...source, onSummary });
    expect(out).toEqual({ keys: 3, pushes: 3, more: false });
    expect(calls.events).toEqual([{ type: 'edited', actorId: 'user_a', at: 7 }]);
    expect(onSummary).toHaveBeenCalledWith('user_a', 5);
    expect(outboxPending(sql)).toBe(false);
  });

  it('keeps what failed, and drops what the index no longer holds', async () => {
    const sql = sqlite();
    ensureOutboxSchema(sql);
    queueOutbox(sql, 'summary');
    queueOutbox(sql, 'tab', 't1');
    const { client } = fakeIndex((kind) =>
      kind === 'collab'
        ? new Error('down')
        : kind === 'summary'
          ? new IndexError(404, 'not_found')
          : null,
    );
    await expect(drainOutboxTable(sql, 'I', client, source)).rejects.toThrow('down');
    expect(sql.exec('SELECT kind FROM index_outbox').toArray()).toEqual([{ kind: 'tab' }]);
  });

  it(`takes at most ${DRAIN_TABS} tabs a drain`, async () => {
    const sql = sqlite();
    ensureOutboxSchema(sql);
    for (let i = 0; i < DRAIN_TABS + 5; i++) queueOutbox(sql, 'tab', `t${i}`);
    const { client, calls } = fakeIndex();
    expect((await drainOutboxTable(sql, 'I', client, source)).more).toBe(true);
    expect(calls.collab).toHaveLength(DRAIN_TABS);
    expect((await drainOutboxTable(sql, 'I', client, source)).more).toBe(false);
  });

  it('drops every key without an index', async () => {
    const sql = sqlite();
    ensureOutboxSchema(sql);
    queueOutbox(sql, 'summary');
    expect((await drainOutboxTable(sql, 'I', null, source)).keys).toBe(1);
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
