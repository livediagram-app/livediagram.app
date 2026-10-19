// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { tileColumns } from './useTileWidth';

describe('tileColumns', () => {
  it('fits as many tiles as the width holds at their least width', () => {
    expect(tileColumns(500, 156, 8)).toEqual({ cols: 3, tileWidth: (500 - 16) / 3 });
    expect(tileColumns(820, 156, 8).cols).toBe(5);
  });

  it('keeps two columns however narrow, and two fallback tiles before measuring', () => {
    expect(tileColumns(200, 156, 8).cols).toBe(2);
    expect(tileColumns(0, 156, 8)).toEqual({ cols: 2, tileWidth: 168 });
  });
});

describe('useTileWidth', () => {
  it('measures its row and follows it as it resizes', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    let fire: ((width: number) => void) | null = null;
    const RO = class {
      constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
        fire = (width) => cb([{ contentRect: { width } }]);
      }
      observe() {}
      disconnect() {}
    };
    const prior = globalThis.ResizeObserver;
    globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
    const { useTileWidth } = await import('./useTileWidth');
    const div = document.createElement('div');
    const { result } = renderHook(() => {
      const t = useTileWidth(156, 8);
      (t.ref as { current: HTMLDivElement | null }).current = div;
      return t;
    });
    act(() => fire!(820));
    expect(result.current.cols).toBe(5);
    globalThis.ResizeObserver = prior;
  });
});
