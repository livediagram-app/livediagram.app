import { describe, expect, it } from 'vitest';
import { badgeCornerInset } from './badge-anchor';

// docs/specs/008-canvas/canvas-and-palette.md: the BadgeStrip sits on the element's outline.

const near = (v: { x: number; y: number }) => ({ x: Math.round(v.x), y: Math.round(v.y) });

describe('badgeCornerInset', () => {
  it('sits at the corner of a sharp box', () => {
    expect(badgeCornerInset('square', 200, 100, 0)).toEqual({ x: 0, y: 0 });
  });

  it('moves onto the arc of a rounded corner', () => {
    expect(near(badgeCornerInset('mind-node', 200, 80, 12))).toEqual({ x: 4, y: 4 });
  });

  it('meets a circle, and a full radius on a square node, on the circle', () => {
    expect(near(badgeCornerInset('circle', 140, 140, 0))).toEqual({ x: 21, y: 21 });
    expect(near(badgeCornerInset('mind-node', 140, 140, 9999))).toEqual({ x: 21, y: 21 });
  });

  it('meets a stadium on its end cap, and a diamond on its edge', () => {
    expect(near(badgeCornerInset('stadium', 240, 80, 0))).toEqual({ x: 12, y: 12 });
    expect(badgeCornerInset('diamond', 120, 80, 0)).toEqual({ x: 30, y: 20 });
  });
});
