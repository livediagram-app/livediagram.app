// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { maximisePlanElement, releasePlanElement } from '@/hooks/plan/maximised-plan';
import { useCanvasSelectionView } from './useCanvasSelectionView';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';

// docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab": the selection chrome reads whether a Plan board
// covers the canvas, so no path (a press before, select-all, undo, a collaborator) brings its toolbar back.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./useSelectionStore', () => ({
  useSelectionOf: (pick: (s: unknown) => unknown) =>
    pick({ selectedId: 'b', multiSelectedIds: new Set<string>() }),
}));

const board = {
  id: 'b',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
} as Element;
const input = {
  elements: [board],
  editingId: null,
  isPaintMode: false,
  tabLocked: false,
  readOnly: false,
};

afterEach(() => {
  releasePlanElement('b');
  setPlanCover({ fillTabBoardId: null, tabElementCount: 0 });
});

describe('selection chrome over a covered canvas', () => {
  it('hides the popover while the board is maximised, and brings it back after', () => {
    // Its hooks run in the same order maximised or not (React says so on the console when they do not).
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, rerender } = renderHook(() => useCanvasSelectionView(input));
    expect(result.current.showPopover).toBe(true);
    act(() => maximisePlanElement('b'));
    expect(result.current.showPopover).toBe(false);
    act(() => releasePlanElement('b'));
    rerender();
    expect(result.current.showPopover).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('hides it while a board fills the tab', () => {
    setPlanCover({ fillTabBoardId: 'b', tabElementCount: 1 });
    const { result } = renderHook(() => useCanvasSelectionView(input));
    expect(result.current.selected?.id).toBe('b');
    expect(result.current.showPopover).toBe(false);
  });
});
