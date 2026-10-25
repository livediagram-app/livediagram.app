// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Element as CanvasElement } from '@livedocuments/document';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/viewport-glide', () => ({
  glideViewport: vi.fn(() => vi.fn()),
}));
vi.mock('@/lib/tab-fit-view', () => ({
  tabFitView: vi.fn(() => ({ zoom: 0.4, offset: { x: 7, y: 9 } })),
}));

import { track } from '@/lib/telemetry';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';
import { tabFitView } from '@/lib/tab-fit-view';
import {
  createViewportStore,
  type ViewportStore,
} from '@liveworkspace/workbench/lib/viewport-store';
import { useDoubleTapZoom } from './useDoubleTapZoom';

// The hook glides the view to lib/double-tap-zoom's answers (docs/specs/008-canvas/canvas-and-palette.md
// "Double-tap to zoom"): in on the canvas, out to the whole tab on the next double-tap, a small element framed first,
// and counts each.

const main = () => {
  const node = document.createElement('main');
  Object.defineProperty(node, 'offsetWidth', { value: 400 });
  Object.defineProperty(node, 'offsetHeight', { value: 800 });
  return { current: node };
};
const tab = (id = 't1') => ({ id, elements: [] as CanvasElement[] });
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

// An element node inside the content layer, the layer's origin at (50, 100) on screen.
function elementNode(r: DOMRect) {
  const layer = document.createElement('div');
  layer.setAttribute('data-canvas-content', '');
  layer.getBoundingClientRect = () => rect(50, 100, 0, 0);
  const el = document.createElement('div');
  el.setAttribute('data-element-id', 'a');
  el.getBoundingClientRect = () => r;
  layer.append(el);
  return el;
}

// Each glide lands at once, as the store would under a finished glide.
function landGlides(store: ViewportStore) {
  vi.mocked(glideViewport).mockImplementation((_from, to, set) => {
    set.zoom(to.zoom);
    set.offset(to.offset);
    return vi.fn();
  });
  return store;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('useDoubleTapZoom: the canvas', () => {
  it('glides from the view now to the tapped point centred at the next zoom, and counts it', () => {
    const store = createViewportStore(0.6);
    const { result } = renderHook(() => useDoubleTapZoom(main(), store, tab()));
    result.current.onCanvas({ x: 500, y: 100 });
    expect(glideViewport).toHaveBeenCalledWith(
      { zoom: 0.6, offset: { x: 0, y: 0 } },
      { zoom: 1.2, offset: { x: -300, y: 300 } },
      { zoom: store.setZoom, offset: store.setOffset },
    );
    expect(track).toHaveBeenCalledWith('Canvas', 'Zoomed', 'DoubleTap');
  });

  it('fits the whole tab on the next double-tap, then zooms in again on the one after', () => {
    const store = landGlides(createViewportStore(0.6));
    const { result } = renderHook(() => useDoubleTapZoom(main(), store, tab()));
    result.current.onCanvas({ x: 0, y: 0 });
    expect(store.get().zoom).toBe(1.2);
    result.current.onCanvas({ x: 0, y: 0 });
    expect(store.get()).toEqual({ zoom: 0.4, offset: { x: 7, y: 9 } });
    expect(track).toHaveBeenLastCalledWith('Canvas', 'Zoomed', 'DoubleTapFit');
    result.current.onCanvas({ x: 0, y: 0 });
    expect(store.get().zoom).toBe(1);
    expect(track).toHaveBeenLastCalledWith('Canvas', 'Zoomed', 'DoubleTap');
  });

  it('zooms in again when the view has been pinched back out to the fit', () => {
    const store = landGlides(createViewportStore(0.6));
    const { result } = renderHook(() => useDoubleTapZoom(main(), store, tab()));
    result.current.onCanvas({ x: 0, y: 0 });
    store.setZoom(0.3);
    result.current.onCanvas({ x: 0, y: 0 });
    expect(store.get().zoom).toBe(1);
  });

  it('starts afresh on a new tab', () => {
    const store = landGlides(createViewportStore(0.6));
    const { result, rerender } = renderHook(({ t }) => useDoubleTapZoom(main(), store, t), {
      initialProps: { t: tab('t1') },
    });
    result.current.onCanvas({ x: 0, y: 0 });
    rerender({ t: tab('t2') });
    result.current.onCanvas({ x: 0, y: 0 });
    expect(store.get().zoom).toBe(2.4);
    expect(tabFitView).not.toHaveBeenCalled();
  });

  it('stops a running glide before starting the next, and when the canvas goes', () => {
    const stops = [vi.fn(), vi.fn()];
    vi.mocked(glideViewport).mockReturnValueOnce(stops[0]!).mockReturnValueOnce(stops[1]!);
    const { result, unmount } = renderHook(() =>
      useDoubleTapZoom(main(), createViewportStore(1), tab()),
    );
    result.current.onCanvas({ x: 0, y: 0 });
    result.current.onCanvas({ x: 0, y: 0 });
    expect(stops[0]).toHaveBeenCalledTimes(1);
    unmount();
    expect(stops[1]).toHaveBeenCalledTimes(1);
  });

  it('does nothing before the canvas is mounted', () => {
    const { result } = renderHook(() =>
      useDoubleTapZoom({ current: null }, createViewportStore(1), tab()),
    );
    result.current.onCanvas({ x: 0, y: 0 });
    expect(result.current.onElement(elementNode(rect(0, 0, 4, 4)))).toBe(false);
    expect(glideViewport).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('useDoubleTapZoom: an element', () => {
  it('frames a small element in the middle of the canvas and counts it', () => {
    const store = landGlides(createViewportStore(0.25));
    const { result } = renderHook(() => useDoubleTapZoom(main(), store, tab()));
    // 160 x 60 on the canvas at (100, 200), drawn at 25%.
    expect(result.current.onElement(elementNode(rect(75, 150, 40, 15)))).toBe(true);
    expect(store.get().offset).toEqual({ x: 200 - 180, y: 400 - 230 });
    expect(store.get().zoom).toBe(1.75);
    expect(track).toHaveBeenCalledWith('Canvas', 'Zoomed', 'DoubleTapElement');
  });

  it('leaves an element big enough to work on to edit', () => {
    const store = createViewportStore(0.6);
    const { result } = renderHook(() => useDoubleTapZoom(main(), store, tab()));
    expect(result.current.onElement(elementNode(rect(75, 150, 120, 60)))).toBe(false);
    expect(glideViewport).not.toHaveBeenCalled();
  });

  it('counts as a zoom in: the next double-tap on the canvas fits the tab', () => {
    const store = landGlides(createViewportStore(0.25));
    const { result } = renderHook(() => useDoubleTapZoom(main(), store, tab()));
    result.current.onElement(elementNode(rect(75, 150, 40, 15)));
    result.current.onCanvas({ x: 0, y: 0 });
    expect(store.get().zoom).toBe(0.4);
  });

  it('needs the content layer to measure against', () => {
    const { result } = renderHook(() => useDoubleTapZoom(main(), createViewportStore(0.25), tab()));
    const loose = document.createElement('div');
    expect(result.current.onElement(loose)).toBe(false);
  });
});
