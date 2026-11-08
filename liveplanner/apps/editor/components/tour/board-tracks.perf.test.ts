// @vitest-environment jsdom
// Budgets for the board tracks' checks, run on each render while a track is up (plan-tour.md "Boards: Card Types",
// "Boards: Board Setup"), at the largest plan they meet: 200 card types, a 12-column board with every widget.
import { describe, expect, it } from 'vitest';
import type { ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import { newTypeOf, setupChanged, setupMissions, typeShape, typesMissions } from './board-tracks';

const types = Array.from(
  { length: 200 },
  (_, i) =>
    ({
      id: `t${i}`,
      label: `Type ${i}`,
      fields: Array.from({ length: 12 }, (_, f) => `f${f}`),
      custom: Array.from({ length: 8 }, (_, c) => ({
        id: `c${c}`,
        label: `Custom ${c}`,
        kind: 'text',
      })),
    }) as unknown as ItemTypeDef,
);
const columns = Array.from({ length: 12 }, (_, i) => ({
  id: `col${i}`,
  name: `Column ${i}`,
  status: `s${i}`,
  wipLimit: 5,
}));
const start = {
  title: 'Board',
  columns,
  widgets: ['progress', 'wip', 'filter', 'mine', 'sum'],
} as unknown as PlanBoardSetup;
const now = {
  ...start,
  columns: columns.map((c, i) => (i === 11 ? { ...c, wipLimit: 6 } : c)),
} as PlanBoardSetup;

function perCall(fn: () => void, n = 2000): number {
  for (let i = 0; i < 100; i++) fn();
  const t = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t) / n;
}

describe('board track check budgets', () => {
  it('checks every Card Types mission in well under a millisecond with 200 types', () => {
    const startIds = new Set(types.slice(0, 199).map((t) => t.id));
    const ctx = { startIds, types, firstShape: typeShape(types[199]!), practice: [] };
    const missions = typesMissions('b', 'Backlog');
    const ms = perCall(() => {
      for (const m of missions) m.done(ctx);
      newTypeOf(ctx);
    });
    console.log(`card types checks: ${(ms * 1000).toFixed(1)} µs per render`);
    expect(ms).toBeLessThan(1);
  });
  it('checks every Board Setup mission and setupChanged in well under a millisecond on 12 columns', () => {
    const missions = setupMissions('b');
    const ms = perCall(() => {
      for (const m of missions) m.done({ start, now });
      setupChanged(start, now);
    });
    console.log(`board setup checks: ${(ms * 1000).toFixed(1)} µs per render`);
    expect(ms).toBeLessThan(1);
  });
});
