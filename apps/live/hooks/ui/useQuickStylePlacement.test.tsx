// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuickStylePlacement } from './useQuickStylePlacement';

// A ResizeObserver that behaves like the browser's: every observe() of an
// element not already watched delivers one initial notification, and a
// size change notifies the observers watching that element.
class FakeResizeObserver {
  static all = new Set<FakeResizeObserver>();
  static observeCalls = 0;
  private readonly watched = new Set<Element>();
  private readonly pending = new Set<Element>();
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.all.add(this);
  }
  observe(el: Element) {
    FakeResizeObserver.observeCalls += 1;
    if (this.watched.has(el)) return;
    this.watched.add(el);
    this.pending.add(el);
  }
  unobserve(el: Element) {
    this.watched.delete(el);
    this.pending.delete(el);
  }
  disconnect() {
    this.watched.clear();
    this.pending.clear();
  }
  resize(el: Element) {
    if (this.watched.has(el)) this.pending.add(el);
  }
  deliver() {
    if (this.pending.size === 0) return;
    const entries = [...this.pending].map((target) => ({ target }) as ResizeObserverEntry);
    this.pending.clear();
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

let frames: FrameRequestCallback[] = [];

// One browser frame: animation-frame callbacks run, then layout, then
// resize observations are delivered.
const runFrame = () => {
  const due = frames;
  frames = [];
  for (const cb of due) cb(0);
  for (const ro of FakeResizeObserver.all) ro.deliver();
};

const box = (
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
) => {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    }) as DOMRect;
};

let area: HTMLElement;
let palette: HTMLElement;
let measures = 0;

beforeEach(() => {
  frames = [];
  measures = 0;
  FakeResizeObserver.all.clear();
  FakeResizeObserver.observeCalls = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  area = document.createElement('main');
  area.setAttribute('data-canvas-a11y-root', '');
  box(area, { left: 0, top: 0, width: 1440, height: 900 });
  // Counts every placement pass: each one measures the canvas area once.
  const measureArea = area.getBoundingClientRect;
  area.getBoundingClientRect = () => {
    measures += 1;
    return measureArea();
  };
  palette = document.createElement('div');
  palette.setAttribute('data-tour-id', 'palette');
  box(palette, { left: 0, top: 60, width: 240, height: 300 });
  document.body.append(area, palette);
});

afterEach(() => {
  area.remove();
  palette.remove();
  vi.unstubAllGlobals();
});

const mountPanel = () => {
  const panel = document.createElement('div');
  box(panel, { left: 0, top: 0, width: 240, height: 200 });
  document.body.append(panel);
  return { current: panel };
};

describe('useQuickStylePlacement', () => {
  it('places the panel clear of the chrome', () => {
    const panelRef = mountPanel();
    const { result } = renderHook(() => useQuickStylePlacement(panelRef, true, 'toolbar'));
    expect(result.current).not.toBeNull();
    expect(result.current!.top).toBeGreaterThanOrEqual(360);
  });

  it('settles: still chrome causes no further placement passes', () => {
    const panelRef = mountPanel();
    renderHook(() => useQuickStylePlacement(panelRef, true, 'toolbar'));
    for (let i = 0; i < 5; i++) act(runFrame);
    const settledMeasures = measures;
    const settledObserves = FakeResizeObserver.observeCalls;

    for (let i = 0; i < 60; i++) act(runFrame);

    expect(measures).toBe(settledMeasures);
    expect(FakeResizeObserver.observeCalls).toBe(settledObserves);
  });

  it('re-places once when a piece of chrome resizes', () => {
    const panelRef = mountPanel();
    const { result } = renderHook(() => useQuickStylePlacement(panelRef, true, 'toolbar'));
    for (let i = 0; i < 5; i++) act(runFrame);
    const before = measures;

    box(palette, { left: 0, top: 60, width: 240, height: 500 });
    for (const ro of FakeResizeObserver.all) ro.resize(palette);
    for (let i = 0; i < 5; i++) act(runFrame);

    expect(measures).toBe(before + 1);
    expect(result.current!.top).toBeGreaterThanOrEqual(560);
  });

  it('re-places for a transition on the chrome it watches, not one on the canvas', () => {
    const panelRef = mountPanel();
    renderHook(() => useQuickStylePlacement(panelRef, true, 'toolbar'));
    for (let i = 0; i < 5; i++) act(runFrame);
    const settled = measures;

    const onCanvas = document.createElement('div');
    area.append(onCanvas);
    act(() => {
      onCanvas.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    for (let i = 0; i < 3; i++) act(runFrame);
    expect(measures).toBe(settled);

    act(() => {
      palette.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    for (let i = 0; i < 3; i++) act(runFrame);
    expect(measures).toBe(settled + 1);
    onCanvas.remove();
  });

  it('watches chrome that mounts after the panel', () => {
    const panelRef = mountPanel();
    const { result } = renderHook(() => useQuickStylePlacement(panelRef, true, 'toolbar'));
    for (let i = 0; i < 5; i++) act(runFrame);

    const cluster = document.createElement('div');
    cluster.setAttribute('data-zoom-cluster', '');
    box(cluster, { left: 0, top: 360, width: 240, height: 520 });
    document.body.append(cluster);
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    for (let i = 0; i < 5; i++) act(runFrame);
    const settled = measures;

    box(cluster, { left: 0, top: 360, width: 300, height: 520 });
    for (const ro of FakeResizeObserver.all) ro.resize(cluster);
    for (let i = 0; i < 5; i++) act(runFrame);

    expect(measures).toBe(settled + 1);
    expect(result.current!.left).toBeGreaterThanOrEqual(300);
    cluster.remove();
  });
});
