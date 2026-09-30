import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { computeDrawGuides } from './canvas-draw-guides';

// A box the stroke below lines up with, so a guide would show for a pencil.
const box = { ...createShape('square', 100, 100), width: 100, height: 100 } as Element;
const stroke = [
  { x: 100, y: 300 },
  { x: 200, y: 320 },
];
const guides = (pendingDraw: PendingDraw, hover: { x: number; y: number } | null = null) =>
  computeDrawGuides({
    drawDrag: null,
    pendingDraw,
    elements: [box],
    drawHover: hover,
    penPoints: hover ? null : stroke,
    snapGuides: [],
    snapTargets: [],
  }).alignGuides;

describe('computeDrawGuides for pens', () => {
  it('guides a pencil stroke on a diagram', () => {
    expect(guides({ type: 'freehand' }).length).toBeGreaterThan(0);
  });

  it('draws no guides for a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "No guides for pens")', () => {
    const pen: PendingDraw = {
      type: 'freehand',
      variant: 'whiteboard',
      colour: null,
      width: 1.5,
      recognise: false,
    };
    expect(guides(pen)).toEqual([]);
    expect(guides(pen, { x: 100, y: 250 })).toEqual([]);
  });
});
