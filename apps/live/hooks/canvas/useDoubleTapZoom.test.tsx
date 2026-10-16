// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/viewport-glide', () => ({ glideViewport: vi.fn(() => vi.fn()) }));

import { track } from '@/lib/telemetry';
import { glideViewport } from '@/lib/viewport-glide';
import { createViewportStore } from '@/lib/viewport-store';
import { useDoubleTapZoom } from './useDoubleTapZoom';

// The hook glides the view to doubleTapZoomView's answer (docs/specs/008-canvas/canvas-and-palette.md
// "Double-tap to zoom") and counts it.

const main = () => {
  const node = document.createElement('main');
  Object.defineProperty(node, 'offsetWidth', { value: 400 });
  Object.defineProperty(node, 'offsetHeight', { value: 800 });
  return { current: node };
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('useDoubleTapZoom', () => {
  it('glides from the view now to the tapped point centred at the next zoom, and counts it', () => {
    const store = createViewportStore(0.6);
    const { result } = renderHook(() => useDoubleTapZoom(main(), store));
    result.current({ x: 500, y: 100 });
    expect(glideViewport).toHaveBeenCalledWith(
      { zoom: 0.6, offset: { x: 0, y: 0 } },
      { zoom: 1.2, offset: { x: -300, y: 300 } },
      { zoom: store.setZoom, offset: store.setOffset },
    );
    expect(track).toHaveBeenCalledWith('Canvas', 'Zoomed', 'DoubleTap');
  });

  it('stops a running glide before starting the next, and when the canvas goes', () => {
    const stops = [vi.fn(), vi.fn()];
    vi.mocked(glideViewport).mockReturnValueOnce(stops[0]!).mockReturnValueOnce(stops[1]!);
    const { result, unmount } = renderHook(() => useDoubleTapZoom(main(), createViewportStore(1)));
    result.current({ x: 0, y: 0 });
    result.current({ x: 0, y: 0 });
    expect(stops[0]).toHaveBeenCalledTimes(1);
    unmount();
    expect(stops[1]).toHaveBeenCalledTimes(1);
  });

  it('does nothing before the canvas is mounted', () => {
    const { result } = renderHook(() =>
      useDoubleTapZoom({ current: null }, createViewportStore(1)),
    );
    result.current({ x: 0, y: 0 });
    expect(glideViewport).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
