// @vitest-environment jsdom

// The fit on landing on a tab (docs/specs/008-canvas/canvas-and-palette.md "Fit-to-screen"): once per
// entry, when the tab's content has loaded, and never again for what the user then adds to it.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabEntryEffects } from './useTabEntryEffects';

// An editor's addresses, as its lib/legacy-editor-path names them.
const useTabEntryEffects = createTabEntryEffects((pathname) => pathname.startsWith('/document/'));

type Props = {
  activeId: string;
  elementCount: number;
  tabLoaded: boolean;
  hydrated?: boolean;
  warmTabId?: string | null;
  elements?: unknown;
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
const nextFrame = () =>
  act(() => {
    vi.runAllTimers();
  });

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

  // The warm open (offline-mode.md "Warm open of a cloud document"): the painted tab is fitted before hydration.
  it('fits the warm-painted tab before hydration, and not again when the load catches up', () => {
    const { fitToScreen, rerender } = setup({
      activeId: 't1',
      elementCount: 3,
      tabLoaded: false,
      hydrated: false,
      warmTabId: 't1',
    });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
    rerender({ activeId: 't1', elementCount: 4, tabLoaded: true, hydrated: true, warmTabId: 't1' });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('fits the warm-painted tab again when the catch-up replaced its body with a newer one', () => {
    const painted = [{ id: 'a' }];
    const fresh = [{ id: 'a' }, { id: 'b' }];
    const { fitToScreen, rerender } = setup({
      activeId: 't1',
      elementCount: 1,
      tabLoaded: false,
      hydrated: false,
      warmTabId: 't1',
      elements: painted,
    });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
    rerender({
      activeId: 't1',
      elementCount: 2,
      tabLoaded: true,
      hydrated: true,
      warmTabId: 't1',
      elements: fresh,
    });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(2);
    // Once only: what the person then adds never moves the view.
    rerender({
      activeId: 't1',
      elementCount: 3,
      tabLoaded: true,
      hydrated: true,
      warmTabId: null,
      elements: [...fresh, { id: 'c' }],
    });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(2);
  });

  it('fits a stale empty warm paint once the catch-up brings content', () => {
    const { fitToScreen, rerender } = setup({
      activeId: 't1',
      elementCount: 0,
      tabLoaded: false,
      hydrated: false,
      warmTabId: 't1',
      elements: [],
    });
    nextFrame();
    expect(fitToScreen).not.toHaveBeenCalled();
    rerender({
      activeId: 't1',
      elementCount: 1,
      tabLoaded: true,
      hydrated: true,
      warmTabId: 't1',
      elements: [{ id: 'a' }],
    });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('keeps the view when the catch-up keeps the painted body, or the person moved to another tab', () => {
    const painted = [{ id: 'a' }];
    const { fitToScreen, rerender } = setup({
      activeId: 't1',
      elementCount: 1,
      tabLoaded: false,
      hydrated: false,
      warmTabId: 't1',
      elements: painted,
    });
    nextFrame();
    rerender({
      activeId: 't1',
      elementCount: 1,
      tabLoaded: true,
      hydrated: true,
      warmTabId: 't1',
      elements: painted,
    });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);

    const moved = setup({
      activeId: 't1',
      elementCount: 1,
      tabLoaded: false,
      hydrated: false,
      warmTabId: 't1',
      elements: painted,
    });
    nextFrame();
    // Moved to t2 before the catch-up; t2 waits for its load (not counted loaded), then lands.
    moved.rerender({
      activeId: 't2',
      elementCount: 0,
      tabLoaded: false,
      hydrated: true,
      warmTabId: 't1',
    });
    moved.rerender({
      activeId: 't2',
      elementCount: 2,
      tabLoaded: true,
      hydrated: true,
      warmTabId: 't1',
    });
    nextFrame();
    expect(moved.fitToScreen).toHaveBeenCalledTimes(2);
  });

  it('still fits when the tab changes again before the frame the fit waits for', () => {
    const { fitToScreen, rerender } = setup({ activeId: 't1', elementCount: 3, tabLoaded: true });
    // An element lands in the next render, before the deferred fit has run.
    rerender({ activeId: 't1', elementCount: 4, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
    rerender({ activeId: 't1', elementCount: 5, tabLoaded: true });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('waits for the load for a tab without a body during the warm open', () => {
    const { fitToScreen, rerender } = setup({
      activeId: 't2',
      elementCount: 0,
      tabLoaded: false,
      hydrated: false,
      warmTabId: 't1',
    });
    nextFrame();
    expect(fitToScreen).not.toHaveBeenCalled();
    rerender({ activeId: 't2', elementCount: 5, tabLoaded: true, hydrated: true, warmTabId: 't1' });
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });

  it('fits nothing before hydration without a warm open', () => {
    const { fitToScreen } = setup({
      activeId: 't1',
      elementCount: 3,
      tabLoaded: true,
      hydrated: false,
    });
    nextFrame();
    expect(fitToScreen).not.toHaveBeenCalled();
  });

  it('fits on request, once the requested content has rendered', () => {
    const { fitToScreen, result } = setup({ activeId: 't1', elementCount: 0, tabLoaded: true });
    nextFrame();
    act(() => result.current.requestFit());
    nextFrame();
    expect(fitToScreen).toHaveBeenCalledTimes(1);
  });
});

// The tab pin (#t=<tab>) is the editor's: an address that names no item (the new route's "Unknown
// addresses") shows the not-found card and keeps its own address.
describe('useTabEntryEffects tab pin', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('pins the active tab on a document address', () => {
    window.history.replaceState(null, '', '/document/doc-1');
    setup({ activeId: 't1', elementCount: 0, tabLoaded: true });
    expect(window.location.hash).toBe('#t=t1');
  });

  it('leaves an address that names no document alone', () => {
    window.history.replaceState(null, '', '/explorer/mine');
    setup({ activeId: 't1', elementCount: 0, tabLoaded: true });
    expect(window.location.href).toBe(`${window.location.origin}/explorer/mine`);
  });
});
