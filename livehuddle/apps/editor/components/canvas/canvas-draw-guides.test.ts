import { describe, expect, it } from 'vitest';
import { createSticky, type Element } from '@livehuddle/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { computeDrawGuides } from './canvas-draw-guides';

// A box the drawn box below lines up with, so a guide shows.
const box = { ...createSticky(100, 100), width: 100, height: 100 } as Element;
const room: PendingDraw = { type: 'shape', kind: 'room' };
const guides = (
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null,
  hover: { x: number; y: number } | null = null,
) =>
  computeDrawGuides({
    drawDrag,
    pendingDraw: room,
    elements: [box],
    drawHover: hover,
    snapGuides: [],
    snapTargets: [],
  }).alignGuides;

// docs/specs/008-canvas/canvas-and-palette.md "Placement on add": a box drawn to size shows the guides it latched
// onto, and so does the first corner before the press. (The pens' guides left with the element engine's part 4,
// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine".)
describe('computeDrawGuides', () => {
  it('guides a box drawn level with a neighbour', () => {
    expect(
      guides({ startX: 300, startY: 100, currentX: 400, currentY: 200 }).length,
    ).toBeGreaterThan(0);
  });

  it('guides the snapped hover point before the press', () => {
    expect(guides(null, { x: 300, y: 100 }).length).toBeGreaterThan(0);
  });

  it('hands the gesture’s own guides through when the draw adds none', () => {
    const own = [{ axis: 'x', position: 5, from: 0, to: 10 }] as never[];
    const out = computeDrawGuides({
      drawDrag: null,
      pendingDraw: null,
      elements: [box],
      drawHover: null,
      snapGuides: own,
      snapTargets: [],
    });
    expect(out.alignGuides).toBe(own);
  });
});
