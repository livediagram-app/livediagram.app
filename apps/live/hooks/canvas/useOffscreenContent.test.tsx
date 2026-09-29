// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createArrow, createShape, type Element } from '@livediagram/document';
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

const square = { ...createShape('square', 100, 100), width: 100, height: 100 } as Element;

function offscreen(elements: Element[], offset = { x: 0, y: 0 }, zoom = 1) {
  const ref = main();
  return renderHook(({ o, z }) => useOffscreenContent(elements, o, z, ref), {
    initialProps: { o: offset, z: zoom },
  });
}

describe('useOffscreenContent', () => {
  it('is false while the content is in view', () => {
    expect(offscreen([square]).result.current).toBe(false);
  });

  it('is true once the content is panned entirely out of view', () => {
    expect(offscreen([square], { x: -5000, y: 0 }).result.current).toBe(true);
  });

  it('follows the pan both ways', () => {
    const { result, rerender } = offscreen([square]);
    rerender({ o: { x: -5000, y: 0 }, z: 1 });
    expect(result.current).toBe(true);
    rerender({ o: { x: 0, y: 0 }, z: 1 });
    expect(result.current).toBe(false);
  });

  it('is false on a tab with nothing boxed to see', () => {
    const arrow = createArrow(0, 0, 10, 10) as Element;
    expect(offscreen([], { x: -5000, y: 0 }).result.current).toBe(false);
    expect(offscreen([arrow], { x: -5000, y: 0 }).result.current).toBe(false);
  });

  it('is false with no canvas to measure', () => {
    const { result } = renderHook(() =>
      useOffscreenContent([square], { x: -5000, y: 0 }, 1, () => {}),
    );
    expect(result.current).toBe(false);
  });
});
