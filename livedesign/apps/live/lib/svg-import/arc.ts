// An SVG elliptical arc as cubic pieces (docs/specs/020-import-export/svg-import.md "Geometry"), following the SVG
// spec's endpoint-to-centre conversion (SVG 1.1 implementation notes, F.6.5 and F.6.6). Each piece spans at most a
// quarter turn, fewer degrees where the radius is large, so no piece strays more than SVG_ARC_TOLERANCE_PX.
import { SVG_ARC_MAX_PIECE, SVG_ARC_TOLERANCE_PX } from './constants';
import { lineTo, type Pt, type Segment } from './geometry';

// A quarter-turn piece of a unit circle strays about this far (2.7e-4 of the radius); the error grows with the
// sixth power of the piece's angle.
const QUARTER_ERROR = 2.7e-4;

/** How many pieces an arc of `sweep` radians at `radiusPx` landed px needs. */
export function arcPieces(sweep: number, radiusPx: number): number {
  const turn = Math.abs(sweep);
  let n = Math.max(1, Math.ceil(turn / SVG_ARC_MAX_PIECE - 1e-9));
  // Shrink each piece until its error is under the tolerance: error ≈ r · 2.7e-4 · (θ / (π/2))^6.
  while (
    radiusPx * QUARTER_ERROR * (turn / n / SVG_ARC_MAX_PIECE) ** 6 > SVG_ARC_TOLERANCE_PX &&
    n < 64
  )
    n++;
  return n;
}

/** The angle between two vectors, signed. */
function angle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  const a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
  return ux * vy - uy * vx < 0 ? -a : a;
}

/**
 * The arc from `from` to `to` with radii `rx`, `ry`, x-axis rotation `phiDeg`, and the two flags, as cubic
 * segments. `pxPerUnit` is how many landed px one unit of these coordinates becomes, which sets the precision.
 * Zero radii draw a straight line, and an arc to its own start draws nothing (both per the SVG spec).
 */
export function arcToCubics(
  from: Pt,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  large: boolean,
  sweep: boolean,
  to: Pt,
  pxPerUnit: number,
): Segment[] {
  if (from.x === to.x && from.y === to.y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [lineTo(from, to)];
  const phi = (((phiDeg % 360) + 360) % 360) * (Math.PI / 180);
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // F.6.5.1: the midpoint, in the ellipse's own axes.
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  // F.6.6: radii too small to reach are scaled up just enough.
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  // F.6.5.2: the centre, in the ellipse's axes.
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * (rx * y1)) / ry;
  const cyp = (coef * -(ry * x1)) / rx;
  // F.6.5.3: the centre in user space.
  const cx = cos * cxp - sin * cyp + (from.x + to.x) / 2;
  const cy = sin * cxp + cos * cyp + (from.y + to.y) / 2;
  // F.6.5.5 and F.6.5.6: the start angle and the sweep.
  const theta1 = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dtheta = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
  else if (sweep && dtheta < 0) dtheta += 2 * Math.PI;

  const n = arcPieces(dtheta, Math.max(rx, ry) * pxPerUnit);
  const step = dtheta / n;
  // The handle length of a circular piece of `step` radians, on the unit circle.
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number): Pt => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return { x: cx + cos * ex - sin * ey, y: cy + sin * ex + cos * ey };
  };
  const tangent = (t: number): Pt => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return { x: cos * ex - sin * ey, y: sin * ex + cos * ey };
  };
  const out: Segment[] = [];
  let t0 = theta1;
  let p0 = from;
  for (let i = 0; i < n; i++) {
    const t1 = t0 + step;
    // The last piece ends exactly at `to`, so rounding never leaves a gap.
    const p1 = i === n - 1 ? to : point(t1);
    const d0 = tangent(t0);
    const d1 = tangent(t1);
    out.push({
      c1: { x: p0.x + k * d0.x, y: p0.y + k * d0.y },
      c2: { x: p1.x - k * d1.x, y: p1.y - k * d1.y },
      to: p1,
    });
    t0 = t1;
    p0 = p1;
  }
  return out;
}
