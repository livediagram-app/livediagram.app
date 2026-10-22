// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ShapeElement, Tab } from '@livedesign/document';
import { usePlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { dashboardTabTiles } from '@/components/palette/palette-dashboard-tiles';
import { slotFillSections, slotItemOfTile, tooBigLine } from './SlotFillPicker';

// docs/specs/026-plan/plan-tabs.md "Filling a slot".
describe('Add to Slot', () => {
  it('offers the tabs first, then new boards, a sheet, metrics, visualisations and a note', () => {
    const { sections } = slotFillSections(
      dashboardTabTiles([{ id: 't', name: 'Launch', of: 'board' }]),
    );
    expect(sections.map((s) => s.title)).toEqual([
      'This Document’s Tabs',
      'New Board',
      'New Sheet',
      'Card Metrics',
      'Visualisations',
      'From a Sheet',
      'Utilities',
    ]);
    expect(slotItemOfTile(sections[0]!.tiles[0]!)).toEqual({
      kind: 'tab',
      tabId: 't',
      of: 'board',
    });
    expect(slotItemOfTile(sections.at(-1)!.tiles[0]!)).toEqual({ kind: 'note' });
    for (const s of sections) for (const t of s.tiles) expect(slotItemOfTile(t)).not.toBeNull();
  });

  it('leaves the tabs out while the document has none', () => {
    expect(slotFillSections([]).sections[0]!.title).toBe('New Board');
  });

  it('offers a short slot only what looks good in it, and says what needs more room', () => {
    const tabs = dashboardTabTiles([{ id: 't', name: 'Launch', of: 'board' }]);
    const { sections, tooBig } = slotFillSections(tabs, { width: 300, height: 160 });
    expect(sections.map((s) => s.title)).toEqual(['Card Metrics', 'From a Sheet', 'Utilities']);
    expect(tooBig).toEqual(['board', 'sheet', 'chart']);
    expect(tooBigLine(tooBig)).toBe(
      'Boards, sheets and charts need a bigger slot: drag the row’s lower edge to make it taller.',
    );
  });

  it('offers a tall, narrow slot sheets and charts but not boards', () => {
    const { sections, tooBig } = slotFillSections([], { width: 320, height: 400 });
    expect(sections.map((s) => s.title)).toEqual([
      'New Sheet',
      'Card Metrics',
      'Visualisations',
      'From a Sheet',
      'Utilities',
    ]);
    expect(tooBig).toEqual(['board']);
  });

  it('offers a big slot everything, with nothing to say', () => {
    const { tooBig } = slotFillSections([], { width: 800, height: 560 });
    expect(tooBigLine(tooBig)).toBeNull();
  });
});

describe('starting a Dashboard', () => {
  const run = (name: string) => {
    let tabs: Tab[] = [{ id: 'a', name, elements: [] }];
    const commit = (map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    };
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'a', commitTabs: commit, tickTabs: commit }),
    );
    act(() => result.current.startDashboard('two-by-two'));
    return tabs[0]!;
  };

  it('names a tab still on its default name Dashboard, and keeps a name someone gave it', () => {
    expect(run('Tab 5')).toMatchObject({ name: 'Dashboard', kind: 'dashboard' });
    expect(run('Q3 Overview').name).toBe('Q3 Overview');
  });
});

describe('a Title', () => {
  it('is offered under Utilities, and placed starts as the dashboard’s name', () => {
    const { sections } = slotFillSections([], { width: 200, height: 120 });
    const cards = sections.find((s) => s.title === 'Utilities')!;
    expect(cards.tiles.map((t) => slotItemOfTile(t))).toEqual([
      { kind: 'note' },
      { kind: 'card', card: 'title' },
      { kind: 'card', card: 'status' },
      { kind: 'card', card: 'checklist' },
      { kind: 'card', card: 'key-date' },
      { kind: 'card', card: 'links' },
    ]);
    let tabs: Tab[] = [
      { id: 'a', name: 'Q3 Overview', elements: [], kind: 'dashboard' } as unknown as Tab,
    ];
    const commit = (map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    };
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'a', commitTabs: commit, tickTabs: commit }),
    );
    act(() => result.current.placeItem({ kind: 'card', card: 'title' }, null));
    const slots = tabs[0]!.dashboard!.rows.flatMap((r) => r.slots);
    expect(slots.find((s) => s.content)?.content).toEqual({
      type: 'title',
      title: 'Q3 Overview',
      text: '',
    });
  });
});

// docs/specs/026-plan/plan-tabs.md "Sheet Chart".
describe('a Sheet Chart', () => {
  const fromASheet = (size: { width: number; height: number }) =>
    slotFillSections([], size)
      .sections.find((s) => s.title === 'From a Sheet')!
      .tiles.map((t) => slotItemOfTile(t));

  it('is offered From a Sheet only where a chart fits', () => {
    expect(fromASheet({ width: 300, height: 220 })).toContainEqual({ kind: 'sheet-chart' });
    expect(fromASheet({ width: 300, height: 160 })).not.toContainEqual({ kind: 'sheet-chart' });
  });

  it('fills its slot only once chosen, as an element of the dashboard reading its sheet', () => {
    let tabs: Tab[] = [{ id: 'a', name: 'D', elements: [], kind: 'dashboard' } as unknown as Tab];
    const commit = vi.fn((map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    });
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'a', commitTabs: commit, tickTabs: commit }),
    );
    act(() => result.current.placeItem({ kind: 'sheet-chart' }, null));
    expect(commit).not.toHaveBeenCalled();
    const chart = {
      id: 'ch',
      type: 'shape',
      shape: 'bar-chart',
      x: 0,
      y: 0,
      width: 260,
      height: 220,
      chartSource: { sheetId: 'sheetAAAA', range: { r1: 'a', c1: 'b', r2: 'c', c2: 'd' } },
    } as ShapeElement;
    act(() => result.current.placeItem({ kind: 'sheet-chart', chart }, null));
    const slots = tabs[0]!.dashboard!.rows.flatMap((r) => r.slots);
    expect(slots.find((s) => s.content)?.content).toEqual({ type: 'element', elementId: 'ch' });
    expect(tabs[0]!.elements).toEqual([chart]);
  });
});

describe('starting a Board tab', () => {
  // docs/specs/026-plan/plan-tabs.md "Names": a default-named tab takes its board's name; a named one keeps its own.
  const start = (name: string) => {
    let tabs: Tab[] = [{ id: 'a', name, elements: [] }];
    const commit = (map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    };
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'a', commitTabs: commit, tickTabs: commit }),
    );
    act(() =>
      result.current.startElementTab('board', () =>
        commit((ts) =>
          ts.map((t) => ({
            ...t,
            elements: [
              {
                id: 'b',
                type: 'shape',
                shape: 'plan-board',
                planBoard: { title: 'Bug Tracker', cardSize: 'compact' },
              } as unknown as Tab['elements'][number],
            ],
          })),
        ),
      ),
    );
    return tabs[0]!;
  };

  it('names a Tab 2 after its board, whose cards start Detailed as it fills the screen', () => {
    const tab = start('Tab 2');
    expect(tab).toMatchObject({ name: 'Bug Tracker', kind: 'board' });
    const board = tab.elements[0] as { planBoard?: { cardSize?: string } };
    expect(board.planBoard?.cardSize).toBeUndefined();
    expect(start('Release').name).toBe('Release');
  });
});

describe('a suggested Dashboard made on a tab', () => {
  // docs/specs/026-plan/plan-mode.md "Starting a board": a Dashboard built from the document's own work.
  it('makes its views as elements in their slots, shows its tabs, and names a default-named tab', () => {
    let tabs: Tab[] = [{ id: 'a', name: 'Tab 3', elements: [] }];
    const commit = (map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    };
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'a', commitTabs: commit, tickTabs: commit }),
    );
    act(() =>
      result.current.startSuggestedDashboard({
        id: 'timeline:r',
        name: 'Roadmap Timeline',
        line: '',
        holds: [],
        rows: [
          { height: 160, slots: [{ span: 12, view: 'metric:progress' }] },
          { height: 520, slots: [{ span: 12, tab: { tabId: 'r', of: 'board' } }] },
        ],
      }),
    );
    const tab = tabs[0]!;
    expect(tab).toMatchObject({ name: 'Roadmap Timeline', kind: 'dashboard' });
    const [metricRow, boardRow] = tab.dashboard!.rows;
    const content = metricRow!.slots[0]!.content!;
    expect(content.type === 'element' && tab.elements.some((e) => e.id === content.elementId)).toBe(
      true,
    );
    expect(boardRow!.slots[0]!.content).toEqual({ type: 'tab', tabId: 'r', of: 'board' });
  });
});

describe('a Visualisation tab', () => {
  // docs/specs/026-plan/plan-tabs.md "A row that fills the page".
  it('is a Dashboard of one row filling the page, holding the chart', () => {
    let tabs: Tab[] = [{ id: 'a', name: 'Tab 2', elements: [] }];
    const commit = (map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    };
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'a', commitTabs: commit, tickTabs: commit }),
    );
    act(() => result.current.startVisualisationTab('gantt', 'Gantt Chart'));
    const tab = tabs[0]!;
    expect(tab).toMatchObject({ name: 'Gantt Chart', kind: 'dashboard' });
    const row = tab.dashboard!.rows[0]!;
    expect(row.fill).toBe(true);
    expect(row.slots).toHaveLength(1);
    const view = tab.elements[0] as { planView?: { view: string } };
    expect(view.planView?.view).toBe('gantt');
  });

  // The user's call (2026-10-15): figures from a form, offered only while the document has one.
  it('offers Form Metrics only when the document has a form', () => {
    const titles = (hasForms: boolean) =>
      slotFillSections([], null, hasForms).sections.map((s) => s.title);
    expect(titles(false)).not.toContain('Form Metrics');
    expect(titles(true)).toContain('Form Metrics');
    const form = slotFillSections([], null, true).sections.find((s) => s.title === 'Form Metrics')!;
    expect(form.tiles.map((t) => t.caption)).toEqual([
      'Responses',
      'New Responses',
      'Form Status',
      'Response Limit',
      'Closes',
      'Form Link',
    ]);
  });
});
