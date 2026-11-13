import { describe, expect, it } from 'vitest';
import type { Element } from './element';
import { indicatorPlacementFor } from './indicator-placement';

// The shared placement over plain rectangles; each product's own suite runs it through its real outlines.
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const outlined = new Set(['star']);
const placement = indicatorPlacementFor<Element>({
  pickedByOutline: (el): el is Extract<Element, { type: 'shape' }> =>
    el.type === 'shape' && outlined.has(el.shape),
  shapeHitOutline: (el) => ({ lines: [{ closed: true, points: rect(0, 0, el.width, el.height) }] }),
  roundedRectRing: (x, y, w, h) => rect(x, y, w, h),
});
const box = (shape: string) =>
  ({ id: 'a', type: 'shape', shape, x: 0, y: 0, width: 200, height: 100 }) as Element & {
    type: 'shape';
  };

describe('indicatorPlacementFor', () => {
  it('reads a box corner-first and an outlined shape through its outline', () => {
    expect(placement.topAnchor(box('square'))).toBe('top-right');
    expect(placement.footerAnchor(box('star'))).toBe('bottom-centre');
    expect(placement.indicatorRings(box('square'), 4)).toHaveLength(1);
    expect(placement.indicatorRings(box('star'), 4)[0]).toHaveLength(4);
    expect(placement.indicatorRings({ ...box('square'), width: 0 }, 4)).toEqual([]);
  });

  it('places a cluster just inside the corner, and the pip on the outline', () => {
    const rings = placement.indicatorRings(box('square'), 0);
    expect(
      placement.placeIndicators(rings, 200, 100, { width: 20, height: 10 }, 'top-right'),
    ).toEqual({
      x: 174,
      y: 6,
      width: 20,
      height: 10,
    });
    expect(
      placement.placeIndicators([], 200, 100, { width: 20, height: 10 }, 'top-right'),
    ).toBeNull();
    expect(placement.pipInset(rings, 200, 100, false)).toEqual({ x: 0.5, y: 0.5 });
    expect(placement.pipInset(rings, 200, 100, true)).toEqual({ x: 100, y: 0 });
  });

  it('moves content clear of a cluster only along its alignment', () => {
    const cluster = { x: 0, y: 0, width: 20, height: 10 };
    const content = { x: 0, y: 8, width: 50, height: 20 };
    expect(placement.contentShift(cluster, content, 100, 4, 'top', false)).not.toBeNull();
    expect(placement.contentShift(cluster, content, 100, 4, 'bottom', false)).toBeNull();
    expect(placement.contentShift(cluster, { ...content, y: 60 }, 100, 4, 'top', false)).toEqual({
      top: 0,
      bottom: 0,
    });
  });
});
