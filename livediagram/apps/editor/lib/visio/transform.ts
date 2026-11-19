// Visio coordinates to page pixels (docs/specs/020-import-export/visio-import.md "Units and geometry"): inches
// from the page's bottom-left, y upwards, become pixels from its top-left, y downwards. A shape's own coordinates
// (its geometry, a group's sub-shapes) map to its parent's through its pin, local pin, angle and flips.

import { VISIO_PX_PER_INCH } from './limits';
import type { ShapeSheet } from './sheet';

/** An affine map: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Frame = { a: number; b: number; c: number; d: number; e: number; f: number };

export const applyFrame = (m: Frame, x: number, y: number) => ({
  x: m.a * x + m.c * y + m.e,
  y: m.b * x + m.d * y + m.f,
});

/** `outer` after `inner`: a point in `inner`'s space to `outer`'s target space. */
export function compose(outer: Frame, inner: Frame): Frame {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

/** The page's frame: inches, y up, to pixels, y down. */
export const pageFrame = (heightIn: number): Frame => ({
  a: VISIO_PX_PER_INCH,
  b: 0,
  c: 0,
  d: -VISIO_PX_PER_INCH,
  e: 0,
  f: heightIn * VISIO_PX_PER_INCH,
});

const num = (sheet: ShapeSheet, name: string) => sheet.num(name) ?? 0;

/** A shape's own coordinates to its parent's: flip, less the local pin, turned by the angle, onto the pin. */
export function localFrame(sheet: ShapeSheet): Frame {
  const width = num(sheet, 'Width');
  const height = num(sheet, 'Height');
  const flipX = sheet.cell('FlipX') === '1';
  const flipY = sheet.cell('FlipY') === '1';
  const angle = num(sheet, 'Angle');
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const flip: Frame = {
    a: flipX ? -1 : 1,
    b: 0,
    c: 0,
    d: flipY ? -1 : 1,
    e: flipX ? width : 0,
    f: flipY ? height : 0,
  };
  const toPin: Frame = {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: num(sheet, 'PinX') - (cos * num(sheet, 'LocPinX') - sin * num(sheet, 'LocPinY')),
    f: num(sheet, 'PinY') - (sin * num(sheet, 'LocPinX') + cos * num(sheet, 'LocPinY')),
  };
  return compose(toPin, flip);
}

/** How long one local unit along x is in the frame's target space. */
const scaleX = (m: Frame) => Math.hypot(m.a, m.b);
const scaleY = (m: Frame) => Math.hypot(m.c, m.d);

/**
 * A 2-D shape's box in page pixels, unrotated, about its centre, and its clockwise rotation in degrees
 * (draw.io's `rotation`), given the frame of its own coordinates.
 */
export function shapeBox(
  own: Frame,
  widthIn: number,
  heightIn: number,
): { x: number; y: number; width: number; height: number; rotation: number } {
  const centre = applyFrame(own, widthIn / 2, heightIn / 2);
  const width = Math.abs(widthIn) * scaleX(own);
  const height = Math.abs(heightIn) * scaleY(own);
  // The local x axis's direction on the page (y down), so a positive angle is clockwise. The page frame itself
  // mirrors y, so a shape drawn the right way round has a negative determinant; a positive one is mirrored (an
  // odd number of flips), whose x axis runs backwards and is turned round (the flip itself is the shape's flipH).
  const sign = own.a * own.d - own.b * own.c > 0 ? -1 : 1;
  const degrees = (Math.atan2(own.b * sign, own.a * sign) * 180) / Math.PI;
  const rotation = Math.round((((degrees % 360) + 360) % 360) * 1000) / 1000;
  return {
    x: centre.x - width / 2,
    y: centre.y - height / 2,
    width,
    height,
    rotation: rotation === 360 ? 0 : rotation,
  };
}
