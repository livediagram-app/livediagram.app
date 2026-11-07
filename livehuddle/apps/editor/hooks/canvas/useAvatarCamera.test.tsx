// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { STRIP_MORPH_MS } from '@/lib/strip-morph';
import { useAvatarCamera } from './useAvatarCamera';

// docs/specs/008-canvas/avatar-mode.md "The camera": entering and Fit centre the character at 100%, the zoom
// anchors on it, and outside the mode Fit frames the tab.

let canvas: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: 1000 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 800 });
  canvas.getBoundingClientRect = () =>
    ({ left: 10, top: 20, width: 1000, height: 800, right: 1010, bottom: 820 }) as DOMRect;
  document.body.append(canvas);
});

afterEach(() => {
  vi.useRealTimers();
  canvas.remove();
});

function setup(walking: boolean, at: { x: number; y: number } | null = { x: 100, y: 50 }) {
  const viewport = createViewportStore(0.5);
  const fitToScreen = vi.fn();
  const hook = renderHook(
    ({ walking }) =>
      useAvatarCamera({ walking, viewport, canvasMainRef: { current: canvas }, fitToScreen }),
    { initialProps: { walking } },
  );
  hook.result.current.avatarAtRef.current = () => at;
  return { ...hook, viewport, fitToScreen };
}

describe('useAvatarCamera', () => {
  it('fits the tab outside Avatar mode, and has no zoom anchor', () => {
    const { result, fitToScreen, viewport } = setup(false);
    act(() => result.current.fitView());
    expect(fitToScreen).toHaveBeenCalledOnce();
    expect(viewport.get().zoom).toBe(0.5);
    expect(result.current.zoomAnchor()).toBeNull();
  });

  it('fits to 100% centred on the character in Avatar mode', () => {
    const { result, fitToScreen, viewport } = setup(true);
    act(() => result.current.fitView());
    expect(fitToScreen).not.toHaveBeenCalled();
    expect(viewport.get()).toEqual({ zoom: 1, offset: { x: 400, y: 350 } });
  });

  // "Changing tab": travel keeps the mode, and arriving on the next tab centres the character at 100%.
  it('centres the character at 100% when travel lands on another tab', () => {
    const viewport = createViewportStore(0.5);
    let at = { x: 100, y: 50 };
    const hook = renderHook(
      ({ tabId }) =>
        useAvatarCamera({
          walking: true,
          tabId,
          viewport,
          canvasMainRef: { current: canvas },
          fitToScreen: vi.fn(),
        }),
      { initialProps: { tabId: 'a' } },
    );
    hook.result.current.avatarAtRef.current = () => at;
    act(() => {
      vi.runAllTimers();
    });
    viewport.setView({ zoom: 0.72, offset: { x: 0, y: 0 } });
    at = { x: 300, y: 200 };
    hook.rerender({ tabId: 'b' });
    act(() => {
      vi.runAllTimers();
    });
    expect(viewport.get()).toEqual({ zoom: 1, offset: { x: 200, y: 200 } });
  });

  it('falls back to the tab fit while the character has no position yet', () => {
    const { result, fitToScreen } = setup(true, null);
    act(() => result.current.fitView());
    expect(fitToScreen).toHaveBeenCalledOnce();
  });

  // "The Edit | Walk toggle": switching to Walk glides in, as Edit glides out.
  it('glides to the character at 100% on entering the mode', () => {
    const { rerender, viewport } = setup(false);
    rerender({ walking: true });
    act(() => {
      vi.advanceTimersByTime(STRIP_MORPH_MS / 2);
    });
    const mid = viewport.get();
    expect(mid.zoom).toBeGreaterThan(0.5);
    expect(mid.zoom).toBeLessThan(1);
    act(() => {
      vi.advanceTimersByTime(STRIP_MORPH_MS * 2);
    });
    expect(viewport.get()).toEqual({ zoom: 1, offset: { x: 400, y: 350 } });
  });

  it('lands at once when a load opens walking', () => {
    const { viewport } = setup(true);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(viewport.get()).toEqual({ zoom: 1, offset: { x: 400, y: 350 } });
  });

  it('stops the glide where it got to when the walk ends', () => {
    const { rerender, viewport } = setup(false);
    rerender({ walking: true });
    act(() => {
      vi.advanceTimersByTime(STRIP_MORPH_MS / 2);
    });
    rerender({ walking: false });
    const stopped = viewport.get();
    act(() => {
      vi.advanceTimersByTime(STRIP_MORPH_MS * 2);
    });
    expect(viewport.get()).toEqual(stopped);
    expect(stopped.zoom).toBeLessThan(1);
  });

  it('anchors the zoom on where the character stands on screen', () => {
    const { result, viewport } = setup(true);
    act(() => viewport.setView({ zoom: 2, offset: { x: 0, y: 0 } }));
    // Scaled about the canvas's centre (500, 400), offset by the canvas's own corner.
    expect(result.current.zoomAnchor()).toEqual({
      x: 10 + 500 + 2 * (100 - 500),
      y: 20 + 400 + 2 * (50 - 400),
    });
  });

  // "The Edit | Walk toggle": Edit frames the whole tab, only when a walk ends on the same tab.
  describe('fitOnEdit', () => {
    function withFit(walking: boolean, tabId = 't1') {
      const viewport = createViewportStore(0.5);
      const fitOnEdit = vi.fn();
      const hook = renderHook(
        (p: { walking: boolean; tabId: string }) =>
          useAvatarCamera({
            walking: p.walking,
            tabId: p.tabId,
            viewport,
            canvasMainRef: { current: canvas },
            fitToScreen: vi.fn(),
            fitOnEdit,
          }),
        { initialProps: { walking, tabId } },
      );
      return { ...hook, fitOnEdit };
    }

    it('fits once when a walk ends', () => {
      const { rerender, fitOnEdit } = withFit(true);
      rerender({ walking: false, tabId: 't1' });
      expect(fitOnEdit).toHaveBeenCalledOnce();
      rerender({ walking: false, tabId: 't1' });
      expect(fitOnEdit).toHaveBeenCalledOnce();
    });

    it('never fits on a load, building or walking', () => {
      expect(withFit(false).fitOnEdit).not.toHaveBeenCalled();
      expect(withFit(true).fitOnEdit).not.toHaveBeenCalled();
    });

    it('does not fit on entering the walk', () => {
      const { rerender, fitOnEdit } = withFit(false);
      rerender({ walking: true, tabId: 't1' });
      expect(fitOnEdit).not.toHaveBeenCalled();
    });

    it('does not fit when the walk ends with a change of tab', () => {
      const { rerender, fitOnEdit } = withFit(true);
      rerender({ walking: false, tabId: 't2' });
      expect(fitOnEdit).not.toHaveBeenCalled();
    });
  });
});
