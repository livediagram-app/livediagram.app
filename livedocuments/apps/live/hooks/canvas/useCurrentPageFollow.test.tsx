// @vitest-environment jsdom

// docs/specs/007-editor/pages-mode.md "The palette's kind": the palette follows the page someone is on.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage, type LaidOutPage } from '@livedocuments/document';
import { onPaletteCategoryRequest } from '@/lib/palette-category-request';
import { createViewportStore } from '@/lib/viewport-store';
import { currentPageIdNow, setCurrentPageKind } from '@/lib/current-page-kind';
import type { ReactNode } from 'react';
import { ViewportStoreProvider } from './useViewportStore';
import { useCurrentPageFollow } from './useCurrentPageFollow';

let asked: string[] = [];
let off = () => {};
beforeEach(() => {
  asked = [];
  off = onPaletteCategoryRequest((id) => asked.push(id));
  setCurrentPageKind(null);
  vi.useFakeTimers();
});
afterEach(() => {
  off();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const infographic = layOutPages([{ id: 'i', orientation: 'portrait' }]);
const both = layOutPages([{ id: 'i', orientation: 'portrait' }, newSlidePage('s')]);

// A sheet on screen for each page, side by side, 100 px wide.
function sheets(pages: readonly LaidOutPage[]) {
  pages.forEach((p, i) => {
    const el = document.createElement('div');
    el.setAttribute('data-page-id', p.id);
    el.getBoundingClientRect = () =>
      ({ left: i * 200, right: i * 200 + 100, top: 0, bottom: 100 }) as DOMRect;
    document.body.appendChild(el);
  });
}
// A press at x on the canvas content (or, `chrome`, on a palette floating over it).
const press = (x: number, chrome = false) => {
  const host = document.createElement('div');
  if (!chrome) host.setAttribute('data-canvas-content', '');
  document.body.appendChild(host);
  host.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: 50, bubbles: true }));
  host.remove();
  vi.runAllTimers();
};

describe('useCurrentPageFollow', () => {
  it('takes the page in view on opening, asking nothing', () => {
    renderHook(() => useCurrentPageFollow(infographic, true));
    vi.runAllTimers();
    expect(asked).toEqual([]);
    expect(currentPageIdNow()).toBe('i');
  });

  it('moves onto a page added, asking for Popular', () => {
    const { rerender } = renderHook(({ pages }) => useCurrentPageFollow(pages, true), {
      initialProps: { pages: infographic },
    });
    rerender({ pages: both });
    vi.runAllTimers();
    expect(asked).toEqual(['popular']);
    expect(currentPageIdNow()).toBe('s');
  });

  it('asks for Popular when a press moves page, never when it stays', () => {
    sheets(both);
    renderHook(() => useCurrentPageFollow(both, true));
    press(50);
    expect(asked).toEqual([]);
    press(250);
    press(260);
    expect(asked).toEqual(['popular']);
    expect(currentPageIdNow()).toBe('s');
  });

  it('stays quiet when inactive (a viewer, or a bare view)', () => {
    sheets(both);
    renderHook(() => useCurrentPageFollow(both, false));
    press(250);
    expect(asked).toEqual([]);
  });

  it('follows a page gone to (its label, the navigator), once per page', () => {
    const { result } = renderHook(() => useCurrentPageFollow(both, true));
    vi.runAllTimers();
    act(() => result.current.pageShown(both[1]!));
    act(() => result.current.pageShown(both[1]!));
    vi.runAllTimers();
    expect(asked).toEqual(['popular']);
    expect(currentPageIdNow()).toBe('s');
  });

  it('ignores a press on chrome floating over a page (a palette category just chosen)', () => {
    sheets(both);
    renderHook(() => useCurrentPageFollow(both, true));
    press(50);
    press(250, true);
    expect(asked).toEqual([]);
  });

  it('follows a view that comes to rest on another page (a pan, a scroll)', () => {
    const store = createViewportStore(1);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewportStoreProvider store={store}>{children}</ViewportStoreProvider>
    );
    sheets(both);
    // The canvas, its centre over the first page, then over the slide.
    const canvas = document.createElement('div');
    canvas.setAttribute('data-canvas-a11y-root', '');
    let centre = 50;
    canvas.getBoundingClientRect = () =>
      ({ left: centre - 50, top: 0, width: 100, height: 100 }) as DOMRect;
    document.body.appendChild(canvas);
    renderHook(() => useCurrentPageFollow(both, true), { wrapper });
    act(() => {
      vi.runAllTimers();
    });
    asked = [];
    centre = 250;
    act(() => {
      store.setOffset({ x: -200, y: 0 });
      vi.runAllTimers();
    });
    expect(asked).toEqual(['popular']);
    // Resting between pages keeps the page last on.
    centre = 150;
    act(() => {
      store.setOffset({ x: -100, y: 0 });
      vi.runAllTimers();
    });
    expect(asked).toEqual(['popular']);
    expect(currentPageIdNow()).toBe('s');
  });
});
