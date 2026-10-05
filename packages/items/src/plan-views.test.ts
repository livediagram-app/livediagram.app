import { describe, expect, it } from 'vitest';
import {
  METRIC_KINDS,
  PLAN_VIEW_IDS,
  metricBoard,
  isPlanViewId,
  liveCards,
  phaseOf,
  planViewSize,
  planViewMetric,
  statusPhasesOf,
} from './plan-views';
import { isBoardWidgetKind } from './board-widgets';
import { presetSetup } from './presets';
import { ALI, SAM, item } from './test-items';
import { TRASH_STATUS } from './board';

const kanban = {
  title: 'K',
  columns: [
    { id: 'a', name: 'To do', status: 'todo' },
    { id: 'b', name: 'Doing', status: 'doing' },
    { id: 'c', name: 'Done', status: 'done' },
    { id: 'd', name: 'Shipped', status: 'shipped' },
  ],
  doneColumnId: 'c',
  swimlaneBy: 'none',
  cardFields: [],
  voting: { on: false },
  hideWriting: false,
};

describe('plan view ids', () => {
  it('names a widget view per metric kind, then the visualisations', () => {
    expect(PLAN_VIEW_IDS).toHaveLength(METRIC_KINDS.length + 5);
    for (const k of METRIC_KINDS) expect(isBoardWidgetKind(k)).toBe(true);
    expect(METRIC_KINDS).not.toContain('filter');
    expect(METRIC_KINDS).not.toContain('mine');
    expect(isPlanViewId('metric:progress')).toBe(true);
    expect(isPlanViewId('metric:filter')).toBe(false);
    expect(isPlanViewId('gantt')).toBe(true);
    expect(isPlanViewId(3)).toBe(false);
  });

  it('tells a widget view from a visualisation, and sizes each', () => {
    expect(planViewMetric('metric:due')).toBe('due');
    expect(planViewMetric('calendar')).toBeNull();
    expect(planViewSize('metric:count')).toEqual({ width: 260, height: 64 });
    expect(planViewSize('gantt')).toEqual({ width: 880, height: 420 });
    expect(planViewSize('workload')).toEqual({ width: 720, height: 400 });
    expect(planViewSize('nope')).toEqual({ width: 720, height: 400 });
  });
});

describe('status phases', () => {
  it('reads first column as not started, the done column on as done, the rest in progress', () => {
    const phases = statusPhasesOf([kanban, presetSetup('all-cards'), 'junk']);
    expect([...phases]).toEqual([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
      ['shipped', 'done'],
    ]);
  });

  it('gives no Done without a done column, and the first board decides a shared status', () => {
    const noDone = { ...kanban, doneColumnId: undefined };
    const other = { ...kanban, columns: [{ id: 'x', name: 'Done', status: 'doing' }] };
    const phases = statusPhasesOf([noDone, other]);
    expect(phases.get('done')).toBe('doing');
    expect(phases.get('doing')).toBe('doing');
  });

  it('reads a card with no or an unknown status as not started', () => {
    const phases = statusPhasesOf([kanban]);
    expect(phaseOf(item({ title: 'a' }), phases)).toBe('todo');
    expect(phaseOf(item({ title: 'a', status: 'elsewhere' }), phases)).toBe('todo');
    expect(phaseOf(item({ title: 'a', status: 'shipped' }), phases)).toBe('done');
  });
});

describe('metric board', () => {
  it('reads every live card, the done phase as its done column', () => {
    const phases = statusPhasesOf([kanban]);
    const cards = [
      item({ title: 'a', status: 'todo', assignee: SAM }),
      item({ title: 'b', status: 'done', assignee: ALI }),
      item({ title: 'c', status: 'shipped' }),
      item({ title: 'd', status: 'todo', archived: true }),
      item({ title: 'e', status: TRASH_STATUS }),
      item({ title: 'f' }),
    ];
    expect(liveCards(cards)).toHaveLength(4);
    const board = metricBoard(cards, phases);
    expect(board.projection.total).toBe(4);
    expect(board.projection.doneCount).toBe(2);
    expect(board.setup.doneColumnId).toBe('done');
    expect(board.items.map((i) => i.id)).toEqual(liveCards(cards).map((i) => i.id));
  });

  it('has no done column when no status is done', () => {
    const board = metricBoard([item({ title: 'a' })], new Map());
    expect(board.setup.doneColumnId).toBeUndefined();
    expect(board.projection.total).toBe(1);
  });
});
