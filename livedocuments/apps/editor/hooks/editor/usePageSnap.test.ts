// @vitest-environment jsdom

// The view rests on a page (docs/specs/007-editor/pages-mode.md "Getting around the pages"): a
// pan or a zoom letting go glides the view onto a page, and so does any other move once it rests,
// never while a hand is on the canvas, and not while following or presenting.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@livedocuments/document';
import { beginCanvasGesture, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { track } from '@/lib/telemetry';
import { computeFitBelow } from '@/lib/viewport';
import {
  createViewportStore,
  type ViewportStore,
} from '@liveworkspace/workbench/lib/viewport-store';
import { usePagesMode } from './usePagesMode';
import { FLICK_WINDOW_MS, VIEW_REST_MS, flickVelocity } from './usePageSnap';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// Glides land at once, so a test reads where the view ends.
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => true,
}));

const SIZE = { width: 1200, height: 800 };
const tab = {
  id: 't',
  name: 't',
  elements: [],
  pages: [
    { id: 'p1', size: 'slide', orientation: 'landscape' },
    { id: 'p2', size: 'slide', orientation: 'landscape' },
    { id: 'p3', size: 'slide', orientation: 'landscape' },
  ],
} as unknown as Tab;
const row = layOutPages(pagesOf(tab));
const fitOf = (pageId: string) => computeFitBelow(SIZE, row.find((p) => p.id === pageId)!.rect, 0);

function mount(viewport: ViewportStore, opts: { suspended?: () => boolean } = {}) {
  const canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: SIZE.width });
  Object.defineProperty(canvas, 'offsetHeight', { value: SIZE.height });
  return renderHook(() =>
    usePagesMode({
      activeTab: tab,
      canEdit: true,
      tabLoaded: false,
      commitTabs: vi.fn(),
      canvasMainRef: { current: canvas },
      setViewportZoom: viewport.setZoom,
      setViewportOffset: viewport.setOffset,
      getViewport: viewport.get,
      clearSelection: vi.fn(),
      toastInfo: vi.fn(),
      viewport,
      ...(opts.suspended ? { snapSuspended: opts.suspended } : {}),
    }),
  );
}

// The view at p2's fit, panned `dx` screen px toward the next page.
const pannedFromP2 = (dx: number) => {
  const fit = fitOf('p2');
  return { zoom: fit.zoom, offset: { x: fit.offset.x - dx / fit.zoom, y: fit.offset.y } };
};
const nextFrame = () =>
  act(() => {
    vi.advanceTimersByTime(20);
  });
const rest = () =>
  act(() => {
    vi.advanceTimersByTime(VIEW_REST_MS);
  });

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  resetCanvasGesturesForTests();
  vi.mocked(track).mockClear();
});
afterEach(() => vi.useRealTimers());

describe('a pan letting go', () => {
  it('turns to the next page after a short pan from a page seen whole', () => {
    const viewport = createViewportStore(fitOf('p2').zoom);
    viewport.setView(fitOf('p2'));
    mount(viewport);
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('pan');
    });
    act(() => viewport.setView(pannedFromP2(300)));
    act(() => end());
    nextFrame();
    expect(viewport.get()).toEqual(fitOf('p3'));
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'PageSwipe');
  });

  it('springs back onto the page after a small one', () => {
    const viewport = createViewportStore(fitOf('p2').zoom);
    viewport.setView(fitOf('p2'));
    mount(viewport);
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('pan');
    });
    act(() => viewport.setView(pannedFromP2(60)));
    // Held still long enough that it is no flick.
    act(() => {
      vi.advanceTimersByTime(FLICK_WINDOW_MS + 20);
    });
    act(() => end());
    nextFrame();
    expect(viewport.get()).toEqual(fitOf('p2'));
    expect(track).not.toHaveBeenCalled();
  });

  it('never snaps while a pointer is still held, then does once it lifts', () => {
    const viewport = createViewportStore(fitOf('p2').zoom);
    viewport.setView(fitOf('p2'));
    mount(viewport);
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
    });
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('pan');
    });
    act(() => viewport.setView(pannedFromP2(300)));
    act(() => end());
    nextFrame();
    expect(viewport.get()).toEqual(pannedFromP2(300));
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    });
    nextFrame();
    expect(viewport.get()).toEqual(fitOf('p3'));
  });
});

describe('a zoom letting go', () => {
  it('fits the page when zoomed out past it, and never turns the page', () => {
    const viewport = createViewportStore(fitOf('p2').zoom);
    viewport.setView(fitOf('p2'));
    mount(viewport);
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('zoom');
    });
    act(() => viewport.setView({ ...pannedFromP2(300), zoom: fitOf('p2').zoom / 2 }));
    act(() => end());
    nextFrame();
    expect(viewport.get()).toEqual(fitOf('p2'));
  });
});

describe('a view moved by anything else', () => {
  it('snaps once it has rested, not before', () => {
    const viewport = createViewportStore(fitOf('p2').zoom);
    mount(viewport);
    act(() => viewport.setView({ zoom: fitOf('p2').zoom / 3, offset: fitOf('p2').offset }));
    act(() => {
      vi.advanceTimersByTime(VIEW_REST_MS - 10);
    });
    expect(viewport.get().zoom).toBe(fitOf('p2').zoom / 3);
    rest();
    expect(viewport.get()).toEqual(fitOf('p2'));
  });

  it('leaves the view be while following or presenting', () => {
    const viewport = createViewportStore(fitOf('p2').zoom);
    mount(viewport, { suspended: () => true });
    const loose = { zoom: fitOf('p2').zoom / 3, offset: fitOf('p2').offset };
    act(() => viewport.setView(loose));
    rest();
    expect(viewport.get()).toEqual(loose);
  });
});

describe('flickVelocity', () => {
  it('is the speed over the last window, 0 once it had stopped', () => {
    const samples = [
      { t: 0, x: 0 },
      { t: 100, x: -10 },
      { t: 150, x: -60 },
    ];
    expect(flickVelocity(samples, 150)).toBe(-1);
    expect(flickVelocity(samples, 150 + FLICK_WINDOW_MS + 1)).toBe(0);
    expect(flickVelocity([], 0)).toBe(0);
  });
});
