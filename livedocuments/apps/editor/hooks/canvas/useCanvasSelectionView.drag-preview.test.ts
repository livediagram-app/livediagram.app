// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedocuments/document';
import { useCanvasSelectionView } from './useCanvasSelectionView';
import { resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { endImageCrop, startImageCrop } from '@liveworkspace/workbench/lib/image-crop-store';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/hooks/canvas/useSelectionStore', () => ({
  useSelectionOf: (pick: (s: unknown) => unknown) =>
    pick({ selectedId: 'b', multiSelectedIds: new Set<string>() }),
}));

const box = {
  id: 'b',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
} as Element;
const input = {
  elements: [box],
  editingId: null,
  isPaintMode: false,
  tabLocked: false,
  readOnly: false,
};

// docs/specs/008-canvas/drag-preview.md: the chrome reads the selection through the drag preview on its
// own tab, since the canvas does not render for a preview frame.
describe('selection chrome during a drag preview', () => {
  afterEach(() => resetDragPreviewForTests());

  it('follows the preview on its tab and ignores one on another', () => {
    const grown = { ...box, width: 600 } as Element;
    const { result } = renderHook(() => useCanvasSelectionView(input, 't'));
    act(() => setLocalPreview('other', [grown], [box]));
    expect(result.current.selectionBounds?.width).toBe(400);
    act(() => setLocalPreview('t', [grown], input.elements));
    expect(result.current.selectionBounds?.width).toBe(600);
    act(() => resetDragPreviewForTests());
    expect(result.current.selectionBounds?.width).toBe(400);
  });
});

// docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor": the chrome reads the crop store, so
// the toolbar and the pluses stand down as a crop starts and come back as it ends, however it ends.
describe('selection chrome while an image is cropped', () => {
  afterEach(() => endImageCrop());

  it('stands down while cropping and comes back after', () => {
    const { result } = renderHook(() => useCanvasSelectionView(input, 't'));
    expect(result.current.showPopover).toBe(true);
    expect(result.current.showPlus).toBe(true);
    act(() => startImageCrop('b'));
    expect(result.current.showPopover).toBe(false);
    expect(result.current.showPlus).toBe(false);
    act(() => endImageCrop());
    expect(result.current.showPopover).toBe(true);
    expect(result.current.showPlus).toBe(true);
  });
});
