// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type Layer } from '@livedocuments/document';
import { useLayerThumbnails } from './useLayerThumbnails';

vi.mock('@liveworkspace/workbench/hooks/ui/useIconCatalogs', () => ({
  useIconCatalogs: () => true,
}));

// A closed panel draws nothing of the board (docs/specs/008-canvas/canvas-performance.md): the
// Layers panel stays mounted once opened, so its previews are drawn only while it is open.
const layers: Layer[] = [{ id: 'layer:default', name: 'Layer 1' }];
const board = (n: number): Element[] =>
  Array.from({ length: n }, (_, i) => ({ ...createShape('square', i * 200, 0), id: `s${i}` }));

describe('useLayerThumbnails', () => {
  it('draws nothing while disabled, one empty value for every board, and draws again once enabled', () => {
    const { result, rerender } = renderHook(
      ({ elements, enabled }) => useLayerThumbnails(elements, layers, undefined, enabled),
      { initialProps: { elements: board(3), enabled: false } },
    );
    const closed = result.current;
    expect(closed.thumbMarkup.size).toBe(0);
    expect(closed.thumbViewBox).toBeNull();
    rerender({ elements: board(4), enabled: false });
    expect(result.current).toBe(closed);
    rerender({ elements: board(4), enabled: true });
    expect(result.current.thumbMarkup.get('layer:default')).toContain('<');
    expect(result.current.thumbViewBox).not.toBeNull();
  });

  it('is enabled by default, and an empty board reads the empty value', () => {
    const { result, rerender } = renderHook(
      ({ elements }) => useLayerThumbnails(elements, layers),
      {
        initialProps: { elements: board(1) },
      },
    );
    expect(result.current.thumbMarkup.size).toBe(1);
    rerender({ elements: [] });
    expect(result.current.thumbMarkup.size).toBe(0);
  });
});
