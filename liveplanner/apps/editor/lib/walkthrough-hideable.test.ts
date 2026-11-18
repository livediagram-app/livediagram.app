// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  selectedCardIds,
  tabHasHideable,
  useWalkthroughHideable,
  WALKTHROUGH_HIDE_MARKS,
  type HideableTab,
} from './walkthrough-hideable';
import { useRegisterShownCards } from '../hooks/plan/board-shown-store';

const dashboard = (filled: boolean): HideableTab => ({
  kind: 'dashboard',
  elements: [],
  dashboard: {
    rows: [
      {
        id: 'r1',
        height: 1,
        slots: [
          { id: 's1', span: 6 },
          filled
            ? { id: 's2', span: 6, content: { kind: 'note' } as never }
            : { id: 's2', span: 6 },
        ],
      },
    ],
  },
});

describe('what a walkthrough can hide on each tab', () => {
  it('is any element on a canvas tab, and nothing on an empty one', () => {
    expect(tabHasHideable({ elements: [{}] }, 0)).toBe(true);
    expect(tabHasHideable({ kind: 'diagram', elements: [] }, 5)).toBe(false);
  });

  it('is the cards on a Board tab', () => {
    expect(tabHasHideable({ kind: 'board', elements: [{}] }, 3)).toBe(true);
    expect(tabHasHideable({ kind: 'board', elements: [{}] }, 0)).toBe(false);
  });

  it('is the filled slots on a Dashboard tab', () => {
    expect(tabHasHideable(dashboard(true), 0)).toBe(true);
    expect(tabHasHideable(dashboard(false), 0)).toBe(false);
    expect(tabHasHideable({ kind: 'dashboard', elements: [] }, 0)).toBe(false);
  });

  it('is nothing on a Visualisation tab, whose one view fills it', () => {
    const view = { id: 'v', type: 'shape', shape: 'plan-view', planView: { view: 'gantt' } };
    const solo = (elements: unknown[]): HideableTab => ({
      kind: 'dashboard',
      elements,
      dashboard: {
        rows: [
          {
            id: 'r',
            height: 1,
            fill: true,
            slots: [{ id: 's', span: 12, content: { type: 'element', elementId: 'v' } as never }],
          },
        ],
      } as never,
    });
    expect(tabHasHideable(solo([view]), 9)).toBe(false);
  });

  it('is the cards of a board filling a canvas tab, and nothing under a Sheet filling it', () => {
    const board = { id: 'b', type: 'shape', shape: 'plan-board', planBoard: { fillTab: true } };
    const sheet = { id: 's', type: 'shape', shape: 'plan-sheet', planSheet: { fillTab: true } };
    expect(tabHasHideable({ kind: 'diagram', elements: [board, {}] }, 2)).toBe(true);
    expect(tabHasHideable({ kind: 'diagram', elements: [board, {}] }, 0)).toBe(false);
    expect(tabHasHideable({ kind: 'diagram', elements: [sheet, {}] }, 2)).toBe(false);
  });

  it("is the cards a Board tab's board shows after its filter, the plan's cards until it says", () => {
    const board: HideableTab = {
      kind: 'board',
      elements: [{ id: 'b', type: 'shape', shape: 'plan-board' }],
    };
    // Filtered down to nothing: nothing to hide, however many cards the plan holds.
    expect(tabHasHideable(board, 7, { elementId: 'b', any: false })).toBe(false);
    expect(tabHasHideable(board, 7, { elementId: 'b', any: true })).toBe(true);
    // Another board's word, or none yet: the plan's cards stand in.
    expect(tabHasHideable(board, 7, { elementId: 'other', any: false })).toBe(true);
    expect(tabHasHideable(board, 0, null)).toBe(false);
  });

  it('is nothing on a Sheet or a Form tab', () => {
    expect(tabHasHideable({ kind: 'sheet', elements: [{}] }, 9)).toBe(false);
    expect(tabHasHideable({ kind: 'form', elements: [{}] }, 9)).toBe(false);
  });
});

describe('the host hand-off', () => {
  it('reads the selected cards, once each', () => {
    document.body.innerHTML =
      '<div data-plan-card="a" data-selected="true"></div><div data-plan-card="b"></div>' +
      '<div data-plan-card="a" data-selected="true"></div><div data-plan-card="" data-selected="true"></div>';
    expect(selectedCardIds()).toEqual(['a']);
    document.body.innerHTML = '';
  });

  it('names the card and slot marks, and answers for the tab showing', () => {
    const sheet: HideableTab = { kind: 'sheet', elements: [] };
    const { result, rerender } = renderHook(
      ({ tab }: { tab: HideableTab }) => useWalkthroughHideable(tab, 2),
      { initialProps: { tab: sheet } },
    );
    expect(result.current.marks).toBe(WALKTHROUGH_HIDE_MARKS);
    expect(result.current.canHide()).toBe(false);
    expect(result.current.selection?.()).toEqual([]);
    rerender({ tab: { kind: 'board', elements: [] } });
    expect(result.current.canHide()).toBe(true);
  });

  it("leaves Hide out when the Board tab's board is filtered to no cards, and brings it back", () => {
    const tab: HideableTab = {
      kind: 'board',
      elements: [{ id: 'b', type: 'shape', shape: 'plan-board' }],
    };
    const { result, rerender } = renderHook(
      ({ any, on }: { any: boolean; on: boolean }) => {
        useRegisterShownCards('b', any, on);
        return useWalkthroughHideable(tab, 5);
      },
      { initialProps: { any: true, on: true } },
    );
    expect(result.current.canHide()).toBe(true);
    rerender({ any: false, on: true });
    expect(result.current.canHide()).toBe(false);
    rerender({ any: true, on: true });
    expect(result.current.canHide()).toBe(true);
    // Gone from the screen, the board's word goes with it: the plan's cards stand in.
    rerender({ any: false, on: false });
    expect(result.current.canHide()).toBe(true);
  });

  it("can't pick an empty Dashboard slot: only a filled one carries the widget mark", () => {
    document.body.innerHTML =
      '<div data-dashboard-slot="empty" data-slot-empty=""><button id="add">Add to Slot</button></div>' +
      '<div data-dashboard-slot="full" data-dashboard-widget="full"><span id="face"></span></div>';
    // Picking takes the nearest element carrying a mark (@liveworkspace/walkthrough's elementIdAt reads them so).
    const marked = (id: string) =>
      document.getElementById(id)!.closest(WALKTHROUGH_HIDE_MARKS.map((m) => `[${m}]`).join(','));
    expect(marked('add')).toBeNull();
    expect(marked('face')?.getAttribute('data-dashboard-widget')).toBe('full');
    document.body.innerHTML = '';
  });
});
