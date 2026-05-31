import { describe, expect, it } from 'vitest';
import { snapResizeBounds, snapToAlignment, type ShapeElement } from './index';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('snapToAlignment', () => {
  it('returns a zero delta when nothing is within the threshold', () => {
    const other = shape('o', { x: 1000, y: 1000 });
    expect(snapToAlignment(box(0, 0, 100, 100), [other], new Set(), 10)).toEqual({
      dx: 0,
      dy: 0,
    });
  });

  it('snaps the nearest edge to a neighbouring edge within the threshold', () => {
    // Candidate right edge = 100; neighbour left edge = 108 → dx 8.
    // Candidate top = neighbour top = 0 → dy 0.
    const neighbour = shape('n', { x: 108, y: 0, width: 40, height: 40 });
    expect(snapToAlignment(box(0, 0, 100, 100), [neighbour], new Set(), 10)).toEqual({
      dx: 8,
      dy: 0,
    });
  });

  it('snaps centre lines, not just edges', () => {
    // Candidate centre-x = 50; neighbour centre-x = 54 → dx 4.
    const neighbour = shape('n', { x: 4, y: 300, width: 100, height: 20 });
    const { dx } = snapToAlignment(box(0, 0, 100, 100), [neighbour], new Set(), 10);
    expect(dx).toBe(4);
  });

  it('ignores excluded ids (e.g. the elements being dragged)', () => {
    const neighbour = shape('n', { x: 108, y: 0, width: 40, height: 40 });
    expect(snapToAlignment(box(0, 0, 100, 100), [neighbour], new Set(['n']), 10)).toEqual({
      dx: 0,
      dy: 0,
    });
  });

  it('prefers the closest of several candidate lines', () => {
    const near = shape('near', { x: 103, y: 0, width: 10, height: 10 });
    const far = shape('far', { x: 92, y: 0, width: 10, height: 10 });
    // Candidate right edge = 100. Lines in range of that edge:
    //   near.left = 103 (delta +3), far.right = 102 (delta +2).
    // The smallest absolute delta wins → +2.
    const { dx } = snapToAlignment(box(0, 0, 100, 100), [near, far], new Set(), 10);
    expect(dx).toBe(2);
  });
});

describe('snapResizeBounds', () => {
  it('grows the active (SE) corner to snap its right edge to a neighbour', () => {
    // Right edge 100 snaps to neighbour left 108; left edge anchored at 0.
    const neighbour = shape('n', { x: 108, y: 1000, width: 40, height: 40 });
    const result = snapResizeBounds(box(0, 0, 100, 100), 'se', [neighbour], new Set(), 10, 20);
    expect(result.x).toBe(0); // left edge unmoved
    expect(result.width).toBe(108);
    expect(result.height).toBe(100); // no Y target in range
  });

  it('moves the NW corner while keeping the opposite (SE) corner anchored', () => {
    // Dragging NW: left + top edges move; right (100) + bottom (100) fixed.
    // Neighbour left edge at 8 pulls the left edge to 8 → width 92.
    const neighbour = shape('n', { x: 8, y: 1000, width: 40, height: 40 });
    const result = snapResizeBounds(box(0, 0, 100, 100), 'nw', [neighbour], new Set(), 10, 20);
    expect(result.x).toBe(8);
    expect(result.x + result.width).toBe(100); // right edge still anchored
  });

  it('returns the candidate unchanged when no edge is within the threshold', () => {
    const neighbour = shape('n', { x: 1000, y: 1000 });
    const c = box(0, 0, 100, 100);
    expect(snapResizeBounds(c, 'se', [neighbour], new Set(), 10, 20)).toEqual(c);
  });

  it('never shrinks the box below minSize', () => {
    // Neighbour left at 10 would pull SE right edge to 10 (width 10),
    // but minSize 20 clamps it.
    const neighbour = shape('n', { x: 10, y: 1000, width: 5, height: 5 });
    const result = snapResizeBounds(box(0, 0, 12, 100), 'se', [neighbour], new Set(), 10, 20);
    expect(result.width).toBeGreaterThanOrEqual(20);
  });
});
