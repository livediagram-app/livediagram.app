// @vitest-environment jsdom

// Back to the page you were on (docs/specs/007-editor/pages-mode.md): the page the view
// rests on is remembered per tab in this browser, and landing on the tab again (a tab switch, a
// reload) frames it rather than the first.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@livedesign/document';
import { computeFitBelow } from '@/lib/viewport';
import { createViewportStore, type ViewportStore } from '@/lib/viewport-store';
import { LAST_PAGE_SETTLE_MS, lastPageKey, readLastPage } from '@/lib/last-page';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const SIZE = { width: 1200, height: 800 };
const tabOf = (id: string): Tab =>
  ({
    id,
    name: id,
    elements: [],
    pages: [
      { id: 'p1', size: 'a4', orientation: 'portrait' },
      { id: 'p2', size: 'a4', orientation: 'portrait' },
      { id: 'p3', size: 'a4', orientation: 'portrait' },
    ],
  }) as unknown as Tab;
const fitOf = (tab: Tab, pageId: string) => {
  const page = layOutPages(pagesOf(tab)).find((p) => p.id === pageId)!;
  return computeFitBelow(SIZE, page.rect, 0);
};

function mount(viewport: ViewportStore, tab = tabOf('t')) {
  const canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: SIZE.width });
  Object.defineProperty(canvas, 'offsetHeight', { value: SIZE.height });
  const frameFirstPageRef = { current: null as (() => void) | null };
  const hook = renderHook(
    (activeTab: Tab) =>
      usePagesMode({
        activeTab,
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
        documentId: 'd',
        viewport,
      }),
    { initialProps: tab },
  );
  return { frameFirstPageRef, ...hook };
}

// The view moved onto a page as a pan would leave it, then left to settle.
const restOn = (viewport: ViewportStore, tab: Tab, pageId: string) => {
  act(() => viewport.setOffset(fitOf(tab, pageId).offset));
  act(() => {
    vi.advanceTimersByTime(LAST_PAGE_SETTLE_MS);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('landing on a tab of pages', () => {
  it('frames the first page the first time', () => {
    const viewport = createViewportStore(1);
    const h = mount(viewport);
    act(() => h.frameFirstPageRef.current!());
    expect(viewport.get().offset).toEqual(fitOf(tabOf('t'), 'p1').offset);
  });

  it('frames the page the view last rested on, after a reload', () => {
    const first = createViewportStore(1);
    const h = mount(first);
    act(() => h.frameFirstPageRef.current!());
    restOn(first, tabOf('t'), 'p3');
    expect(readLastPage(lastPageKey('d', 't'))).toBe('p3');
    h.unmount();

    const reloaded = createViewportStore(1);
    const again = mount(reloaded);
    act(() => again.frameFirstPageRef.current!());
    expect(reloaded.get().offset).toEqual(fitOf(tabOf('t'), 'p3').offset);
  });

  it("records nothing before the landing frame (the view may still be the last tab's)", () => {
    const viewport = createViewportStore(1);
    mount(viewport);
    restOn(viewport, tabOf('t'), 'p2');
    expect(readLastPage(lastPageKey('d', 't'))).toBeUndefined();
  });

  it('keeps a move still settling when the tab is left', () => {
    const viewport = createViewportStore(1);
    const h = mount(viewport);
    act(() => h.frameFirstPageRef.current!());
    act(() => viewport.setOffset(fitOf(tabOf('t'), 'p2').offset));
    h.rerender(tabOf('u'));
    expect(readLastPage(lastPageKey('d', 't'))).toBe('p2');
    // The other tab, not yet framed, records nothing of the view it inherited.
    act(() => {
      vi.advanceTimersByTime(LAST_PAGE_SETTLE_MS);
    });
    expect(readLastPage(lastPageKey('d', 'u'))).toBeUndefined();
  });

  it('keeps a move still settling when the page is closed', () => {
    const viewport = createViewportStore(1);
    const h = mount(viewport);
    act(() => h.frameFirstPageRef.current!());
    act(() => viewport.setOffset(fitOf(tabOf('t'), 'p3').offset));
    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(readLastPage(lastPageKey('d', 't'))).toBe('p3');
  });

  it('falls back to the first page when the remembered one is gone', () => {
    const viewport = createViewportStore(1);
    const h = mount(viewport);
    act(() => h.frameFirstPageRef.current!());
    restOn(viewport, tabOf('t'), 'p3');
    const fewer = {
      ...tabOf('t'),
      pages: [
        { id: 'p1', size: 'a4', orientation: 'portrait' },
        { id: 'p2', size: 'a4', orientation: 'portrait' },
      ],
    };
    h.rerender(fewer as unknown as Tab);
    act(() => viewport.setOffset({ x: 9999, y: 9999 }));
    act(() => h.frameFirstPageRef.current!());
    expect(viewport.get().offset).toEqual(fitOf(fewer as unknown as Tab, 'p1').offset);
  });
});
