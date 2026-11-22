// @vitest-environment jsdom

// A page read in its own scrolled column (docs/specs/030-knowledgebase/page-surface.md "No zoom and no panning")
// never snaps: a press let go after On This Page or a found passage scrolled the column must leave it where it landed,
// not glide the view back to the page's top (WI-1372).

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import { createPageViewportStore } from '@/lib/page-surface/page-viewport-store';
import { VIEW_REST_MS } from './usePageSnap';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const tab = {
  id: 't',
  name: 't',
  elements: [],
  pages: [{ id: 'p1', size: 'a4', orientation: 'portrait' }],
} as unknown as Tab;

/** A scrolling column whose scrollTop holds what it is set to (jsdom's is always 0). */
function column() {
  const el = document.createElement('div');
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  return el;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('leaves a scrolled page where it is when a press lets go', () => {
  const canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: 1200 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 800 });
  const store = createPageViewportStore({ followsScroll: () => false });
  const scroller = column();
  store.attach(scroller);
  store.lockTo({ zoom: 1, offset: { x: 0, y: 0 } });
  renderHook(() =>
    usePagesMode({
      activeTab: tab,
      canEdit: false,
      tabLoaded: false,
      commitTabs: vi.fn(),
      canvasMainRef: { current: canvas },
      setViewportZoom: store.setZoom,
      setViewportOffset: store.setOffset,
      getViewport: store.get,
      clearSelection: vi.fn(),
      toastInfo: vi.fn(),
      viewport: store,
    }),
  );
  // Scrolled down to a heading, as On This Page does, then the press that asked for it lets go.
  act(() => {
    scroller.scrollTop = 1000;
    scroller.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  });
  act(() => {
    vi.advanceTimersByTime(VIEW_REST_MS + 1000);
  });
  expect(scroller.scrollTop).toBe(1000);
});
