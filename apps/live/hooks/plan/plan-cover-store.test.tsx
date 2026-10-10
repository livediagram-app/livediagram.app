// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { maximisePlanElement, releasePlanElement } from './maximised-plan';
import {
  isBoardFillingTab,
  isSheetFillingTab,
  isCanvasCovered,
  setPlanCover,
  useCanvasCovered,
  useFillsTab,
  useTabElementCount,
} from './plan-cover-store';

// docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab": the chrome asking whether the canvas is covered,
// and each board asking whether it fills the tab, re-render only when that answer changes.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(() => {
  act(() => {
    setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: 0 });
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
  it('re-renders the covered chrome only when coverage changes, never per element added', () => {
    const renders = vi.fn();
    render(<Probe onRender={renders} />);
    expect(renders).toHaveBeenCalledTimes(1);
    // Forty elements added, one at a time: no re-render.
    for (let n = 1; n <= 40; n++)
      act(() => setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: n }));
    expect(renders).toHaveBeenCalledTimes(1);
    act(() => setPlanCover({ fillTabId: 'a', fillTabKind: 'Board', tabElementCount: 1 }));
    expect(renders).toHaveBeenCalledTimes(2);
    // Still covered, still board 'a': elements added while filled re-render nothing.
    act(() => setPlanCover({ fillTabId: 'a', fillTabKind: 'Board', tabElementCount: 2 }));
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
    act(() => setPlanCover({ fillTabId: 'x', fillTabKind: 'Board', tabElementCount: 1 }));
    expect(isBoardFillingTab()).toBe(true);
    expect(isSheetFillingTab()).toBe(false);
    act(() => setPlanCover({ fillTabId: 's', fillTabKind: 'Sheet', tabElementCount: 1 }));
    expect(isBoardFillingTab()).toBe(false);
    expect(isSheetFillingTab()).toBe(true);
  });

  it('gives the tab’s element count to whoever asks', () => {
    function Count() {
      return <span>{useTabElementCount()}</span>;
    }
    const { container } = render(<Count />);
    act(() => setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: 7 }));
    expect(container.textContent).toBe('7');
  });
});
