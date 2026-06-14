import { type ArrowStyle, type Endpoint } from './index';

// The quadratic-Bezier control point a curved arrow uses. When
// `curveOffset` is set, the user has dragged the curve handle and
// the control point is `chordMidpoint + curveOffset`. When unset,
// the historical auto-bow applies (¼-chord-length perpendicular to
// the chord). Exposed as its own helper so the renderer + the
// curve drag handle agree on the same point.
export function curveControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curveOffset?: { dx: number; dy: number },
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  if (curveOffset) return { x: mx + curveOffset.dx, y: my + curveOffset.dy };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return { x: mx, y: my };
  const nx = -dy / len;
  const ny = dx / len;
  const offset = len * 0.25;
  return { x: mx + nx * offset, y: my + ny * offset };
}

// The absolute control points a multi-bend curve threads through, resolved
// from the chord-midpoint-relative `curvePoints` deltas (so the whole curve
// translates with the arrow when an endpoint moves, like `curveOffset`).
export function curveAnchorPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curvePoints: { dx: number; dy: number }[],
): { x: number; y: number }[] {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  return curvePoints.map((p) => ({ x: mx + p.dx, y: my + p.dy }));
}

// Smooth path through every point (a uniform Catmull-Rom spline expressed as
// cubic Beziers, ends clamped). Passes THROUGH each point, so dragging a
// control point moves the curve onto it. Used for multi-bend curves; the
// single-bow case keeps its quadratic for an unchanged look.
export function catmullRomPathD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2)
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  const p = points;
  let d = `M ${p[0]!.x} ${p[0]!.y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

// Sample a Catmull-Rom spline (through `points`) into a fine polyline, for
// label placement + hit projection on multi-bend curves.
function sampleCatmullRom(points: { x: number; y: number }[], perSeg = 12): Pt[] {
  if (points.length < 3) return points.slice();
  const p = points;
  const out: Pt[] = [{ x: p[0]!.x, y: p[0]!.y }];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    for (let s = 1; s <= perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      // Uniform Catmull-Rom basis.
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}

// Build the SVG `d` attribute for an arrow at the given resolved
// endpoint positions. Pure geometry (no DOM dependency) so the
// editor's `<ArrowView>` and any future export / embedded-viewer
// route can share the same line.
//
// Straight is a single line. Curved bows the chord perpendicular
// to its midpoint by ¼ of its length (quadratic Bezier), or, when
// `curveOffset` is set, runs the curve through the user-chosen
// control point. Angled drops one right-angle bend; the leg that
// runs first is chosen from the from-endpoint's anchor side when
// available so a pinned arrow leaves its element along its anchor
// direction.
export function arrowPathD(
  style: ArrowStyle,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset?: { dx: number; dy: number },
  elbowOffset?: { dx: number; dy: number },
  curvePoints?: { dx: number; dy: number }[],
): string {
  if (style === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  if (style === 'curved') {
    // Multi-bend: a smooth spline through from -> control points -> to.
    if (curvePoints && curvePoints.length > 0) {
      return catmullRomPathD([from, ...curveAnchorPoints(from, to, curvePoints), to]);
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5 && !curveOffset) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    const c = curveControlPoint(from, to, curveOffset);
    return `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`;
  }
  const elbow = angledElbow(from, to, fromEp, toEp, elbowOffset);
  return `M ${from.x} ${from.y} L ${elbow.x} ${elbow.y} L ${to.x} ${to.y}`;
}

// Auto-computed elbow position for an angled arrow, plus any
// user-dragged offset. The auto position is the right-angle corner
// the renderer would draw without input: (to.x, from.y) for
// horizontal-first, (from.x, to.y) for vertical-first. `elbowOffset`
// (set by dragging the elbow handle, see Canvas + useEditorDrag)
// translates the corner so the user can place the bend wherever they
// want. The result loses strict axis-alignment when offset is set,
// matching the "drag the bend" mental model from Lucid / draw.io.
export function angledElbow(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
  elbowOffset?: { dx: number; dy: number },
): { x: number; y: number } {
  const horizontalFirst = angledHorizontalFirst(from, to, fromEp, toEp);
  const baseX = horizontalFirst ? to.x : from.x;
  const baseY = horizontalFirst ? from.y : to.y;
  if (!elbowOffset) return { x: baseX, y: baseY };
  return { x: baseX + elbowOffset.dx, y: baseY + elbowOffset.dy };
}

// The point on the rendered path that a label should anchor to.
// Curves return the t=0.5 point of the quadratic Bezier; angled
// arrows return the elbow vertex; straight arrows return the chord
// midpoint.
export function arrowPathMidpoint(
  style: ArrowStyle,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset?: { dx: number; dy: number },
  elbowOffset?: { dx: number; dy: number },
  curvePoints?: { dx: number; dy: number }[],
): { x: number; y: number } {
  if (style === 'angled') {
    return angledElbow(from, to, fromEp, toEp, elbowOffset);
  }
  if (style === 'curved' && curvePoints && curvePoints.length > 0) {
    // Arc-length midpoint of the sampled spline.
    const samples = sampleCatmullRom([from, ...curveAnchorPoints(from, to, curvePoints), to]);
    return polylineAt(samples, 0.5).point;
  }
  if (style === 'curved') {
    const c = curveControlPoint(from, to, curveOffset);
    // t=0.5 point on the quadratic Bezier B(0.5) = 0.25*P0 + 0.5*P1
    // + 0.25*P2.
    return {
      x: 0.25 * from.x + 0.5 * c.x + 0.25 * to.x,
      y: 0.25 * from.y + 0.5 * c.y + 0.25 * to.y,
    };
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

// ---------------------------------------------------------------------
// Label placement along the line (draggable arrow labels)
// ---------------------------------------------------------------------

type Pt = { x: number; y: number };

// The arrow's centreline as a polyline of vertices in draw order:
// straight = [from, to]; angled = [from, elbow, to]; curved = the
// quadratic Bezier sampled into short chords (fine enough to place +
// project a label against). Both the label anchor and the label-drag
// projection read this so they agree on the same line.
export function arrowCenterline(
  style: ArrowStyle,
  from: Pt,
  to: Pt,
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset?: { dx: number; dy: number },
  elbowOffset?: { dx: number; dy: number },
  curvePoints?: { dx: number; dy: number }[],
): Pt[] {
  if (style === 'curved' && curvePoints && curvePoints.length > 0) {
    return sampleCatmullRom([from, ...curveAnchorPoints(from, to, curvePoints), to]);
  }
  if (style === 'curved') {
    const c = curveControlPoint(from, to, curveOffset);
    const N = 24;
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      pts.push({
        x: mt * mt * from.x + 2 * mt * t * c.x + t * t * to.x,
        y: mt * mt * from.y + 2 * mt * t * c.y + t * t * to.y,
      });
    }
    return pts;
  }
  if (style === 'angled') {
    return [from, angledElbow(from, to, fromEp, toEp, elbowOffset), to];
  }
  return [from, to];
}

// Point + unit tangent at arc-length fraction `t` (0..1) along a
// polyline centreline. Used to anchor the label.
function polylineAt(pts: Pt[], t: number): { point: Pt; tangent: Pt } {
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    segLens.push(len);
    total += len;
  }
  if (total < 1e-6 || segLens.length === 0) {
    return { point: pts[0] ?? { x: 0, y: 0 }, tangent: { x: 1, y: 0 } };
  }
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]!;
    if (target <= len || i === segLens.length - 1) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const f = len > 1e-6 ? target / len : 0;
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      return {
        point: { x: a.x + tx * f, y: a.y + ty * f },
        tangent: { x: tx / tl, y: ty / tl },
      };
    }
    target -= len;
  }
  // Unreachable (loop always returns on the last segment), but keeps
  // the type checker happy without a non-null assertion dance.
  return { point: pts[pts.length - 1]!, tangent: { x: 1, y: 0 } };
}

// Where a label sits given its stored placement. `t` is the position
// along the line (0..1); `offset` is the signed perpendicular distance
// from the line (positive = left of the travel direction, negative =
// right) so the user can park the label on either side. Falls back to
// the natural midpoint when no placement is stored.
export function arrowLabelAnchor(
  style: ArrowStyle,
  from: Pt,
  to: Pt,
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset: { dx: number; dy: number } | undefined,
  elbowOffset: { dx: number; dy: number } | undefined,
  labelOffset: { t: number; offset: number } | undefined,
  curvePoints?: { dx: number; dy: number }[],
): Pt {
  if (!labelOffset) {
    return arrowPathMidpoint(style, from, to, fromEp, toEp, curveOffset, elbowOffset, curvePoints);
  }
  const pts = arrowCenterline(style, from, to, fromEp, toEp, curveOffset, elbowOffset, curvePoints);
  const { point, tangent } = polylineAt(pts, labelOffset.t);
  // Left-hand normal (rotate the tangent +90°).
  const nx = -tangent.y;
  const ny = tangent.x;
  return { x: point.x + nx * labelOffset.offset, y: point.y + ny * labelOffset.offset };
}

// Project a dragged point onto the arrow, returning the placement
// (`t` along the line + signed perpendicular `offset`) that anchors a
// label nearest that point. Inverse of `arrowLabelAnchor`; drives the
// label-drag gesture.
export function projectToArrow(
  style: ArrowStyle,
  from: Pt,
  to: Pt,
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset: { dx: number; dy: number } | undefined,
  elbowOffset: { dx: number; dy: number } | undefined,
  p: Pt,
  curvePoints?: { dx: number; dy: number }[],
): { t: number; offset: number } {
  const pts = arrowCenterline(style, from, to, fromEp, toEp, curveOffset, elbowOffset, curvePoints);
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    segLens.push(len);
    total += len;
  }
  if (total < 1e-6) return { t: 0, offset: 0 };
  let best = { dist: Infinity, t: 0, offset: 0 };
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = segLens[i]!;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const f = len > 1e-6 ? Math.max(0, Math.min(1, (vx * wx + vy * wy) / (len * len))) : 0;
    const projX = a.x + vx * f;
    const projY = a.y + vy * f;
    const dist = Math.hypot(p.x - projX, p.y - projY);
    if (dist < best.dist) {
      const along = acc + f * len;
      // Sign from the cross product: w left of v (CCW) → positive,
      // matching the left-hand normal in arrowLabelAnchor.
      const cross = vx * wy - vy * wx;
      best = { dist, t: along / total, offset: cross >= 0 ? dist : -dist };
    }
    acc += len;
  }
  return { t: best.t, offset: best.offset };
}

// Which leg of an angled arrow runs first. Pinned endpoints carry
// an intrinsic direction (E/W anchors leave horizontally; N/S leave
// vertically); free endpoints fall back to "travel along the longer
// axis first" so the elbow sits closer to the destination side.
function angledHorizontalFirst(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
): boolean {
  if (fromEp.kind === 'pinned') {
    if (fromEp.anchor === 'e' || fromEp.anchor === 'w') return true;
    if (fromEp.anchor === 'n' || fromEp.anchor === 's') return false;
  }
  if (toEp.kind === 'pinned') {
    if (toEp.anchor === 'n' || toEp.anchor === 's') return true;
    if (toEp.anchor === 'e' || toEp.anchor === 'w') return false;
  }
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
}
