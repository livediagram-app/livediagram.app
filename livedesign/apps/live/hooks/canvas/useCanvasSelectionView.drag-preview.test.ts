// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/document';
import { useCanvasSelectionView } from './useCanvasSelectionView';
import { resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./useSelectionStore', () => ({
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
