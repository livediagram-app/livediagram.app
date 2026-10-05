// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@/lib/viewport-store';
import {
  ViewportStoreProvider,
  useCanvasViewKey,
  useViewportOf,
  useViewportStore,
} from './useViewportStore';

// docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas".

describe('useViewportOf', () => {
  it('re-renders a reader only when its slice of the view changes', () => {
    const store = createViewportStore(1);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewportStoreProvider store={store}>{children}</ViewportStoreProvider>
    );
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useViewportOf((v) => v.zoom);
      },
      { wrapper },
    );
    const before = renders;
    act(() => store.setOffset({ x: 4, y: 4 }));
    expect(renders).toBe(before);
    act(() => store.setZoom(3));
    expect(result.current).toBe(3);
  });
});

describe('useViewportStore', () => {
  it('throws outside a provider, never a silent default view', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useViewportStore())).toThrow('ViewportStoreMissing');
  });
});

describe('useCanvasViewKey', () => {
  it('names what moves the canvas on screen: the view and the canvas size', () => {
    const store = createViewportStore(2);
    store.setOffset({ x: 3, y: 4 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewportStoreProvider store={store}>{children}</ViewportStoreProvider>
    );
    const { result } = renderHook(() => useCanvasViewKey({ width: 800, height: 600 }), { wrapper });
    expect(result.current).toEqual({ viewportZoom: 2, viewKey: '3,4,2,800,600' });
    act(() => store.setZoom(3));
    expect(result.current.viewKey).toBe('3,4,3,800,600');
  });
});
