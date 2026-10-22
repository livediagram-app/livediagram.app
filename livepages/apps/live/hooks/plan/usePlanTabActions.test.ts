// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Tab } from '@livepages/document';
import { dashboardOf, withSlotContent } from './usePlanTabActions';
import { dashboardElement, dashboardViewElement } from './slot-elements';
import { dashboardItemOf } from './dashboard-drop';

// docs/specs/026-plan/plan-tabs.md "Dashboard tab".
const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 'd',
  name: 'Overview',
  kind: 'dashboard',
  elements: [],
  ...over,
});

describe('a Dashboard slot', () => {
  it('takes a plan view as an element on the tab, and drops it again when cleared', () => {
    const stored = tab();
    const d = { ...stored, dashboard: dashboardOf(stored) };
    const slot = d.dashboard.rows[0]!.slots[0]!.id;
    const view = dashboardViewElement('gantt');
    const filled = withSlotContent(d, slot, { type: 'element', elementId: view.id }, view);
    expect(filled.elements.map((e) => e.id)).toEqual([view.id]);
    const cleared = withSlotContent(filled, slot, undefined);
    expect(cleared.elements).toEqual([]);
    expect(dashboardOf(cleared).rows[0]!.slots[0]!.content).toBeUndefined();
  });

  it('makes a board or Sheet of the dashboard itself for a board or Sheet tile', () => {
    expect(dashboardElement({ kind: 'board', preset: 'kanban' })).toMatchObject({
      shape: 'plan-board',
    });
    expect(dashboardElement({ kind: 'sheet' })).toMatchObject({ shape: 'plan-sheet' });
    expect(dashboardElement({ kind: 'view', view: 'gantt' })).toMatchObject({ shape: 'plan-view' });
  });

  it('knows which palette tiles a slot takes', () => {
    expect(dashboardItemOf('plan-view', 'metric:count')).toEqual({
      kind: 'view',
      view: 'metric:count',
    });
    expect(dashboardItemOf('plan-board', 'kanban')).toEqual({ kind: 'board', preset: 'kanban' });
    expect(dashboardItemOf('sticky')).toEqual({ kind: 'note' });
    expect(dashboardItemOf('plan-view', 'sheet:chart')).toEqual({ kind: 'sheet-chart' });
    expect(dashboardItemOf('plan-view', 'sheet:trend')).toEqual({
      kind: 'sheet-metric',
      metric: 'trend',
    });
    expect(dashboardItemOf('square')).toBeNull();
    expect(dashboardItemOf('plan-view')).toBeNull();
  });
});

describe('the zone a moved slot goes to', () => {
  it('swaps over a slot’s middle, takes a gap at its side, and makes a row off every row', async () => {
    const { dashboardMoveZone } = await import('./dashboard-drop');
    const box = (left: number, top: number, right: number, bottom: number) => ({
      left,
      top,
      right,
      bottom,
    });
    const geo = {
      rows: [
        {
          id: 'r0',
          box: box(0, 0, 1000, 200),
          slots: [
            { id: 'a', box: box(0, 0, 494, 200) },
            { id: 'b', box: box(506, 0, 1000, 200) },
          ],
        },
      ],
    };
    expect(dashboardMoveZone(geo, 750, 100, 'a')).toEqual({ kind: 'slot', slotId: 'b' });
    expect(dashboardMoveZone(geo, 250, 100, 'a')).toBeNull();
    expect(dashboardMoveZone(geo, 980, 100, 'a')).toEqual({
      kind: 'slot-gap',
      rowId: 'r0',
      index: 2,
    });
    expect(dashboardMoveZone(geo, 500, 100, 'a')).toEqual({
      kind: 'slot-gap',
      rowId: 'r0',
      index: 1,
    });
    expect(dashboardMoveZone(geo, 300, 5, 'a')).toEqual({ kind: 'row-gap', index: 0 });
    expect(dashboardMoveZone(geo, 300, 400, 'a')).toEqual({ kind: 'row-gap', index: 1 });
  });
});

describe('the Tabs category', () => {
  it('lists the Board, Sheet and Diagram tabs (never a Dashboard), and a tile’s choice is a tab slot', async () => {
    const { planTabEntries } = await import('./plan-tab-list-store');
    const { dashboardItemOf, dashboardTabChoice } = await import('./dashboard-drop');
    const { dashboardTabTiles } = await import('@/components/palette/palette-dashboard-tiles');
    const tabs = [
      { id: 'a', name: 'Launch', kind: 'board', elements: [] },
      { id: 'b', name: 'Flow', kind: 'dashboard', elements: [] },
      { id: 'c', name: 'Budget', kind: 'sheet', elements: [] },
      { id: 'd', name: 'Notes', elements: [] },
    ] as unknown as Parameters<typeof planTabEntries>[0];
    const entries = planTabEntries(tabs);
    expect(entries).toEqual([
      { id: 'a', name: 'Launch', of: 'board' },
      { id: 'c', name: 'Budget', of: 'sheet' },
      { id: 'd', name: 'Notes', of: 'diagram' },
    ]);
    const tiles = dashboardTabTiles(entries);
    expect(tiles.map((t) => t.caption)).toEqual(['Launch', 'Budget', 'Notes']);
    expect(dashboardItemOf('plan-view', dashboardTabChoice('diagram', 'd'))).toEqual({
      kind: 'tab',
      tabId: 'd',
      of: 'diagram',
    });
    expect(dashboardItemOf('plan-view', dashboardTabChoice('sheet', 'c'))).toEqual({
      kind: 'tab',
      tabId: 'c',
      of: 'sheet',
    });
    expect(dashboardItemOf('plan-view', 'tab:nope')).toBeNull();
  });
});

describe('what fits a slot', () => {
  const box = (left: number, top: number, right: number, bottom: number) => ({
    left,
    top,
    right,
    bottom,
  });
  const geo = {
    rows: [
      {
        id: 'short',
        box: box(0, 0, 1000, 160),
        slots: [
          { id: 'a', box: box(0, 0, 494, 160) },
          { id: 'b', box: box(506, 0, 1000, 160) },
        ],
      },
      {
        id: 'tall',
        box: box(0, 172, 1000, 732),
        slots: [{ id: 'c', box: box(0, 172, 1000, 732) }],
      },
    ],
  };

  it('lands a board only in a slot big enough to draw it, a metric anywhere', async () => {
    const { dashboardZone } = await import('./dashboard-drop');
    expect(dashboardZone({ kind: 'board' }, geo, 200, 80)).toBeNull();
    expect(dashboardZone({ kind: 'board' }, geo, 200, 400)).toEqual({ kind: 'slot', slotId: 'c' });
    expect(dashboardZone({ kind: 'view', view: 'metric:count' }, geo, 200, 80)).toEqual({
      kind: 'slot',
      slotId: 'a',
    });
  });

  it('offers a pressed tile every place it could go', async () => {
    const { dashboardCandidates } = await import('./dashboard-drop');
    expect(dashboardCandidates({ kind: 'board' }, geo, 4)).toEqual([{ kind: 'slot', slotId: 'c' }]);
    expect(dashboardCandidates({ kind: 'row', height: 160, slots: 4 }, geo, 4)).toHaveLength(3);
    expect(dashboardCandidates({ kind: 'slot' }, geo, 2).map((z) => z.kind)).toEqual([
      'slot-gap',
      'slot-gap',
      'row-gap',
      'row-gap',
      'row-gap',
    ]);
  });
});

describe('a Sheet made in a Dashboard slot', () => {
  // docs/specs/026-plan/plan-tabs.md "Slot content": straight to work, never through Setup Sheet.
  it('is a blank grid, or set up from its template; a Card Table still asks which cards', async () => {
    const { takePlacedSheet } = await import('@/lib/sheet-seeds');
    const placed = (start?: string) => {
      const el = dashboardElement({ kind: 'sheet', start }) as { planSheet: { sheetId: string } };
      return takePlacedSheet(el.planSheet.sheetId);
    };
    expect(placed()).toMatchObject({ blank: true });
    expect(placed('budget')).toMatchObject({ setUp: 'budget' });
    expect(placed('tracker')).toMatchObject({ setUp: 'tracker' });
    expect(placed('loan')).toMatchObject({ setUp: 'loan' });
    expect(placed('mystery')).toMatchObject({ blank: true });
    expect(placed('cards')).toMatchObject({ start: 'cards' });
  });
});

// docs/specs/026-plan/plan-tabs.md "Names": a Visualisation tab and its chart share one name.
describe('a Visualisation tab started', () => {
  const start = async (name: string) => {
    const { renderHook } = await import('@testing-library/react');
    const { usePlanTabActions } = await import('./usePlanTabActions');
    let tabs: Tab[] = [{ id: 'v', name, elements: [] }];
    const commitTabs = (map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    };
    const { result } = renderHook(() =>
      usePlanTabActions({ activeId: 'v', commitTabs, tickTabs: commitTabs }),
    );
    result.current.startVisualisationTab('gantt', 'Gantt Chart');
    const chart = tabs[0]!.elements[0] as unknown as { planView: { title?: string } };
    return { tab: tabs[0]!, title: chart.planView.title };
  };

  it("gives a tab's own name to its chart", async () => {
    const { tab, title } = await start('Launch Plan');
    expect(tab.name).toBe('Launch Plan');
    expect(title).toBe('Launch Plan');
  });

  it("names a default-named tab after the view, the chart keeping the view's name", async () => {
    const { tab, title } = await start('Tab 2');
    expect(tab.name).toBe('Gantt Chart');
    expect(title).toBeUndefined();
  });
});
