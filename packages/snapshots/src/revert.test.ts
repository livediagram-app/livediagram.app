import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_MAX_BYTES } from './limits';
import { revertToSnapshot, type SnapshotDoor } from './server';
import { listSnapshots, readGeneration, readSnapshotText, takeSnapshot } from './store';
import { testDb } from './test/db';
import { AUTOMATION_AUTHOR_COLOR, AUTOMATION_AUTHOR_ID, automationAuthor } from './wire';

// The revert a rule's Revert to Snapshot step calls, with no HTTP request (snapshots.md "Revert"; blueprint SN36):
// the route's own steps and guarantees, its safety snapshot by the rule.

const person = { id: 'user_a', name: 'Ada', color: '#f00' };

function item(initial: string) {
  const state = { content: initial, reverted: [] as number[] };
  const door: SnapshotDoor = {
    exportFile: async () => state.content,
    replaceContent: async (text) => {
      state.content = text;
      return 'ok';
    },
    afterRevert: (g) => state.reverted.push(g),
  };
  return { state, door };
}

async function taken(db: ReturnType<typeof testDb>['db'], text: string, name: string | null) {
  const result = await takeSnapshot(db, {
    itemId: 'p1',
    text,
    name,
    kind: 'manual',
    author: person,
  });
  if (!result.ok) throw new Error('refused');
  return result.snapshot.id;
}

describe('automationAuthor', () => {
  it('is the rule by name, under an id no person has', () => {
    expect(automationAuthor('Reset the workshop')).toEqual({
      id: 'automation',
      name: 'Reset the workshop',
      color: '#7c3aed',
    });
    expect([AUTOMATION_AUTHOR_ID, AUTOMATION_AUTHOR_COLOR]).toEqual(['automation', '#7c3aed']);
  });
});

describe('revertToSnapshot', () => {
  it('puts the item back for a rule: the safety snapshot first, by the rule, then the content, the generation and the room', async () => {
    const { db } = testDb();
    const { state, door } = item('clean');
    const id = await taken(db, 'clean', 'Clean board');
    state.content = 'after the workshop';
    const order: string[] = [];
    const watched: SnapshotDoor = {
      exportFile: async () => (order.push('export'), state.content),
      replaceContent: async (text) => (order.push('replace'), door.replaceContent(text)),
      afterRevert: (g) => (order.push('room'), door.afterRevert!(g)),
      kept: () => [id],
    };
    const result = await revertToSnapshot({
      db,
      itemId: 'p1',
      snapshotId: id,
      door: watched,
      author: automationAuthor('Reset the workshop'),
    });
    expect(result).toEqual({
      ok: true,
      reverted: { snapshotId: id, safetySnapshotId: expect.any(String), generation: 1 },
    });
    expect(order).toEqual(['export', 'replace', 'room']);
    expect(state.content).toBe('clean');
    expect(state.reverted).toEqual([1]);
    expect(await readGeneration(db, 'p1')).toBe(1);
    const [safety, target] = await listSnapshots(db, 'p1');
    expect(safety).toMatchObject({
      kind: 'before-revert',
      name: 'Before reverting to "Clean board"',
      author: { id: 'automation', name: 'Reset the workshop', color: '#7c3aed' },
    });
    if (!result.ok) throw new Error('refused');
    expect(await readSnapshotText(db, 'p1', result.reverted.safetySnapshotId)).toBe(
      'after the workshop',
    );
    expect(target!.id).toBe(id);
  });

  it('keeps the snapshot a nightly rule names through any number of reverts', async () => {
    const { db } = testDb();
    const { state, door } = item('clean');
    const id = await taken(db, 'clean', 'Clean board');
    const ruled: SnapshotDoor = { ...door, kept: () => [id] };
    for (let night = 1; night <= 8; night += 1) {
      state.content = `night ${night}`;
      const result = await revertToSnapshot({
        db,
        itemId: 'p1',
        snapshotId: id,
        door: ruled,
        author: automationAuthor('Nightly'),
      });
      expect(result.ok).toBe(true);
      expect(state.content).toBe('clean');
    }
    // The latest five safety snapshots, and the kept one beside them.
    const list = await listSnapshots(db, 'p1');
    expect(list).toHaveLength(6);
    expect(list.at(-1)!.id).toBe(id);
    expect(await readGeneration(db, 'p1')).toBe(8);
  });

  it('changes nothing when the snapshot is gone, unreadable, or the item was never started', async () => {
    const { db, sql } = testDb();
    const { state, door } = item('now');
    const replace = vi.spyOn(door, 'replaceContent');
    const run = (snapshotId: string, over: Partial<SnapshotDoor> = {}) =>
      revertToSnapshot({ db, itemId: 'p1', snapshotId, door: { ...door, ...over }, author: null });
    expect(await run('s_gone')).toEqual({ ok: false, reason: 'snapshot_missing' });
    const id = await taken(db, 'old', null);
    expect(await run(id, { exportFile: async () => null })).toEqual({
      ok: false,
      reason: 'item_missing',
    });
    // Never skipped: with no safety snapshot to take, nothing is replaced.
    const huge = 'x'.repeat(SNAPSHOT_MAX_BYTES + 1);
    expect(await run(id, { exportFile: async () => huge })).toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(replace).not.toHaveBeenCalled();
    for (const [answer, reason] of [
      ['invalid', 'unreadable'],
      ['too_large', 'too_large'],
    ] as const) {
      expect(await run(id, { replaceContent: async () => answer })).toEqual({ ok: false, reason });
    }
    sql.exec("DELETE FROM snapshot_chunks WHERE snapshot_id = '" + id + "'");
    expect(await run(id)).toEqual({ ok: false, reason: 'unreadable' });
    expect(state.content).toBe('now');
    expect(state.reverted).toEqual([]);
    expect(await readGeneration(db, 'p1')).toBe(0);
  });
});
