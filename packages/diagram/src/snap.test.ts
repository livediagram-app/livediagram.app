import { describe, expect, it } from 'vitest';
import {
  alignmentGuides,
  distributionSnap,
  snapResizeBounds,
  snapToAlignment,
  type ShapeElement,
} from './index';

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
      snappedX: false,
      snappedY: false,
    });
  });

  it('snaps the nearest edge to a neighbouring edge within the threshold', () => {
    // Candidate right edge = 100; neighbour left edge = 108 → dx 8.
    // Candidate top = neighbour top = 0 → dy 0.
    const neighbour = shape('n', { x: 108, y: 0, width: 40, height: 40 });
    expect(snapToAlignment(box(0, 0, 100, 100), [neighbour], new Set(), 10)).toEqual({
      dx: 8,
      dy: 0,
      snappedX: true,
      snappedY: true,
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
      snappedX: false,
      snappedY: false,
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

describe('alignmentGuides', () => {
  it('returns no guides when nothing lines up', () => {
    const other = shape('o', { x: 1000, y: 1000 });
    expect(alignmentGuides(box(0, 0, 100, 100), [other], new Set())).toEqual([]);
  });

  it('reports a vertical guide when left edges coincide, spanning both elements', () => {
    // Candidate left = 0; neighbour left = 0 too. Neighbour sits below.
    const neighbour = shape('n', { x: 0, y: 300, width: 40, height: 60 });
    const guides = alignmentGuides(box(0, 0, 100, 100), [neighbour], new Set());
    const vertical = guides.filter((g) => g.axis === 'x');
    expect(vertical).toHaveLength(1);
    expect(vertical[0]).toMatchObject({ axis: 'x', position: 0 });
    // Spans from the candidate's top (0) to the neighbour's bottom (360).
    expect(vertical[0]!.start).toBe(0);
    expect(vertical[0]!.end).toBe(360);
  });

  it('reports a horizontal guide when centres coincide on the Y axis', () => {
    // Candidate centre-y = 50; neighbour centre-y = 50 (y 30, height 40).
    const neighbour = shape('n', { x: 400, y: 30, width: 40, height: 40 });
    const guides = alignmentGuides(box(0, 0, 100, 100), [neighbour], new Set());
    const horizontal = guides.filter((g) => g.axis === 'y');
    expect(horizontal).toHaveLength(1);
    expect(horizontal[0]).toMatchObject({ axis: 'y', position: 50 });
    expect(horizontal[0]!.start).toBe(0); // candidate left
    expect(horizontal[0]!.end).toBe(440); // neighbour right
  });

  it('excludes the dragged element ids as guide targets', () => {
    const neighbour = shape('n', { x: 0, y: 300, width: 40, height: 60 });
    expect(alignmentGuides(box(0, 0, 100, 100), [neighbour], new Set(['n']))).toEqual([]);
  });

  it('merges the span across multiple neighbours sharing one line', () => {
    // Two neighbours both share the candidate's left edge (x = 0), one
    // above and one below. The single vertical guide should span all three.
    const above = shape('a', { x: 0, y: -200, width: 30, height: 50 });
    const below = shape('b', { x: 0, y: 400, width: 30, height: 50 });
    const guides = alignmentGuides(box(0, 0, 100, 100), [above, below], new Set());
    const vertical = guides.filter((g) => g.axis === 'x' && g.position === 0);
    expect(vertical).toHaveLength(1);
    expect(vertical[0]!.start).toBe(-200); // top of `above`
    expect(vertical[0]!.end).toBe(450); // bottom of `below`
  });

  it('reports both a vertical and a horizontal guide when the corner lands on a neighbour corner', () => {
    // Neighbour's top-left corner (200, 0) coincides with the candidate's
    // top-right corner (100+100=... no). Use a neighbour whose left edge
    // equals the candidate right (100) and whose top equals candidate top (0).
    const neighbour = shape('n', { x: 100, y: 0, width: 40, height: 40 });
    const guides = alignmentGuides(box(0, 0, 100, 100), [neighbour], new Set());
    expect(guides.some((g) => g.axis === 'x' && g.position === 100)).toBe(true);
    expect(guides.some((g) => g.axis === 'y' && g.position === 0)).toBe(true);
  });

  it('merges a left-edge and centre line that fall on the same position', () => {
    // Candidate left = 0 and a neighbour centre-x at 0; candidate centre-x
    // = 50 with another neighbour at 50. These are distinct positions, so
    // two guides. But a single neighbour aligning to two candidate lines
    // at the same x collapses to one.
    const neighbour = shape('n', { x: -20, y: 300, width: 40, height: 40 }); // centre-x = 0
    const guides = alignmentGuides(box(0, 0, 100, 100), [neighbour], new Set());
    const atZero = guides.filter((g) => g.axis === 'x' && g.position === 0);
    expect(atZero).toHaveLength(1);
  });
});

describe('distributionSnap', () => {
  it('snaps a third element equidistant between two others (equal gaps)', () => {
    // A right edge = 100, C left edge = 400 → inner space 300; a 100-wide
    // candidate centred leaves a 100px gap each side, at x = 200.
    const a = shape('a', { x: 0, y: 0, width: 100, height: 100 });
    const c = shape('c', { x: 400, y: 0, width: 100, height: 100 });
    const out = distributionSnap(box(195, 0, 100, 100), [a, c], new Set(), 10);
    expect(out.dx).toBe(5); // 200 - 195
    expect(out.dy).toBe(0);
    const g = out.guides.find((gd) => gd.axis === 'x');
    expect(g?.gap).toBe(100);
    expect(g?.spans).toHaveLength(2);
  });

  it('snaps to continue an equal-spacing run (equal extension)', () => {
    // A (0..100) and B (200..300) leave a 100px gap; the candidate snaps
    // to one gap beyond B → x = 400.
    const a = shape('a', { x: 0, y: 0, width: 100, height: 100 });
    const b = shape('b', { x: 200, y: 0, width: 100, height: 100 });
    const out = distributionSnap(box(395, 0, 100, 100), [a, b], new Set(), 10);
    expect(out.dx).toBe(5); // 400 - 395
    expect(out.guides.find((gd) => gd.axis === 'x')?.gap).toBe(100);
  });

  it('does not snap when the candidate is outside the threshold', () => {
    const a = shape('a', { x: 0, y: 0, width: 100, height: 100 });
    const c = shape('c', { x: 400, y: 0, width: 100, height: 100 });
    const out = distributionSnap(box(250, 0, 100, 100), [a, c], new Set(), 10);
    expect(out.dx).toBe(0);
    expect(out.guides).toHaveLength(0);
  });

  it('ignores neighbours that do not overlap on the cross axis (not a row)', () => {
    // A + C sit far below the candidate, so there's no horizontal "row".
    const a = shape('a', { x: 0, y: 1000, width: 100, height: 100 });
    const c = shape('c', { x: 400, y: 1000, width: 100, height: 100 });
    const out = distributionSnap(box(195, 0, 100, 100), [a, c], new Set(), 10);
    expect(out.dx).toBe(0);
  });

  it('snaps the Y axis for a vertical column', () => {
    const a = shape('a', { x: 0, y: 0, width: 100, height: 100 });
    const c = shape('c', { x: 0, y: 400, width: 100, height: 100 });
    const out = distributionSnap(box(0, 195, 100, 100), [a, c], new Set(), 10);
    expect(out.dy).toBe(5);
    expect(out.guides.find((gd) => gd.axis === 'y')?.gap).toBe(100);
  });

  it('excludes the dragged ids', () => {
    const a = shape('a', { x: 0, y: 0, width: 100, height: 100 });
    const c = shape('c', { x: 400, y: 0, width: 100, height: 100 });
    const out = distributionSnap(box(195, 0, 100, 100), [a, c], new Set(['a']), 10);
    expect(out.dx).toBe(0); // only one neighbour left → no pair
  });
});
