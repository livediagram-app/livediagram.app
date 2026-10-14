import { describe, expect, it } from 'vitest';
import { SCALE_ALIGNED_AXIS_MAX_FILL, scaleFitViewBox } from './scale-fit';

// docs/specs/008-canvas/canvas-and-palette.md "Off-centre alignment leaves room under Scale"
// (issue #490): an auto-fit label fills its box until one axis is full, so an off-centre
// alignment widens the view box on its own axis, away from its edge.
const word = { x: 0, y: -2, w: 50, h: 22 };
const fill = SCALE_ALIGNED_AXIS_MAX_FILL;

// Where `preserveAspectRatio="… meet"` draws the text inside a box, for the geometry checks.
function drawn(
  box: { w: number; h: number },
  alignX: 'left' | 'center' | 'right',
  alignY: 'top' | 'middle' | 'bottom',
) {
  const vb = scaleFitViewBox(word, alignX, alignY);
  const scale = Math.min(box.w / vb.w, box.h / vb.h);
  const fx = alignX === 'left' ? 0 : alignX === 'right' ? 1 : 0.5;
  const fy = alignY === 'top' ? 0 : alignY === 'bottom' ? 1 : 0.5;
  const x = (box.w - vb.w * scale) * fx + (word.x - vb.x) * scale;
  const y = (box.h - vb.h * scale) * fy + (word.y - vb.y) * scale;
  return { x, y, w: word.w * scale, h: word.h * scale };
}

describe('scaleFitViewBox', () => {
  it('keeps the measured box when centred both ways, so the default look is unchanged', () => {
    expect(scaleFitViewBox(word, 'center', 'middle')).toEqual(word);
  });

  it('grows away from the chosen edge on each off-centre axis', () => {
    expect(scaleFitViewBox(word, 'left', 'top')).toEqual({
      x: 0,
      y: -2,
      w: word.w / fill,
      h: word.h / fill,
    });
    const br = scaleFitViewBox(word, 'right', 'bottom');
    expect(br.x + br.w).toBeCloseTo(word.x + word.w);
    expect(br.y + br.h).toBeCloseTo(word.y + word.h);
    expect(br.w).toBeCloseTo(word.w / fill);
  });

  it('only touches the off-centre axis', () => {
    const top = scaleFitViewBox(word, 'center', 'top');
    expect([top.x, top.w]).toEqual([word.x, word.w]);
    const right = scaleFitViewBox(word, 'right', 'middle');
    expect([right.y, right.h]).toEqual([word.y, word.h]);
  });

  // The Sailboat hull: a long, flat box where the height binds.
  const hull = { w: 380, h: 60 };

  it('lets Top sit visibly higher than Middle on a flat shape', () => {
    const middle = drawn(hull, 'center', 'middle');
    const top = drawn(hull, 'center', 'top');
    expect(middle.h).toBeCloseTo(hull.h);
    expect(top.y).toBeCloseTo(0);
    expect(top.h).toBeCloseTo(hull.h * fill);
    expect(drawn(hull, 'center', 'bottom').y + top.h).toBeCloseTo(hull.h);
  });

  it('leaves the size alone on an axis that does not bind (Left on the hull slides, full height)', () => {
    const left = drawn(hull, 'left', 'middle');
    expect(left.x).toBeCloseTo(0);
    expect(left.h).toBeCloseTo(hull.h);
  });
});
