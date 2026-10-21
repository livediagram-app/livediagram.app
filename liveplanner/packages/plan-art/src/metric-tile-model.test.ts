import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, metricBoard, type Item, type StatusPhase } from '@liveplanner/items';
import { heroSize, metricModel, metricTier } from './metric-tile-model';

// docs/specs/026-plan/plan-tabs.md "Metric tiles".
let n = 0;
const ALI = { id: 'ali', name: 'Ali', color: '#123456' };
function item(fields: Item['fields'], type = 'task'): Item {
  n += 1;
  return {
    id: `i${n}`,
    type,
    key: n,
    rank: `r${n}`,
    fields,
    createdBy: ALI,
    updatedBy: ALI,
    createdAt: 0,
    updatedAt: 0,
  } as Item;
}
const phases = new Map<string, StatusPhase>([
  ['todo', 'todo'],
  ['doing', 'doing'],
  ['done', 'done'],
]);
const board = (items: Item[]) => metricBoard(items, phases, ITEM_TYPES);
const NOW = new Date('2026-10-10T12:00:00Z');

describe('a metric tile', () => {
  it('is a header widget at its small canvas size and grows into a tile with room', () => {
    expect(metricTier(260, 64)).toBe('pill');
    expect(metricTier(260, 120)).toBe('compact');
    expect(metricTier(400, 180)).toBe('regular');
    expect(metricTier(260, 300)).toBe('regular');
    expect(metricTier(400, 300)).toBe('large');
  });

  it('sizes its figure to the tile, within 28 and 72 px', () => {
    expect(heroSize(120, 100, 'compact')).toBe(28);
    expect(heroSize(2000, 2000, 'large')).toBe(72);
    expect(heroSize(400, 200, 'regular')).toBe(60);
  });

  it('reads completion as a share with a ring', () => {
    const m = metricModel(
      'progress',
      board([item({ status: 'done' }), item({ status: 'todo' })]),
      ITEM_TYPES,
      NOW,
    );
    expect(m).toMatchObject({ hero: '50', unit: '%', visual: { kind: 'ring', pct: 50 } });
    expect(m.line).toBe('1 of 2 cards done');
  });

  it('counts every card, split by phase', () => {
    const m = metricModel(
      'count',
      board([item({ status: 'done' }), item({ status: 'doing' }), item({ status: 'doing' })]),
      ITEM_TYPES,
      NOW,
    );
    expect(m.hero).toBe('3');
    expect(m.visual?.kind).toBe('split');
    const parts = m.visual?.kind === 'split' ? m.visual.parts.map((p) => p.count) : [];
    expect(parts).toEqual([0, 2, 1]);
  });

  it('puts overdue first, in red, with due soon beside it', () => {
    const m = metricModel(
      'due',
      board([
        item({ status: 'todo', due: '2026-10-01' }),
        item({ status: 'todo', due: '2026-10-12' }),
      ]),
      ITEM_TYPES,
      NOW,
    );
    expect(m).toMatchObject({ hero: '1', unit: 'overdue', tone: '#dc2626' });
    expect(m.line).toBe('1 due in the next 7 days');
  });

  it('says so when there is nothing yet, with no picture', () => {
    for (const kind of ['count', 'people', 'types', 'priorities', 'top-voted'] as const)
      expect(metricModel(kind, board([]), ITEM_TYPES, NOW).visual, kind).toBeNull();
  });
});
