// @vitest-environment jsdom

// A new page comes into view (docs/specs/007-editor/pages-mode.md): after Add page the view glides to frame the new
// page, and `framing` says so from the add until the glide lands, so the caret's reveal in the new page's title holds
// off rather than pulling the view back to the edge of the page before it.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@livedocuments/document';
import { computeFitBelow } from '@liveworkspace/workbench/lib/viewport';
import {
  createViewportStore,
  type ViewportStore,
} from '@liveworkspace/workbench/lib/viewport-store';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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
