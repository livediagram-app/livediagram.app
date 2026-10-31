// Inspect's spacing (docs/specs/007-editor/wireframe-pages.md "The measurements on the canvas"): the measured lines
// out from an element to its neighbours, and between two elements. Pure geometry on axis-aligned boxes, linear in
// the elements it is given, so the canvas runs it once per hover change, never per pointer sample.

export type InspectRect = { x: number; y: number; width: number; height: number };

export type InspectSide = 'top' | 'right' | 'bottom' | 'left';

/** One measured line: along `axis` from `from` to `to` (from < to), at `cross` on the other axis. */
export type SpacingLine = {
  axis: 'x' | 'y';
  from: number;
  to: number;
  cross: number;
  distance: number;
  side: InspectSide;
  // What the line is measured to: the other box's index in `others`, or the screen's edge.
  target: number | 'screen';
};

const right = (r: InspectRect) => r.x + r.width;
const bottom = (r: InspectRect) => r.y + r.height;

// Whether two spans share some length (touching at a point is not overlapping).
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;
// The middle of where two spans overlap.
const overlapMid = (a0: number, a1: number, b0: number, b1: number) =>
  (Math.max(a0, b0) + Math.min(a1, b1)) / 2;

const contains = (outer: InspectRect, inner: InspectRect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  right(outer) >= right(inner) &&
  bottom(outer) >= bottom(inner);

/**
 * The nearest edge on each side of `target`: another box's facing edge (one that overlaps it across that side),
 * the inner edge of a box it sits within, or else the edge of `screen` (when given and it holds the target). A
 * side with none of these has no line. One pass over `others`.
 */
export function neighbourSpacing(
  target: InspectRect,
  others: readonly InspectRect[],
  screen: InspectRect | null,
): SpacingLine[] {
  const t = { l: target.x, r: right(target), t: target.y, b: bottom(target) };
  // Best edge per side: the largest edge at or before the target's left/top, the smallest at or after its
  // right/bottom.
  const best = {
    left: { edge: -Infinity, target: -1 as number | 'screen', cross: 0 },
    right: { edge: Infinity, target: -1 as number | 'screen', cross: 0 },
    top: { edge: -Infinity, target: -1 as number | 'screen', cross: 0 },
    bottom: { edge: Infinity, target: -1 as number | 'screen', cross: 0 },
  };
  const offer = (side: InspectSide, edge: number, who: number | 'screen', cross: number): void => {
    const b = best[side];
    const nearer = side === 'left' || side === 'top' ? edge > b.edge : edge < b.edge;
    if (nearer) {
      b.edge = edge;
      b.target = who;
      b.cross = cross;
    }
  };
  const consider = (o: InspectRect, who: number | 'screen') => {
    const ol = o.x;
    const or = right(o);
    const ot = o.y;
    const ob = bottom(o);
    const inside = contains(o, target);
    if (overlaps(t.t, t.b, ot, ob)) {
      const cross = overlapMid(t.t, t.b, ot, ob);
      if (or <= t.l) offer('left', or, who, cross);
      else if (inside) offer('left', ol, who, cross);
      if (ol >= t.r) offer('right', ol, who, cross);
      else if (inside) offer('right', or, who, cross);
    }
    if (overlaps(t.l, t.r, ol, or)) {
      const cross = overlapMid(t.l, t.r, ol, or);
      if (ob <= t.t) offer('top', ob, who, cross);
      else if (inside) offer('top', ot, who, cross);
      if (ot >= t.b) offer('bottom', ot, who, cross);
      else if (inside) offer('bottom', ob, who, cross);
    }
  };
  for (let i = 0; i < others.length; i++) {
    const o = others[i]!;
    // The target itself, or a box exactly on it, measures nothing.
    if (
      o.x === target.x &&
      o.y === target.y &&
      o.width === target.width &&
      o.height === target.height
    )
      continue;
    consider(o, i);
  }
  if (screen && contains(screen, target)) consider(screen, 'screen');

  const lines: SpacingLine[] = [];
  const push = (side: InspectSide, axis: 'x' | 'y', from: number, to: number) => {
    const b = best[side];
    // No edge on this side, or one it touches: nothing to measure.
    if (b.target === -1 || to - from <= 0) return;
    lines.push({ axis, from, to, cross: b.cross, distance: to - from, side, target: b.target });
  };
  push('top', 'y', best.top.edge, t.t);
  push('right', 'x', t.r, best.right.edge);
  push('bottom', 'y', t.b, best.bottom.edge);
  push('left', 'x', best.left.edge, t.l);
  return lines;
}

/**
 * The lines between two boxes, `a` the selected and `b` the hovered: the four insets when one sits within the
 * other; else the gap across and the gap down where they stand apart on that axis, each drawn through where they
 * overlap on the other axis, or through `a`'s middle when they do not.
 */
export function pairSpacing(a: InspectRect, b: InspectRect): SpacingLine[] {
  if (contains(b, a)) return neighbourSpacing(a, [b], null);
  if (contains(a, b)) return neighbourSpacing(b, [a], null);
  const lines: SpacingLine[] = [];
  const crossY = overlaps(a.y, bottom(a), b.y, bottom(b))
    ? overlapMid(a.y, bottom(a), b.y, bottom(b))
    : a.y + a.height / 2;
  const crossX = overlaps(a.x, right(a), b.x, right(b))
    ? overlapMid(a.x, right(a), b.x, right(b))
    : a.x + a.width / 2;
  if (right(a) <= b.x) {
    lines.push({
      axis: 'x',
      from: right(a),
      to: b.x,
      cross: crossY,
      distance: b.x - right(a),
      side: 'right',
      target: 0,
    });
  } else if (right(b) <= a.x) {
    lines.push({
      axis: 'x',
      from: right(b),
      to: a.x,
      cross: crossY,
      distance: a.x - right(b),
      side: 'left',
      target: 0,
    });
  }
  if (bottom(a) <= b.y) {
    lines.push({
      axis: 'y',
      from: bottom(a),
      to: b.y,
      cross: crossX,
      distance: b.y - bottom(a),
      side: 'bottom',
      target: 0,
    });
  } else if (bottom(b) <= a.y) {
    lines.push({
      axis: 'y',
      from: bottom(b),
      to: a.y,
      cross: crossX,
      distance: a.y - bottom(b),
      side: 'top',
      target: 0,
    });
  }
  return lines;
}
