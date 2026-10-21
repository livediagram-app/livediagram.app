// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { maximisePlanElement, releasePlanElement } from './maximised-plan';
import {
  isBoardFillingTab,
  isSheetCovering,
  isCanvasCovered,
  setPlanCover,
  useCanvasCovered,
  useCoversCanvas,
  useFillsTab,
} from './plan-cover-store';

// docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab": the chrome asking whether the canvas is covered,
// and each board asking whether it fills the tab, re-render only when that answer changes.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(() => {
  act(() => {
    setPlanCover({ fillTabId: null, fillTabKind: null });
    releasePlanElement('v');
    releasePlanElement('b');
  });
});

function Probe({ onRender }: { onRender: () => void }) {
  onRender();
  useCanvasCovered();
  useFillsTab('a');
  return null;
}

describe('plan-cover-store', () => {
  it('names the element covering the canvas, maximised or filling the tab, and nothing for null', async () => {
    const { renderHook } = await import('@testing-library/react');
    const covers = (id: string | null) => renderHook(() => useCoversCanvas(id)).result;
    const b = covers('b');
    const other = covers('x');
    const none = covers(null);
    expect(b.current).toBe(false);
    act(() => maximisePlanElement('b'));
    expect([b.current, other.current, none.current]).toEqual([true, false, false]);
    act(() => releasePlanElement('b'));
    act(() => setPlanCover({ fillTabId: 'b', fillTabKind: 'Board' }));
    expect([b.current, other.current]).toEqual([true, false]);
  });

  it('re-renders the covered chrome only when coverage changes, never per element added', () => {
    const renders = vi.fn();
    render(<Probe onRender={renders} />);
    expect(renders).toHaveBeenCalledTimes(1);
    // Forty elements added, one at a time, republish the same cover: no re-render.
    for (let n = 1; n <= 40; n++) act(() => setPlanCover({ fillTabId: null, fillTabKind: null }));
    expect(renders).toHaveBeenCalledTimes(1);
    act(() => setPlanCover({ fillTabId: 'a', fillTabKind: 'Board' }));
    expect(renders).toHaveBeenCalledTimes(2);
    // Still covered, still board 'a': elements added while filled re-render nothing.
    act(() => setPlanCover({ fillTabId: 'a', fillTabKind: 'Board' }));
    expect(renders).toHaveBeenCalledTimes(2);
  });

  it('narrows the palette for a board filling the tab, never for a maximised one', () => {
    act(() => maximisePlanElement('v', 'View'));
    expect(isCanvasCovered()).toBe(true);
    expect(isBoardFillingTab()).toBe(false);
    act(() => releasePlanElement('v'));
    act(() => maximisePlanElement('b', 'Board'));
    expect(isCanvasCovered()).toBe(true);
    expect(isBoardFillingTab()).toBe(false);
    act(() => releasePlanElement('b'));
    act(() => setPlanCover({ fillTabId: 'x', fillTabKind: 'Board' }));
    expect(isBoardFillingTab()).toBe(true);
    expect(isSheetCovering()).toBe(false);
    act(() => setPlanCover({ fillTabId: 's', fillTabKind: 'Sheet' }));
    expect(isBoardFillingTab()).toBe(false);
    expect(isSheetCovering()).toBe(true);
  });

  // A Sheet covering the canvas hides the palette, maximised or filling its tab; a board keeps it.
  it('counts a maximised Sheet as covering, a maximised board not', () => {
    act(() => maximisePlanElement('s', 'Sheet'));
    expect(isSheetCovering()).toBe(true);
    act(() => releasePlanElement('s'));
    act(() => maximisePlanElement('b', 'Board'));
    expect(isSheetCovering()).toBe(false);
    act(() => releasePlanElement('b'));
  });
});
