import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livedesign/design';
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
  it('guides a pencil stroke', () => {
    expect(guides({ type: 'freehand' }).length).toBeGreaterThan(0);
  });

  it('guides a marker as it does the pencil (docs/specs/023-draw-mode/drawing-tools.md "Markers")', () => {
    const pen: PendingDraw = {
      type: 'freehand',
      variant: 'whiteboard',
      colour: null,
      width: 1.5,
    };
    expect(guides(pen)).toEqual(guides({ type: 'freehand' }));
    expect(guides(pen).length).toBeGreaterThan(0);
  });
});
