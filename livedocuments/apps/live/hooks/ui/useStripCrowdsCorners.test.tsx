// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRIP_SELECTOR, stripCrowdsCorners, useStripCrowdsCorners } from './useStripCrowdsCorners';

// Whether a bar across the top (the Toolbar strip) reaches into a top-corner panel stack
// (docs/specs/007-editor/toolbar-layout.md).

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

  it('is clear when the bar stays out of the corners', () => {
    const corners = mount(STRIP_HTML, [400, 900]);
    const { result } = renderHook(() => useStripCrowdsCorners(corners, STRIP_SELECTOR, 'l', '1'));
    expect(result.current).toBe(false);
  });

  it('is never crowded without a bar to measure', () => {
    const corners = mount(STRIP_HTML, [200, 900]);
    const { result } = renderHook(() => useStripCrowdsCorners(corners, null, 'l', '1'));
    expect(result.current).toBe(false);
  });
});

describe('stripCrowdsCorners', () => {
  const strip = { left: 300, right: 900 };
  it('is crowded when a corner stack reaches under the strip, with a gap to spare', () => {
    expect(stripCrowdsCorners(strip, [{ left: 890, right: 1180 }])).toBe(true);
    expect(stripCrowdsCorners(strip, [{ left: 905, right: 1180 }])).toBe(true);
    expect(stripCrowdsCorners(strip, [{ left: 910, right: 1180 }])).toBe(false);
  });

  it('ignores an empty corner', () => {
    expect(stripCrowdsCorners(strip, [{ left: 800, right: 800 }])).toBe(false);
  });
});
