// @vitest-environment jsdom

// The fit on landing on a tab (docs/specs/008-canvas/canvas-and-palette.md "Fit-to-screen"): once per
// entry, when the tab's content has loaded, and never again for what the user then adds to it.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabEntryEffects } from './useTabEntryEffects';

type Props = {
  activeId: string;
  elementCount: number;
  tabLoaded: boolean;
};

function setup(initial: Props) {
  const fitToScreen = vi.fn();
  const skipFitForTabRef = { current: null as string | null };
  const hook = renderHook(
    (p: Props) => useTabEntryEffects({ hydrated: true, fitToScreen, skipFitForTabRef, ...p }),
    { initialProps: initial },
  );
  return { fitToScreen, skipFitForTabRef, ...hook };
}

// The fit is deferred a frame, so the canvas has its measured size.
const nextFrame = () => act(() => vi.runAllTimers());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => vi.useRealTimers());

describe('useTabEntryEffects', () => {
  it('fits a tab that lands with content', () => {
    const { fitToScreen } = setup({ activeId: 't1', elementCount: 3, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('does not fit again as the user adds to a tab it already fitted', () => {
    const { fitToScreen, rerender } = setup({ activeId: 't1', elementCount: 3, tabLoaded: true });
    nextFrame();
    rerender({ activeId: 't1', elementCount: 4, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('does not move the view when the user adds the first element to an empty tab', () => {
    const { fitToScreen, rerender } = setup({ activeId: 't1', elementCount: 0, tabLoaded: true });
    nextFrame();
    rerender({ activeId: 't1', elementCount: 1, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).not.toHaveBeenCalled();
  });

  it('waits for a lazily loaded tab’s content, then fits it', () => {
    const { fitToScreen, rerender } = setup({ activeId: 't2', elementCount: 0, tabLoaded: false });
    nextFrame();
    expect(fitToScreen).not.toHaveBeenCalled();
    rerender({ activeId: 't2', elementCount: 5, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('fits each tab on entry', () => {
    const { fitToScreen, rerender } = setup({ activeId: 't1', elementCount: 2, tabLoaded: true });
    nextFrame();
    rerender({ activeId: 't2', elementCount: 2, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(2);
  });

  it('leaves a tab alone that arrived already positioned', () => {
    const { fitToScreen, skipFitForTabRef, rerender } = setup({
      activeId: 't1',
      elementCount: 2,
      tabLoaded: true,
    });
    nextFrame();
    skipFitForTabRef.current = 't2';
    rerender({ activeId: 't2', elementCount: 0, tabLoaded: false });
    rerender({ activeId: 't2', elementCount: 6, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('fits on request, once the requested content has rendered', () => {
    const { fitToScreen, result } = setup({ activeId: 't1', elementCount: 0, tabLoaded: true });
    nextFrame();
    act(() => result.current.requestFit());
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });
});
