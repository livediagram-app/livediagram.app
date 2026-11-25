// @vitest-environment jsdom

// A rest snap gives way to a frame's glide (docs/specs/007-editor/pages-mode.md "Getting around the pages"; Work
// Tracker 1439): Contents docking frames the page beside it with a glide, and the rest snap timed from the landing
// frame (which had no sidebar to stand beside yet) fired just after, stopping that glide short and leaving the page
// under the sidebar.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';
import { VIEW_REST_MS } from './usePageSnap';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The real glide, counted: a rest snap that took over a frame's glide would start a second one.
vi.mock('@liveworkspace/workbench/lib/viewport-glide', async (actual) => {
  const real = await actual<typeof import('@liveworkspace/workbench/lib/viewport-glide')>();
  return { ...real, glideViewport: vi.fn(real.glideViewport) };
});

const SIZE = { width: 1200, height: 800 };
const TAB = {
  id: 't',
  name: 't',
  elements: [],
  pages: [
    { id: 'p1', size: 'a4', orientation: 'portrait' },
    { id: 'p2', size: 'a4', orientation: 'portrait' },
  ],
} as unknown as Tab;

const box = (left: number, right: number) =>
  ({
    left,
    right,
    top: 0,
    bottom: SIZE.height,
    width: right - left,
    height: SIZE.height,
    x: left,
    y: 0,
  }) as DOMRect;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a rest snap during a frame's glide", () => {
  it('gives way, so the glide is the only one and lands', () => {
    const viewport = createViewportStore(1);
    const canvas = document.createElement('main');
    Object.defineProperty(canvas, 'offsetWidth', { value: SIZE.width });
    Object.defineProperty(canvas, 'offsetHeight', { value: SIZE.height });
    const frameFirstPageRef = { current: null as (() => void) | null };
    const h = renderHook(() =>
      usePagesMode({
        activeTab: TAB,
        canEdit: true,
        tabLoaded: false,
        commitTabs: vi.fn(),
        canvasMainRef: { current: canvas },
        setViewportZoom: viewport.setZoom,
        setViewportOffset: viewport.setOffset,
        getViewport: viewport.get,
        clearSelection: vi.fn(),
        toastInfo: vi.fn(),
        frameFirstPageRef,
        designId: 'd',
        viewport,
      }),
    );
    // The landing frame, with nothing beside the page: it starts the rest timer.
    act(() => frameFirstPageRef.current?.());
    // Contents docks down the left once its code has loaded.
    const sidebar = document.createElement('aside');
    sidebar.setAttribute('data-contents-sidebar', '');
    document.body.append(sidebar);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this === sidebar ? box(0, 600) : box(0, SIZE.width);
    });
    // Its framing glide starts just before the rest snap is due, its first step not yet taken when the snap fires.
    act(() => {
      vi.advanceTimersByTime(VIEW_REST_MS - 8);
    });
    vi.mocked(glideViewport).mockClear();
    const before = viewport.get();
    act(() => h.result.current.focusPage('p1'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    sidebar.remove();
    expect(vi.mocked(glideViewport)).toHaveBeenCalledTimes(1);
    expect(viewport.get()).not.toEqual(before);
  });
});
