// A bulk create's cost grows with its size, not faster (docs/specs/026-plan/blueprints/item-store.md "Performance
// and limits"): every create is ranked by one placer (itemPlacer) rather than by re-sorting the column it joins,
// which made a 2000-card seed quadratic. Timed as growth in CPU time (cpuMsOf), not against a wall clock: eight times
// the creates cost about five to six times as much here, and the old per-create sort about fifty.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { EMPTY_ITEM_STORE, applyItemWrite } from './store';
import type { ItemCreate } from './item';

const BY = { id: 'p', name: 'P', color: '#000000' };
const RUNS = 5;
// Each timing makes the batch this many times, so the small batch takes milliseconds, not timer noise.
const REPS = 10;
const RATIO_CEILING = 20;
const TIMEOUT_MS = 30_000;

function creates(n: number): ItemCreate[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${String(i).padStart(6, '0')}`,
    type: 'task',
    fields: { title: `Card ${i}`, status: i % 2 ? 'todo' : 'doing' },
  }));
}

function fastest(n: number): number {
  const write = { kind: 'create' as const, creates: creates(n) };
  let best = Infinity;
  for (let run = 0; run < RUNS; run++) {
    best = Math.min(
      best,
      cpuMsOf(() => {
        for (let i = 0; i < REPS; i++) applyItemWrite(EMPTY_ITEM_STORE, write, { now: 1, by: BY });
      }),
    );
  }
  return best;
}

describe('a bulk create as it grows', () => {
  it(
    'costs about linearly more, never quadratically',
    () => {
      fastest(200); // warm up
      const small = fastest(250);
      const large = fastest(2000);
      expect(large / small).toBeLessThan(RATIO_CEILING);
    },
    TIMEOUT_MS,
  );

  it('keeps each column in creation order', () => {
    const result = applyItemWrite(
      EMPTY_ITEM_STORE,
      { kind: 'create', creates: creates(300) },
      { now: 1, by: BY },
    );
    if (!result.ok) throw new Error('refused');
    for (const status of ['todo', 'doing']) {
      const ranks = result.upserts.filter((i) => i.fields.status === status).map((i) => i.rank);
      expect(ranks).toEqual([...ranks].sort());
      expect(new Set(ranks).size).toBe(ranks.length);
    }
  });
});
