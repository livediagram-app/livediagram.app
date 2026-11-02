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

  it('reads moving a free arrow as move and scaling it as resize', () => {
    expect(gestureOfDrag(drag({ kind: 'arrow-translate' }))).toBe('move');
    expect(gestureOfDrag(drag({ kind: 'arrow-scale' }))).toBe('resize');
  });

  it('reads every other arrow handle as reshape', () => {
    for (const kind of [
      'arrow-endpoint',
      'arrow-bend',
      'arrow-curve',
      'arrow-elbow',
      'arrow-label',
    ]) {
      expect(gestureOfDrag(drag({ kind }))).toBe('reshape');
    }
  });
});

describe('dragWaitsToEngage', () => {
  it('waits for a body move, not for a resize', () => {
    expect(dragWaitsToEngage(drag({ kind: 'boxed', mode: 'move' }))).toBe(true);
    expect(dragWaitsToEngage(drag({ kind: 'boxed', mode: 'resize-se' }))).toBe(false);
  });

  it('waits for arrow handles, except a new arrow end following the pointer', () => {
    expect(dragWaitsToEngage(drag({ kind: 'arrow-bend' }))).toBe(true);
    expect(dragWaitsToEngage(drag({ kind: 'arrow-endpoint', reposition: true }))).toBe(true);
    expect(dragWaitsToEngage(drag({ kind: 'arrow-endpoint' }))).toBe(false);
  });
});
