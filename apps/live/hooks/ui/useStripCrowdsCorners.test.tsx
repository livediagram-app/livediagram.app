// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRIP_SELECTOR, useStripCrowdsCorners } from './useStripCrowdsCorners';
import { WHITEBOARD_DOCK_SELECTOR } from '@/lib/whiteboard-dock-prefs';

// Whether a bar across the top (the Toolbar strip, or a whiteboard dock at the top) reaches into a
// top-corner panel stack (docs/specs/007-editor/toolbar-layout.md, docs/specs/023-whiteboard/whiteboard.md
// "Where the dock sits").

function boxed(el: HTMLElement, left: number, right: number) {
  el.getBoundingClientRect = () =>
    ({ left, right, top: 0, bottom: 50, width: right - left, height: 50 }) as DOMRect;
  return el;
}

function mount(html: string, bar: [number, number]) {
  document.body.innerHTML = html;
  boxed(document.querySelector<HTMLElement>('[data-bar]')!, ...bar);
  const left = boxed(document.createElement('div'), 16, 288);
  document.body.append(left);
  return { current: { 'top-left': left } };
}

const STRIP_HTML = '<div data-toolbar-palette><div data-bar data-tour-id="palette"></div></div>';
const DOCK_HTML = '<div data-whiteboard-dock data-bar></div>';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useStripCrowdsCorners', () => {
  it('measures the Toolbar strip', () => {
    const corners = mount(STRIP_HTML, [200, 900]);
    const { result } = renderHook(() => useStripCrowdsCorners(corners, STRIP_SELECTOR, 'l', '1'));
    expect(result.current).toBe(true);
  });

  it('measures a whiteboard dock at the top', () => {
    const corners = mount(DOCK_HTML, [200, 900]);
    const { result } = renderHook(() =>
      useStripCrowdsCorners(corners, WHITEBOARD_DOCK_SELECTOR, 'l', '1'),
    );
    expect(result.current).toBe(true);
  });

  it('is clear when the bar stays out of the corners', () => {
    const corners = mount(DOCK_HTML, [400, 900]);
    const { result } = renderHook(() =>
      useStripCrowdsCorners(corners, WHITEBOARD_DOCK_SELECTOR, 'l', '1'),
    );
    expect(result.current).toBe(false);
  });

  it('is never crowded without a bar to measure', () => {
    const corners = mount(DOCK_HTML, [200, 900]);
    const { result } = renderHook(() => useStripCrowdsCorners(corners, null, 'l', '1'));
    expect(result.current).toBe(false);
  });
});
