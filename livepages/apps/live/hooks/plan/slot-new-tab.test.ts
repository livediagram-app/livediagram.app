// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { freshBoardSetup } from '@livepages/items';
import type { Tab } from '@livepages/document';
import { placedSheetTitle } from '@/lib/sheet-seeds';
import { usePlanTabActions, withSlotContent, dashboardOf } from './usePlanTabActions';
import { newSlotTab, withLookOf } from './slot-elements';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/plan-tabs.md "Filling a slot": a new board or Sheet picked for a slot is a Board or Sheet tab of
// its own, made as Start Planning makes one, placed after the dashboard, and shown in the slot, all in one step.
type El = { type: string; shape?: string; planBoard?: { title: string; cardSize?: string } };

function setup(extra: Tab[] = []) {
  let tabs: Tab[] = [
    {
      id: 'd',
      name: 'Overview',
      kind: 'dashboard',
      opensIn: 'plan',
      theme: 'ocean',
      font: 'serif',
      elements: [],
      dashboard: dashboardOf(undefined),
    } as unknown as Tab,
    ...extra,
  ];
  const commits: number[] = [];
  const commit = (map: (ts: Tab[]) => Tab[]) => {
    commits.push(1);
    tabs = map(tabs);
  };
  const bringCardTypes = vi.fn();
  const markTabLoaded = vi.fn();
  const { result } = renderHook(() =>
    usePlanTabActions({
      activeId: 'd',
      commitTabs: commit,
      tickTabs: commit,
      bringCardTypes,
      markTabLoaded,
    }),
  );
  return { result, tabs: () => tabs, commits, bringCardTypes, markTabLoaded };
}

const slotsOf = (t: Tab) => dashboardOf(t).rows.flatMap((r) => r.slots);

describe('a new board picked for a slot', () => {
  it('makes a Board tab after the dashboard, named after its board, and shows it in the slot, in one step', () => {
    const s = setup([{ id: 'z', name: 'Later', elements: [] }]);
    act(() => s.result.current.placeItem({ kind: 'board', preset: 'kanban' }, null));
    const [dash, made, later] = s.tabs();
    expect(s.commits).toHaveLength(1);
    expect(later!.id).toBe('z');
    expect(made).toMatchObject({
      kind: 'board',
      opensIn: 'plan',
      name: freshBoardSetup('kanban').title,
      // The dashboard's look, as a new tab takes the active tab's.
      theme: 'ocean',
      font: 'serif',
    });
    expect(made!.elements).toHaveLength(1);
    const board = made!.elements[0] as unknown as El;
    expect(board.shape).toBe('plan-board');
    // A board filling its tab draws its cards Detailed.
    expect(board.planBoard?.cardSize).toBeUndefined();
    // The dashboard holds no element for it: the slot shows the tab.
    expect(dash!.elements).toEqual([]);
    expect(slotsOf(dash!).find((x) => x.content)?.content).toEqual({
      type: 'tab',
      tabId: made!.id,
      of: 'board',
    });
  });

  it('brings its preset’s card types and marks its tab loaded', () => {
    const s = setup();
    act(() => s.result.current.placeItem({ kind: 'board', preset: 'kanban' }, null));
    const made = s.tabs()[1]!;
    expect(s.bringCardTypes).toHaveBeenCalledWith(made.elements);
    expect(s.markTabLoaded).toHaveBeenCalledWith(made.id);
  });

  it('fills the slot it was dropped on, replacing what it held', () => {
    const s = setup();
    const first = slotsOf(s.tabs()[0]!)[0]!.id;
    act(() => s.result.current.placeItem({ kind: 'note' }, { kind: 'slot', slotId: first }));
    const target = slotsOf(s.tabs()[0]!)[1]!.id;
    act(() => s.result.current.placeItem({ kind: 'board' }, { kind: 'slot', slotId: target }));
    const slot = slotsOf(s.tabs()[0]!).find((x) => x.id === target)!;
    expect(slot.content).toMatchObject({ type: 'tab', of: 'board', tabId: s.tabs()[1]!.id });
    expect(slotsOf(s.tabs()[0]!)[0]!.content).toMatchObject({ type: 'note' });
  });
});

describe('a new Sheet picked for a slot', () => {
  it('makes a Sheet tab named as Start Planning names it, shown in the slot', () => {
    const s = setup();
    act(() => s.result.current.placeItem({ kind: 'sheet', start: 'budget' }, null));
    const [dash, made] = s.tabs();
    expect(made).toMatchObject({ kind: 'sheet', opensIn: 'plan', name: 'Budget' });
    const sheet = made!.elements[0] as unknown as { shape: string; planSheet: { sheetId: string } };
    expect(sheet.shape).toBe('plan-sheet');
    expect(placedSheetTitle(sheet.planSheet.sheetId)).toBe('Budget');
    expect(slotsOf(dash!).find((x) => x.content)?.content).toEqual({
      type: 'tab',
      tabId: made!.id,
      of: 'sheet',
    });
  });

  it('names an empty one "Sheet"', () => {
    expect(newSlotTab({ kind: 'sheet' }).name).toBe('Sheet');
  });
});

describe('a dashboard made before slots made tabs', () => {
  it('keeps drawing and clearing a board element in a slot', () => {
    const board = {
      id: 'b',
      type: 'shape',
      shape: 'plan-board',
    } as unknown as Tab['elements'][number];
    const stored = { id: 'd', name: 'Old', kind: 'dashboard', elements: [] } as unknown as Tab;
    const d = { ...stored, dashboard: dashboardOf(stored) };
    const slot = d.dashboard.rows[0]!.slots[0]!.id;
    const filled = withSlotContent(d, slot, { type: 'element', elementId: 'b' }, board);
    expect(filled.elements).toEqual([board]);
    expect(withSlotContent(filled, slot, undefined).elements).toEqual([]);
  });
});

describe('withLookOf', () => {
  it('takes the dashboard’s look but keeps its own id, name and kind', () => {
    const made = newSlotTab({ kind: 'board' });
    const looked = withLookOf(made, {
      id: 'd',
      name: 'Overview',
      theme: 'ocean',
      elements: [],
    });
    expect(looked).toMatchObject({ id: made.id, name: made.name, kind: 'board', theme: 'ocean' });
  });
});
