import { describe, expect, it } from 'vitest';
import { BUILT_IN_DATES } from '@liveplanner/items';
import { keptGanttModel } from './gantt-model-memo';
import { NOW, PHASES, card } from './test-fixtures';

// A picture run's Gantts share one model per cards and settings (gantt-model-memo.ts).
const cards = () =>
  new Map(
    [card({ title: 'A', start: '2026-10-01', due: '2026-10-09' }, 'project')].map((c) => [c.id, c]),
  );

describe('keptGanttModel', () => {
  it('works the model out once for the same cards and settings', () => {
    const items = cards();
    const first = keptGanttModel(items, PHASES, NOW, ['project'], BUILT_IN_DATES);
    expect(first.rows).toHaveLength(1);
    expect(keptGanttModel(items, PHASES, NOW, ['project'], BUILT_IN_DATES)).toBe(first);
  });

  it('works it out again for other settings, another day, other phases or other cards', () => {
    const items = cards();
    const first = keptGanttModel(items, PHASES, NOW, ['project'], BUILT_IN_DATES);
    const noTypes = keptGanttModel(items, PHASES, NOW, [], BUILT_IN_DATES);
    expect(noTypes).not.toBe(first);
    expect(noTypes.rows).toHaveLength(0);
    expect(
      keptGanttModel(items, PHASES, new Date(NOW.getTime() + 864e5), ['project'], BUILT_IN_DATES),
    ).not.toBe(first);
    const phases = new Map(PHASES);
    const again = keptGanttModel(items, phases, NOW, ['project'], BUILT_IN_DATES);
    expect(again).not.toBe(first);
    expect(keptGanttModel(items, phases, NOW, ['project'], BUILT_IN_DATES)).toBe(again);
    expect(keptGanttModel(cards(), phases, NOW, ['project'], BUILT_IN_DATES)).not.toBe(again);
  });
});
