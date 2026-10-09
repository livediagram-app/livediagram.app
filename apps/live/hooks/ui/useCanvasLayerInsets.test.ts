// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { touchesChrome, useCanvasLayerInsets } from './useCanvasLayerInsets';

// docs/specs/026-plan/plan-board.md "Maximised board": measured from the chrome, again as the chrome changes, and
// never for typing or pressing on the board.
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const rect = (left: number, top: number, right: number, bottom: number) => () =>
  ({
    left,
    top,
    right,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }) as DOMRect;

function setup() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)));
  document.body.innerHTML =
    '<main><div class="panels"><div data-layout-chrome=""></div></div><div class="board"></div></main>';
  const main = document.querySelector('main')!;
  const panel = document.querySelector<HTMLElement>('[data-layout-chrome]')!;
  main.getBoundingClientRect = rect(0, 80, 1440, 860);
  panel.getBoundingClientRect = rect(16, 96, 272, 620);
  return { frames, flush, main, panel };
}

const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('useCanvasLayerInsets', () => {
  it('measures on mount, and again when a panel goes', async () => {
    const { flush, main, panel } = setup();
    const { result, unmount } = renderHook(() => useCanvasLayerInsets(main));
    flush();
    expect(result.current.left).toBe(272);
    panel.remove();
    await tick();
    flush();
    expect(result.current.left).toBe(0);
    unmount();
  });

  it('measures when a panel moves (its style), not for keys, presses or the board’s own changes', async () => {
    const { frames, flush, main, panel } = setup();
    renderHook(() => useCanvasLayerInsets(main));
    flush();
    window.dispatchEvent(new Event('keyup'));
    window.dispatchEvent(new Event('pointerup'));
    main.querySelector('.board')!.appendChild(document.createElement('span'));
    await tick();
    expect(frames).toHaveLength(0);
    panel.setAttribute('style', 'left: 400px');
    await tick();
    expect(frames).toHaveLength(1);
  });

  it('measures nothing without a canvas', () => {
    const { result } = renderHook(() => useCanvasLayerInsets(null));
    expect(result.current).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('touchesChrome', () => {
  it('is true only for chrome, or something holding it, added or removed', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-layout-chrome', '');
    const holder = document.createElement('div');
    holder.appendChild(panel.cloneNode());
    const card = document.createElement('div');
    const rec = (added: Node[], removed: Node[] = []) =>
      ({ addedNodes: added, removedNodes: removed }) as unknown as MutationRecord;
    expect(touchesChrome(rec([panel]))).toBe(true);
    expect(touchesChrome(rec([], [holder]))).toBe(true);
    expect(touchesChrome(rec([card, document.createTextNode('x')]))).toBe(false);
  });
});
