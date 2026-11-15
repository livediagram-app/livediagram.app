import { describe, expect, it } from 'vitest';
import type { DragState } from '@/lib/canvas';
import { reshapingArrowOf } from './useEditCanvasProps';

// docs/specs/008-canvas/arrow-bending.md: a free arrow's frame stands down while one of its handles reshapes it. The
// canvas reads that arrow as a slice of the drag store (canvas-performance.md "A press re-renders what shows the
// gesture"), so every other drag reads null and renders nothing.
describe('reshapingArrowOf', () => {
  it('names the arrow a handle drag reshapes', () => {
    for (const kind of ['arrow-bend', 'arrow-curve', 'arrow-elbow', 'arrow-endpoint'] as const)
      expect(reshapingArrowOf({ kind, arrowId: 'a1' } as unknown as DragState)).toBe('a1');
  });

  it('reads null for any other drag, and for none', () => {
    expect(reshapingArrowOf({ kind: 'boxed' } as unknown as DragState)).toBeNull();
    expect(
      reshapingArrowOf({ kind: 'arrow-translate', arrowId: 'a1' } as unknown as DragState),
    ).toBeNull();
    expect(reshapingArrowOf(null)).toBeNull();
  });
});
