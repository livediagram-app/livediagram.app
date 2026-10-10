import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { planOutline, statusColumnsOfSetups } from './plan-outline';
import { presetSetup, statusColumn } from './presets';
import { ITEM_TYPE_CATALOGUE_VERSION } from './type-catalogue';

const board = (id: string, setup: unknown) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  planBoard: setup,
});

describe('planOutline', () => {
  const kanban = { ...presetSetup('kanban'), title: 'Sprint', addTypes: undefined };
  const roadmap = {
    ...presetSetup('kanban'),
    title: 'Roadmap',
    addTypes: ['project'],
    columns: [statusColumn('doing', 'Underway'), statusColumn('later', 'Later', { wipLimit: 3 })],
  };
  const tabs = [
    { id: 't1', name: 'Board', elements: [{ id: 'x', type: 'text' }, board('b1', kanban)] },
    {
      id: 't2',
      name: 'Roadmap',
      elements: [
        board('b2', roadmap),
        board('b3', presetSetup('archive')),
        board('bad', { nope: 1 }),
      ],
    },
  ];

  it('lists boards in tab then canvas order, skipping damaged ones', () => {
    const plan = planOutline(tabs, null);
    expect(plan.boards.map((b) => [b.tabId, b.elementId, b.title, b.kind])).toEqual([
      ['t1', 'b1', 'Sprint', 'board'],
      ['t2', 'b2', 'Roadmap', 'board'],
      ['t2', 'b3', 'Archive', 'archive'],
    ]);
    expect(plan.boards[0]!.types).toBeNull();
    expect(plan.boards[1]!.types).toEqual(['project']);
    expect(plan.boards[1]!.columns[1]).toEqual({ status: 'later', name: 'Later', wipLimit: 3 });
  });

  it('names each status once, the first board winning, and never an archive column', () => {
    const { statuses } = planOutline(tabs, null);
    const doing = statuses.filter((s) => s.status === 'doing');
    expect(doing).toHaveLength(1);
    expect(doing[0]!.name).toBe(kanban.columns.find((c) => c.status === 'doing')!.name);
    expect(statuses.some((s) => s.status === 'later')).toBe(true);
    const archive = presetSetup('archive');
    expect(statusColumnsOfSetups([archive])).toEqual([]);
  });

  it('answers the built-in types without a catalogue, else the stored ones', () => {
    expect(planOutline([], null).types).toBe(ITEM_TYPES);
    const bug = { ...ITEM_TYPES[1], id: 'bug', label: 'Bug' };
    const stored = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [bug] };
    expect(planOutline([], stored).types).toEqual([bug]);
  });
});

describe('planOutline cost', () => {
  it('reads 50 tabs of 2,000 elements and 4 boards each within budget', () => {
    const big = Array.from({ length: 50 }, (_, t) => ({
      id: `t${t}`,
      name: `Tab ${t}`,
      elements: [
        ...Array.from({ length: 2000 }, (_, i) => ({
          id: `e${t}-${i}`,
          type: 'shape',
          shape: 'square',
        })),
        ...Array.from({ length: 4 }, (_, b) => board(`b${t}-${b}`, presetSetup('sprint'))),
      ],
    }));
    const started = performance.now();
    const plan = planOutline(big, null);
    const took = performance.now() - started;
    expect(plan.boards).toHaveLength(200);
    // Measured 11.7 ms cold, 1.5 ms warm on an M-series laptop (2026-10-08); the budget allows a loaded CI runner.
    expect(took).toBeLessThan(250);
  });
});
