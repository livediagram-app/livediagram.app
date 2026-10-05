// Where an element's indicator pip sits when its outline rings give no point
// (docs/specs/008-canvas/element-indicators.md, `pipCornerInset` first): on the element's own
// outline, not its bounding box. The point is where a 45° line
// from the box's top-right corner meets the outline, given as an inset from the top and right
// edges, so on a round, stadium, rounded or diamond element the chip touches the shape instead of
// floating in the empty corner beside it. Pure geometry.

// How far in from a quarter circle's box corner its 45° point sits, per unit of radius: 1 - 1/√2.
const ARC_45 = 1 - Math.SQRT1_2;

export type BadgeInset = { x: number; y: number };

/**
 * The inset of the badge point from the top-right corner of a `width` × `height` element of
 * `shape` whose corners are rounded by `radiusPx` (already resolved, possibly huge for "full").
 */
export function badgeCornerInset(
  shape: string | undefined,
  width: number,
  height: number,
  radiusPx: number,
): BadgeInset {
  if (shape === 'circle') return { x: (width / 2) * ARC_45, y: (height / 2) * ARC_45 };
  if (shape === 'diamond') return { x: width / 4, y: height / 4 };
  const r = shape === 'stadium' ? Math.min(width, height) / 2 : radiusPx;
  // A radius past half the shorter side is drawn as that much (a pill, or a circle on a square).
  const drawn = Math.max(0, Math.min(r, Math.min(width, height) / 2));
  return { x: drawn * ARC_45, y: drawn * ARC_45 };
}
