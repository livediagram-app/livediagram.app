// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EDGE_SCROLL_MAX_PX,
  EDGE_SCROLL_REDUCED_PX,
  EDGE_SCROLL_ZONE_PX,
  clampScrollStep,
  edgeScrollStep,
} from './edge-auto-scroll';
import { useEdgeAutoScroll } from './useEdgeAutoScroll';

// docs/specs/026-plan/plan-board.md "Maximised board": a dragged card near an edge scrolls the columns sideways.
const view = { left: 100, right: 1100 };

describe('edgeScrollStep', () => {
  it('is still away from the edges, and ramps up toward each', () => {
    expect(edgeScrollStep(600, view)).toBe(0);
    expect(edgeScrollStep(100 + EDGE_SCROLL_ZONE_PX, view)).toBe(0);
    const near = edgeScrollStep(100 + EDGE_SCROLL_ZONE_PX - 5, view);
    const nearer = edgeScrollStep(110, view);
    expect(near).toBeLessThan(0);
    expect(nearer).toBeLessThan(near);
    expect(edgeScrollStep(100, view)).toBe(-EDGE_SCROLL_MAX_PX);
    expect(edgeScrollStep(1100, view)).toBe(EDGE_SCROLL_MAX_PX);
    // Past the edge (the pointer outside the viewport) it runs at full speed.
    expect(edgeScrollStep(1300, view)).toBe(EDGE_SCROLL_MAX_PX);
  });

  it('runs at one gentle speed under reduced motion', () => {
    expect(edgeScrollStep(1095, view, true)).toBe(EDGE_SCROLL_REDUCED_PX);
    expect(edgeScrollStep(1060, view, true)).toBe(EDGE_SCROLL_REDUCED_PX);
    expect(edgeScrollStep(105, view, true)).toBe(-EDGE_SCROLL_REDUCED_PX);
  });

  it('keeps a narrow viewport usable, its zones a quarter of it at most', () => {
    expect(edgeScrollStep(150, { left: 100, right: 200 })).toBe(0);
    expect(edgeScrollStep(105, { left: 100, right: 200 })).toBeLessThan(0);
  });
});

describe('clampScrollStep', () => {
  it('stops at the ends', () => {
    const at = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 2000, clientWidth: 1000 });
    expect(clampScrollStep(-10, at(0))).toBe(0);
    expect(clampScrollStep(-10, at(4))).toBe(-4);
    expect(clampScrollStep(10, at(1000))).toBe(0);
    expect(clampScrollStep(10, at(995))).toBe(5);
  });
});

describe('useEdgeAutoScroll', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ ...view, top: 0, bottom: 500 }) as DOMRect;
    Object.defineProperty(el, 'scrollWidth', { value: 3000 });
    Object.defineProperty(el, 'clientWidth', { value: 1000 });
    el.scrollLeft = 500;
    const flush = () => frames.splice(0).forEach((cb) => cb(0));
    return { el, flush, frames };
  }

  it('scrolls while a drag runs near an edge, frame after frame', () => {
    const { el, flush } = setup();
    renderHook(() => useEdgeAutoScroll({ current: el }, true));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1095 }));
    flush();
    expect(el.scrollLeft).toBeGreaterThan(500);
    const after = el.scrollLeft;
    flush();
    expect(el.scrollLeft).toBeGreaterThan(after);
  });

  it('never scrolls on a plain hover, with no drag', () => {
    const { el, flush } = setup();
    renderHook(() => useEdgeAutoScroll({ current: el }, false));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1095 }));
    flush();
    expect(el.scrollLeft).toBe(500);
  });

  it('stops when the drag ends', () => {
    const { el, flush } = setup();
    const { rerender } = renderHook(({ on }) => useEdgeAutoScroll({ current: el }, on), {
      initialProps: { on: true },
    });
    rerender({ on: false });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1095 }));
    flush();
    expect(el.scrollLeft).toBe(500);
  });
});
