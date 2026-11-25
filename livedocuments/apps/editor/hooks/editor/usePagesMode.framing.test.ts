// @vitest-environment jsdom

// A new page comes into view (docs/specs/007-editor/pages-mode.md): after Add page the view glides to frame the new
// page, and `framing` says so from the add until the glide lands, so the caret's reveal in the new page's title holds
// off rather than pulling the view back to the edge of the page before it.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@livedocuments/document';
import { besideSideInsets, computeFitBelow } from '@liveworkspace/workbench/lib/viewport';
import {
  createViewportStore,
  type ViewportStore,
} from '@liveworkspace/workbench/lib/viewport-store';
import { usePagesMode } from './usePagesMode';
import { VIEW_REST_MS } from './usePageSnap';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';

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

function mount(viewport: ViewportStore) {
  const canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: SIZE.width });
  Object.defineProperty(canvas, 'offsetHeight', { value: SIZE.height });
  let tabs = [TAB];
  const commitTabs = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const hook = renderHook(
    (activeTab: Tab) =>
      usePagesMode({
        activeTab,
        canEdit: true,
        tabLoaded: true,
        commitTabs,
        canvasMainRef: { current: canvas },
        setViewportZoom: viewport.setZoom,
        setViewportOffset: viewport.setOffset,
        getViewport: viewport.get,
        clearSelection: vi.fn(),
        toastInfo: vi.fn(),
        frameFirstPageRef: { current: null },
        viewport,
      }),
    { initialProps: TAB },
  );
  return { ...hook, tab: () => tabs[0]! };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('framing a page just added', () => {
  it('is framing from the add until the glide lands on the new page, and not at rest', () => {
    const viewport = createViewportStore(1);
    const h = mount(viewport);
    expect(h.result.current.framing!()).toBe(false);

    act(() => h.result.current.edit!.addPageLike!('p2'));
    // Asked for, before the new page is in the row.
    expect(h.result.current.framing!()).toBe(true);

    const added = h.tab();
    const id = pagesOf(added).at(-1)!.id;
    h.rerender(added);
    // In the row: the frame glides there a frame later.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(h.result.current.framing!()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(h.result.current.framing!()).toBe(false);
    const page = layOutPages(pagesOf(added)).find((p) => p.id === id)!;
    expect(viewport.get().offset.x).toBeCloseTo(computeFitBelow(SIZE, page.rect, 0).offset.x, 0);
  });
});

// Work Tracker 1439: Contents docking frames the page beside it with a glide; the rest snap timed from the landing
// frame (which had no sidebar to stand beside yet) fired just after, stopped that glide short and left the page under
// the sidebar.
describe("a rest snap during a frame's glide", () => {
  it('gives way to the glide, which lands on the page framed beside the sidebar', () => {
    const viewport = createViewportStore(1);
    const h = mount(viewport);
    // The landing frame, a frame after mount, with nothing beside the page: it starts the rest timer.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    // Contents docks down the left (its code loaded after the landing frame), 800 px wide, so the page is framed narrower.
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
    const sidebar = document.createElement('aside');
    sidebar.setAttribute('data-contents-sidebar', '');
    sidebar.getBoundingClientRect = () => box(0, 800);
    document.body.append(sidebar);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this === sidebar ? box(0, 800) : box(0, SIZE.width);
    });
    // Its framing glide starts just before the rest snap is due, its first step not yet taken when the snap fires.
    act(() => {
      vi.advanceTimersByTime(VIEW_REST_MS - 8);
    });
    vi.mocked(glideViewport).mockClear();
    act(() => h.result.current.focusPage('p1'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    sidebar.remove();
    // One glide, the frame's: the snap that came due during it gave way.
    expect(vi.mocked(glideViewport)).toHaveBeenCalledTimes(1);
    const p1 = layOutPages(pagesOf(TAB)).find((p) => p.id === 'p1')!;
    // The sidebar covers at most half the canvas (sideInsetsOf).
    const sides = { left: 600, right: 0 };
    const want = besideSideInsets(
      computeFitBelow({ width: SIZE.width - 600, height: SIZE.height }, p1.rect, 0),
      sides,
    );
    expect(viewport.get().zoom).toBeCloseTo(want.zoom, 4);
    expect(viewport.get().offset.x).toBeCloseTo(want.offset.x, 0);
  });
});
