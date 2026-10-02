import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from './index';
import { borderOf } from './svg-render-border';
import { renderElementsToSvg } from './svg-render';
import { shapeHitOutline } from './shape-hit';

// docs/specs/008-canvas/corner-radius.md: the export and the hit outline draw a corner by the one
// rule, so a small rounded square stays a rounded square, and a large one is unchanged.
const square = (size: number, over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: size,
  height: size,
  borderRadius: 'lg',
  ...over,
});

describe('the SVG export’s corners', () => {
  it('rounds a small rounded square by a quarter of its side, not into a circle', () => {
    expect(borderOf(square(14)).radius).toBe(3.5);
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [square(14)] } as Tab);
    // The border's centre line runs half the 2 px stroke inside the box: 3.5 - 1.
    expect(svg).toMatch(/rx="2\.5"/);
  });

  it('draws a large rounded square exactly as before', () => {
    expect(borderOf(square(200)).radius).toBe(24);
    expect(borderOf(square(14, { borderRadius: 'full' })).radius).toBe(7);
  });
});

describe('the hit outline’s corners', () => {
  // The furthest a ring point lies from the box corner along the diagonal tells its radius.
  const cornerGap = (el: ShapeElement) => {
    const ring = shapeHitOutline(el).lines[0]!.points;
    return Math.min(...ring.map((p) => Math.hypot(p.x, p.y)));
  };

  it('follows the same quarter cap', () => {
    const small = cornerGap(square(14, { strokeWidth: 'none' }));
    const circle = cornerGap(square(14, { borderRadius: 'full', strokeWidth: 'none' }));
    // A 3.5 px corner keeps the ring far closer to the box corner than a circle does.
    expect(small).toBeLessThan(circle);
    expect(small).toBeCloseTo(3.5 * (Math.SQRT2 - 1), 1);
  });
});
