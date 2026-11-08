import { describe, expect, it } from 'vitest';
import type { DragState } from '@/lib/canvas';
import { dragWaitsToEngage, gestureOfDrag } from './drag-gesture';

const drag = (over: Record<string, unknown>) => over as unknown as DragState;

describe('gestureOfDrag', () => {
  it('reads a boxed move as move and every boxed resize as resize', () => {
    expect(gestureOfDrag(drag({ kind: 'boxed', mode: 'move' }))).toBe('move');
    expect(gestureOfDrag(drag({ kind: 'boxed', mode: 'resize-se' }))).toBe('resize');
    expect(gestureOfDrag(drag({ kind: 'boxed', mode: 'resize-n' }))).toBe('resize');
  });
});

describe('dragWaitsToEngage', () => {
  it('waits for a body move, not for a resize', () => {
    expect(dragWaitsToEngage(drag({ kind: 'boxed', mode: 'move' }))).toBe(true);
    expect(dragWaitsToEngage(drag({ kind: 'boxed', mode: 'resize-se' }))).toBe(false);
  });
});
