import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livedesign/document';
import { presetSetup } from '@livedesign/items';
import { fillTabElementOf } from './fill-tab';

// docs/specs/026-plan/plan-board.md "Fill Tab".
const board = (id: string, fillTab?: unknown): Element =>
  ({
    ...createShape('plan-board', 0, 0),
    id,
    planBoard: { ...presetSetup('kanban'), ...(fillTab === undefined ? {} : { fillTab }) },
  }) as Element;
const note = (id: string, locked = false): Element => ({
  ...createShape('square', 0, 0),
  id,
  ...(locked ? { locked: true } : {}),
});

const sheet = (id: string, fillTab?: true): Element => ({
  ...createShape('plan-sheet', 0, 0),
  id,
  planSheet: { sheetId: 'sheet0001', ...(fillTab ? { fillTab } : {}) },
});

describe('fillTabElementOf', () => {
  it('is the first board or Sheet in canvas order with Fill Tab exactly on', () => {
    expect(fillTabElementOf([note('n'), board('a'), board('b', 'yes')])).toBeNull();
    expect(fillTabElementOf([note('n'), board('a', true), board('b', true)])).toEqual({
      id: 'a',
      kind: 'Board',
    });
    expect(fillTabElementOf([board('a'), board('b', true)])).toEqual({ id: 'b', kind: 'Board' });
    expect(fillTabElementOf([sheet('s'), sheet('t', true), board('b', true)])).toEqual({
      id: 't',
      kind: 'Sheet',
    });
    expect(fillTabElementOf([])).toBeNull();
  });
});

describe('a Visualisation tab', () => {
  // docs/specs/026-plan/plan-tabs.md "A row that fills the page".
  const view = (id: string, v: string) =>
    ({ id, type: 'shape', shape: 'plan-view', planView: { view: v } }) as unknown as Element;
  const solo = (elementId: string, fill = true) => ({
    rows: [
      {
        id: 'r',
        height: 320,
        ...(fill ? { fill: true as const } : {}),
        slots: [{ id: 's', span: 12, content: { type: 'element' as const, elementId } }],
      },
    ],
  });

  it('fills the tab with its one chart, as a Board tab with its board', () => {
    expect(fillTabElementOf([view('g', 'gantt')], 'dashboard', solo('g'))).toEqual({
      id: 'g',
      kind: 'View',
    });
  });

  it('is an ordinary Dashboard without a filling row, with a metric, or with more', () => {
    expect(fillTabElementOf([view('g', 'gantt')], 'dashboard', solo('g', false))).toBeNull();
    expect(fillTabElementOf([view('m', 'metric:count')], 'dashboard', solo('m'))).toBeNull();
    expect(fillTabElementOf([view('g', 'gantt')], 'dashboard', undefined)).toBeNull();
  });
});

// docs/specs/026-plan/plan-tabs.md "A row that fills the page": a stored layout is read safely.
describe('a Visualisation tab with a malformed stored layout', () => {
  it('fills nothing, never throwing', () => {
    for (const bad of [{ rows: [{ fill: true }] }, {}, { rows: 'x' }]) {
      const layout = bad as unknown as Parameters<typeof fillTabElementOf>[2];
      expect(fillTabElementOf([], 'dashboard', layout)).toBeNull();
    }
  });
});
