// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@/lib/viewport-store';
import { useZoomControls } from './useZoomControls';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The zoom buttons step from the zoom as it is when pressed, and keep their identity across zooms,
// so the chrome holding them does not render for a zoom
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas").

describe('useZoomControls', () => {
  it('steps from the current zoom, read when pressed', () => {
    const store = createViewportStore(1);
    const { result } = renderHook(() => useZoomControls(store.setZoom));
    result.current.zoomIn();
    result.current.zoomIn();
    const afterTwo = store.get().zoom;
    result.current.zoomOut();
    expect(afterTwo).toBeGreaterThan(1);
    expect(store.get().zoom).toBeLessThan(afterTwo);
  });

  it('jumps to a preset level, clamped', () => {
    const store = createViewportStore(1);
    const { result } = renderHook(() => useZoomControls(store.setZoom));
    result.current.setZoomTo(0.5);
    expect(store.get().zoom).toBe(0.5);
  });
});

describe('useZoomControls identity', () => {
  it('keeps the same handlers across renders, so what holds them does not render for a zoom', () => {
    const store = createViewportStore(1);
    const { result, rerender } = renderHook(() => useZoomControls(store.setZoom));
    const first = result.current;
    store.setZoom(2);
    rerender();
    expect(result.current).toBe(first);
  });
});
