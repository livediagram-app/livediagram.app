import { describe, expect, it } from 'vitest';
import type { RemovalBoard } from '@liveplanner/items';
import {
  REMOVAL_QUARANTINE_IDS,
  REMOVAL_RUNS_MAX,
  RemovalGuard,
  type RemovalActor,
} from './removal-guard-store';

// The room's run keeping (docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card removals").

const board: RemovalBoard = {
  id: 'b1',
  name: 'Board',
  cards: new Set(Array.from({ length: 30 }, (_, i) => `c${i}`)),
};
const ids = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => `c${from + i}`);
const ann: RemovalActor = { kind: 'person', id: 'p-ann', name: 'Ann' };

function world() {
  const store = new Map<string, unknown>();
  let reads = 0;
  const guard = new RemovalGuard({
    get: async <T>(k: string) => store.get(k) as T | undefined,
    put: async <T>(k: string, v: T) => void store.set(k, v),
  });
  const boardsOf = async () => {
    reads += 1;
    return [board];
  };
  return { guard, boardsOf, reads: () => reads };
}

describe('RemovalGuard', () => {
  it('reads the boards once per run and gives back what did not land', async () => {
    const w = world();
    expect(await w.guard.admit(ann, ids(0, 10), w.boardsOf)).toBeNull();
    expect(await w.guard.admit(ann, ids(10, 11), w.boardsOf)).not.toBeNull();
    w.guard.release(ann, ids(5, 10));
    expect(await w.guard.admit(ann, ids(10, 15), w.boardsOf)).toBeNull();
    expect(w.reads()).toBe(1);
    // A caller with no run has nothing to give back.
    w.guard.release({ kind: 'token', id: 'tok' }, ['c0']);
  });

  it('counts two requests that start a run at once as one run', async () => {
    const w = world();
    const [a, b] = await Promise.all([
      w.guard.admit(ann, ids(0, 6), w.boardsOf),
      w.guard.admit(ann, ids(6, 12), w.boardsOf),
    ]);
    expect([a, b].filter((v) => v !== null)).toHaveLength(1);
  });

  it('forgets the oldest run past the bound', async () => {
    const w = world();
    await w.guard.admit(ann, ids(0, 10), w.boardsOf);
    for (let i = 0; i < REMOVAL_RUNS_MAX; i += 1)
      await w.guard.admit({ kind: 'token', id: `t${i}` }, ['c0'], w.boardsOf);
    // Ann's run is gone, so her next removal starts afresh.
    expect(await w.guard.admit(ann, ids(10, 20), w.boardsOf)).toBeNull();
  });

  it('keeps at most REMOVAL_QUARANTINE_IDS card ids of a held write', async () => {
    const w = world();
    const many = Array.from({ length: REMOVAL_QUARANTINE_IDS + 5 }, (_, i) => `x${i}`);
    await w.guard.quarantine(
      ann,
      { reason: 'over-threshold', board: 'Board', count: 30, had: 30, limit: 10 },
      many,
    );
    const [entry] = await w.guard.held();
    expect(entry?.cardIds).toHaveLength(REMOVAL_QUARANTINE_IDS);
    expect(entry?.named).toBe(REMOVAL_QUARANTINE_IDS + 5);
  });
});
