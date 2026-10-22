// @vitest-environment jsdom

// Landing on a tab that shows pages frames its first page, never the whole row of pages
// (docs/specs/007-editor/pages-mode.md "Getting around the pages"): the tab-entry fit is
// handed the first-page framing through `frameFirstPageRef`.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type EditorMode, type Tab } from '@livedesign/document';
import { computeFitBelow } from '@/lib/viewport';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Three A4 pages in a row: fitting the whole row zooms far out of any one of them.
const threePages = (): Tab =>
  ({
    id: 't',
    name: 'T',
    elements: [],
    pages: [
      { id: 'p1', size: 'a4' },
      { id: 'p2', size: 'a4' },
      { id: 'p3', size: 'a4' },
    ],
  }) as unknown as Tab;

function mount(mode: EditorMode) {
  const canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: 1200 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 800 });
  const setViewportZoom = vi.fn();
  const setViewportOffset = vi.fn();
  const frameFirstPageRef = { current: null as (() => void) | null };
  const tab = threePages();
  const hook = renderHook(
    (m: EditorMode) =>
      usePagesMode({
        activeTab: tab,
        mode: m,
        canEdit: true,
        tabLoaded: true,
        commitTabs: vi.fn(),
        canvasMainRef: { current: canvas },
        setViewportZoom,
        setViewportOffset,
        getViewport: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
        clearSelection: vi.fn(),
        toastInfo: vi.fn(),
        frameFirstPageRef,
      }),
    { initialProps: mode },
  );
  return { tab, canvas, setViewportZoom, setViewportOffset, frameFirstPageRef, ...hook };
}

describe('the tab-entry fit on a tab of pages', () => {
  it('frames the first page, not the whole row', () => {
    const h = mount('pages');
    h.setViewportZoom.mockClear();
    h.frameFirstPageRef.current!();
    const first = layOutPages(pagesOf(h.tab))[0]!;
    const expected = computeFitBelow({ width: 1200, height: 800 }, first.rect, 0);
    expect(h.setViewportZoom).toHaveBeenLastCalledWith(expected.zoom);
    expect(h.setViewportOffset).toHaveBeenLastCalledWith(expected.offset);
    // A page fills the view at a readable zoom, far from a three-page row's fit.
    expect(expected.zoom).toBeGreaterThan(0.5);
  });

  it('leaves the ordinary fit alone outside the pages modes', () => {
    const h = mount('pages');
    expect(h.frameFirstPageRef.current).toBeTypeOf('function');
    h.rerender('diagram');
    expect(h.frameFirstPageRef.current).toBeNull();
  });
});
