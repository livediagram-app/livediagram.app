import { describe, expect, it } from 'vitest';
import { blockingCycleOf, blockingIndexOf, blockingLoop } from './blocked-by';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { ITEMS_MAX, FIELD_VALUES_MAX } from './limits';
import type { Item } from './item';
import { item } from './test-items';

// docs/specs/026-plan/item-types.md "Blocked By" and blueprint "Performance and limits": the blocked lookup is one pass
// over the cards and their links, and a loop check walks one new link's upstream once. Budgets are CPU time (a
// loaded runner's wall clock says nothing), each far above what was measured.

const BASE = ITEM_TYPES.find((t) => t.id === 'task')!;
const TASK: ItemTypeDef = {
  ...BASE,
  fields: [...BASE.fields, 'f-blocked-by'],
  custom: [
    ...(BASE.custom ?? []),
    {
      id: 'f-blocked-by',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'task',
      multiple: true,
      blocks: true,
    },
  ],
};
const TYPES = [TASK];

// `n` cards, each blocked by up to `links` earlier ones (so no loop), a third done.
function plan(n: number, links: number): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < n; i += 1) {
    const blockers = out.slice(Math.max(0, i - links), i).map((c) => c.id);
    out.push(
      item({
        title: `Card ${i}`,
        status: i % 3 === 0 ? 'done' : 'todo',
        ...(blockers.length ? { 'f-blocked-by': blockers } : {}),
      }),
    );
  }
  return out;
}

const cpuMs = (run: () => void): number => {
  const start = process.cpuUsage();
  run();
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000;
};

describe('Blocked By at the limits', () => {
  it('builds the lookup for a 500-card board with five links a card', () => {
    const cards = plan(500, 5);
    let open = 0;
    const ms = cpuMs(() => {
      for (let i = 0; i < 20; i += 1)
        open = blockingIndexOf(cards, TYPES, (s) => s === 'done').open.size;
    });
    expect(open).toBeGreaterThan(300);
    // Measured at about 1.8 ms of CPU a build on an M-series laptop.
    expect(ms / 20).toBeLessThan(50);
  });

  it('builds it for a full plan of linked cards, and checks the worst loop', () => {
    const cards = plan(ITEMS_MAX, FIELD_VALUES_MAX);
    const ms = cpuMs(() => void blockingIndexOf(cards, TYPES, (s) => s === 'done'));
    // Measured at about 20 ms of CPU for 2,000 cards with 20 links each (40,000 links).
    expect(ms).toBeLessThan(400);
    // The first card blocked by the last walks every card upstream before it finds the loop.
    const first = cards[0]!;
    const last = cards[cards.length - 1]!;
    const closing = { ...first, fields: { ...first.fields, 'f-blocked-by': [last.id] } };
    let found: unknown = null;
    const loopMs = cpuMs(() => {
      found = blockingCycleOf(cards, TYPES, [{ before: first, next: closing }]);
    });
    expect(found).not.toBeNull();
    // Measured at about 1.5 ms (and 4 ms for the panel's pick check below).
    expect(loopMs).toBeLessThan(400);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const pickMs = cpuMs(() => void blockingLoop(byId, TYPES, first.id, last.id));
    expect(pickMs).toBeLessThan(400);
  });
});
