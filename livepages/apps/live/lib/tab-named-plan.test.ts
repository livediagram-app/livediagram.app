import { describe, expect, it } from 'vitest';
import { createShape, defaultTabName, isDefaultTabName, type Element } from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import {
  boardTitleForTab,
  boardsRenamedWithTab,
  sheetIdsOn,
  tabNameFromPlan,
  tabNamedForBoard,
  tabNamedForSheet,
  tabNamedForView,
  viewsTitled,
} from './tab-named-plan';

// docs/specs/026-plan/plan-board.md "The board set-up": a board takes its tab's name, and one still carrying the
// tab's default name follows the tab when it is renamed away from it.
const board = (id: string, title: string) =>
  ({
    ...createShape('plan-board', 0, 0),
    id,
    planBoard: { ...presetSetup('kanban'), title },
  }) as Element;
const titles = (els: Element[]) =>
  els.map((e) => (e.type === 'shape' ? e.planBoard?.title : undefined));

describe('default tab names', () => {
  it('knows "Tab N" and nothing else', () => {
    expect(defaultTabName(3)).toBe('Tab 3');
    expect(isDefaultTabName('Tab 12')).toBe(true);
    expect(isDefaultTabName(' Tab 1 ')).toBe(true);
    expect(isDefaultTabName('Tab')).toBe(false);
    expect(isDefaultTabName('Roadmap')).toBe(false);
    expect(isDefaultTabName('Tab 1 copy')).toBe(false);
  });
});

describe('boards named after their tab', () => {
  it('take the tab’s name, else the preset’s own', () => {
    expect(boardTitleForTab('Roadmap', 'Kanban')).toBe('Roadmap');
    expect(boardTitleForTab('  ', 'Kanban')).toBe('Kanban');
    expect(boardTitleForTab(undefined, 'Kanban')).toBe('Kanban');
    expect(boardTitleForTab('x'.repeat(200), 'Kanban')).toHaveLength(80);
  });

  it('follow a tab renamed away from its default name, only when titled that', () => {
    const els = [board('a', 'Tab 2'), board('b', 'Kanban'), { ...createShape('square', 0, 0) }];
    expect(titles(boardsRenamedWithTab(els, 'Tab 2', 'Launch'))).toEqual([
      'Launch',
      'Kanban',
      undefined,
    ]);
  });

  it('stay as they are when the tab had a name of its own, or nothing matches', () => {
    const els = [board('a', 'Roadmap')];
    expect(boardsRenamedWithTab(els, 'Roadmap', 'Launch')).toBe(els);
    const other = [board('a', 'Kanban')];
    expect(boardsRenamedWithTab(other, 'Tab 1', 'Launch')).toBe(other);
  });

  it('lists the Sheets on a tab by sheet id', () => {
    const sheet = { ...createShape('plan-sheet', 0, 0), planSheet: { sheetId: 'sh1' } } as Element;
    expect(sheetIdsOn([sheet, board('a', 'Tab 1')])).toEqual(['sh1']);
  });
});

describe('a Board tab’s board', () => {
  it('takes the tab’s name whatever it was called', async () => {
    const { boardsTitled } = await import('./tab-named-plan');
    const board = {
      id: 'b',
      type: 'shape',
      shape: 'plan-board',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      planBoard: { title: 'Kanban', columns: [] },
    } as unknown as Element;
    const out = boardsTitled([board], 'Launch');
    expect((out[0] as { planBoard: { title: string } }).planBoard.title).toBe('Launch');
    expect(boardsTitled(out, 'Launch')).toBe(out);
  });
});

describe('a Board or Sheet tab and its board or Sheet share one name', () => {
  // docs/specs/026-plan/plan-tabs.md "Names".
  const board = (title: string) =>
    ({ id: 'b', type: 'shape', shape: 'plan-board', planBoard: { title } }) as unknown as Element;
  const sheet = (sheetId: string) =>
    ({ id: 's', type: 'shape', shape: 'plan-sheet', planSheet: { sheetId } }) as unknown as Element;

  it('titles a board placed on a default-named tab by its preset, not "Tab 2"', () => {
    expect(boardTitleForTab('Tab 2', 'Bug Tracker')).toBe('Bug Tracker');
    expect(boardTitleForTab('Launch', 'Bug Tracker')).toBe('Launch');
  });

  it('names a default-named tab after the board or Sheet filling it, and leaves a named one', () => {
    expect(
      tabNameFromPlan({ name: 'Tab 2', elements: [board('Bug Tracker')] }, () => undefined),
    ).toBe('Bug Tracker');
    expect(tabNameFromPlan({ name: 'Tab 2', elements: [sheet('x')] }, () => 'Budget')).toBe(
      'Budget',
    );
    expect(
      tabNameFromPlan({ name: 'Mine', elements: [board('Bug Tracker')] }, () => undefined),
    ).toBeNull();
  });

  it('renames a Board tab when its board is renamed, and only a Board tab', () => {
    expect(tabNamedForBoard({ kind: 'board', name: 'Old' }, ' Bugs ').name).toBe('Bugs');
    const diagram = { kind: 'diagram', name: 'Old' };
    expect(tabNamedForBoard(diagram, 'Bugs')).toBe(diagram);
    const same = { kind: 'board', name: 'Bugs' };
    expect(tabNamedForBoard(same, 'Bugs')).toBe(same);
    expect(tabNamedForBoard({ kind: 'board', name: 'Old' }, '  ').name).toBe('Old');
  });

  it('renames a Sheet tab when the sheet filling it is renamed', () => {
    const tab = { kind: 'sheet', name: 'Old', elements: [sheet('x')] };
    expect(tabNamedForSheet(tab, 'x', 'Costs').name).toBe('Costs');
    expect(tabNamedForSheet(tab, 'other', 'Costs')).toBe(tab);
  });
});

describe('a Visualisation tab and its chart share one name', () => {
  // docs/specs/026-plan/plan-tabs.md "Names".
  const tab = (name = 'Gantt Chart') => ({
    name,
    kind: 'dashboard',
    elements: [
      { id: 'g', type: 'shape', shape: 'plan-view', planView: { view: 'gantt' } },
    ] as unknown as Element[],
    dashboard: {
      rows: [
        {
          id: 'r',
          height: 320,
          fill: true as const,
          slots: [{ id: 's', span: 12, content: { type: 'element' as const, elementId: 'g' } }],
        },
      ],
    },
  });

  it('titles the chart when the tab is renamed', () => {
    const els = viewsTitled(tab(), 'Launch Plan');
    expect((els[0] as { planView: { title?: string } }).planView.title).toBe('Launch Plan');
  });

  it('names the tab when the chart is titled, and only for its own chart', () => {
    expect(tabNamedForView(tab(), 'g', 'Launch Plan').name).toBe('Launch Plan');
    expect(tabNamedForView(tab(), 'other', 'Launch Plan').name).toBe('Gantt Chart');
    expect(tabNamedForView({ ...tab(), dashboard: { rows: [] } }, 'g', 'Launch Plan').name).toBe(
      'Gantt Chart',
    );
  });
});
