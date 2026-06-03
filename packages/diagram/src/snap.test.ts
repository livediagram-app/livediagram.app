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

  it('snaps the candidate width to match a neighbour width (SE drag)', () => {
    // Neighbour is 220px wide and far away on both axes (no edge or
    // centre alignment opportunity). Candidate at 215 is 5px short of
    // matching: the dimension-match snap should pull it to 220.
    const neighbour = shape('n', { x: 600, y: 800, width: 220, height: 150 });
    const result = snapResizeBounds(box(0, 0, 215, 100), 'se', [neighbour], new Set(), 10, 20);
    expect(result.width).toBe(220);
    expect(result.x).toBe(0); // left edge still anchored
  });

  it('snaps the candidate height to match a neighbour height (SE drag)', () => {
    const neighbour = shape('n', { x: 600, y: 800, width: 50, height: 120 });
    const result = snapResizeBounds(box(0, 0, 100, 115), 'se', [neighbour], new Set(), 10, 20);
    expect(result.height).toBe(120);
    expect(result.y).toBe(0);
  });

  it('preserves the anchor when matching width during an NW drag', () => {
    // NW drag anchors the right edge. Candidate has right at 100,
    // width 85 (so left at 15). Neighbour width 80 lives elsewhere.
    // Width-match should pull the left edge from 15 to 20 (right
    // anchor minus neighbour width = 100 - 80), so width lands at
    // exactly 80 and the right edge stays put.
    const neighbour = shape('n', { x: 600, y: 800, width: 80, height: 50 });
    const result = snapResizeBounds(box(15, 0, 85, 100), 'nw', [neighbour], new Set(), 10, 20);
    expect(result.width).toBe(80);
    expect(result.x + result.width).toBe(100);
  });

  it('prefers edge alignment over dimension match when both fall in range', () => {
    // SE drag, right edge at 100. Neighbour at x=104 (left edge in
    // range, delta +4) with width 90 (width-match delta -10, out of
    // range at threshold 5). Edge wins, width unchanged from candidate
    // size required by edge snap (104).
    const neighbour = shape('n', { x: 104, y: 1000, width: 90, height: 90 });
    const result = snapResizeBounds(box(0, 0, 100, 100), 'se', [neighbour], new Set(), 5, 20);
    expect(result.width).toBe(104);
  });

  it('skips zero-width / zero-height elements as dimension targets', () => {
    // A degenerate element with width 0 would otherwise read as a
    // "match anything within threshold" trap (every candidate
    // approaching 0 width would snap to 0, then minSize would clamp,
    // confusing the user). The snap explicitly skips these.
    const degenerate = shape('z', { x: 1000, y: 1000, width: 0, height: 0 });
    const c = box(0, 0, 100, 100);
    expect(snapResizeBounds(c, 'se', [degenerate], new Set(), 10, 20)).toEqual(c);
  });
});
