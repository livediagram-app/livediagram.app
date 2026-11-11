// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type Element } from '@livehuddle/document';
import { storedArrow } from '@/test/retired-elements';
import { useOffscreenContent } from './useOffscreenContent';

beforeEach(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());

// The "bring it back" nudge (OffscreenContentHint) shows while every element is out of view.
function main(width = 800, height = 600) {
  const el = document.createElement('main');
  el.getBoundingClientRect = () => ({ width, height, left: 0, top: 0 }) as DOMRect;
  return { current: el };
}

const square = { ...createSticky(100, 100), width: 100, height: 100 } as Element;

// The view the hook reads, in a store as the editor's canvas has one.
function viewAt(offset = { x: 0, y: 0 }, zoom = 1) {
  const store = createViewportStore(zoom);
  store.setOffset(offset);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ViewportStoreProvider, { store, children });
  return { store, wrapper };
}

function offscreen(elements: Element[], offset = { x: 0, y: 0 }, zoom = 1) {
  const ref = main();
  const { store, wrapper } = viewAt(offset, zoom);
  return { store, ...renderHook(() => useOffscreenContent(elements, ref), { wrapper }) };
}

describe('useOffscreenContent', () => {
  it('is false while the content is in view', () => {
    expect(offscreen([square]).result.current).toBe(false);
  });

  it('is true once the content is panned entirely out of view', () => {
    expect(offscreen([square], { x: -5000, y: 0 }).result.current).toBe(true);
  });

  it('follows the pan both ways', () => {
    const { result, store } = offscreen([square]);
    act(() => store.setOffset({ x: -5000, y: 0 }));
    expect(result.current).toBe(true);
    act(() => store.setOffset({ x: 0, y: 0 }));
    expect(result.current).toBe(false);
  });

  it('is false on a tab with nothing boxed to see', () => {
    const arrow = storedArrow('a', { x: 0, y: 0 }, { x: 10, y: 10 });
    expect(offscreen([], { x: -5000, y: 0 }).result.current).toBe(false);
    expect(offscreen([arrow], { x: -5000, y: 0 }).result.current).toBe(false);
  });

  it('counts a page in view as something to see', () => {
    const ref = main();
    const page = { rect: { x: 5000, y: -400, width: 800, height: 1200 } };
    const { wrapper } = viewAt({ x: -5000, y: 0 });
    expect(
      renderHook(() => useOffscreenContent([square], ref, [page]), { wrapper }).result.current,
    ).toBe(false);
    expect(renderHook(() => useOffscreenContent([], ref, [page]), { wrapper }).result.current).toBe(
      false,
    );
  });

  it('is false with no canvas to measure', () => {
    const { wrapper } = viewAt({ x: -5000, y: 0 });
    const { result } = renderHook(() => useOffscreenContent([square], () => {}), { wrapper });
    expect(result.current).toBe(false);
  });
});
