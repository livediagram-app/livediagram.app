// Pure polyline / curve geometry used by freehand rendering: Ramer-Douglas-
// Peucker simplification of raw pointer samples, and Catmull-Rom -> cubic
// Bezier SVG path conversion for smooth strokes. No element-model deps.
// Split out of factories.ts; re-exported through the package barrel.

// Ramer-Douglas-Peucker polyline simplification. Drops samples that
// sit close to the straight line between their neighbours; the
// `tolerance` is the max allowed perpendicular distance in canvas
// pixels. Returns a new array (input untouched). Pure: no
// randomness, no time-dependence.
//
// Caller passes the raw pointer samples + a tolerance scaled to
// viewport zoom so the visible jitter is what gets smoothed, not
// absolute canvas pixels. A short polyline (< 3 points) is returned
// as-is, the algorithm is a no-op there.
export function simplifyPolyline(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length < 3) return points.slice();
  const tol2 = tolerance * tolerance;
  // Iterative RDP via an explicit stack so deep recursion can't blow
  // the call stack on a several-thousand-sample gesture.
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;
    let maxDist2 = 0;
    let maxIdx = start;
    const a = points[start]!;
    const b = points[end]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lineLen2 = dx * dx + dy * dy;
    for (let i = start + 1; i < end; i++) {
      const p = points[i]!;
      let d2: number;
      if (lineLen2 === 0) {
        // start == end (degenerate). Distance is just to the point.
        const ex = p.x - a.x;
        const ey = p.y - a.y;
        d2 = ex * ex + ey * ey;
      } else {
        // Perpendicular distance from p to line a..b, squared.
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lineLen2;
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const ex = p.x - projX;
        const ey = p.y - projY;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > maxDist2) {
        maxDist2 = d2;
        maxIdx = i;
      }
    }
    if (maxDist2 > tol2) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]!);
  return out;
}

// Catmull-Rom to cubic-Bezier SVG path. Turns a sequence of points
// into a smooth curve passing through every one. The output is an
// SVG `d` attribute string (M, then cubic C segments). `closed`
// adds the closing tangent + the `Z` terminator so a filled
// freehand reads as a continuous outline.
//
// Algorithm: for each segment p1..p2, compute control points from
// the neighbouring p0 and p3 using Catmull-Rom tangents (alpha=0.5,
// uniform tension). Endpoints reuse themselves as the missing
// neighbour. Pure: no allocations beyond the output strings, no
// time-dependence. `fmt` shapes every number written (the SVG export
// rounds to keep its files small); the canvas writes them raw.
export function catmullRomToBezierPath(
  points: { x: number; y: number }[],
  closed: boolean,
  fmt: (n: number) => number = (n) => n,
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${fmt(p.x)} ${fmt(p.y)}`;
  }
  const n = points.length;
  const get = (i: number): { x: number; y: number } => {
    if (closed) return points[((i % n) + n) % n]!;
    if (i < 0) return points[0]!;
    if (i >= n) return points[n - 1]!;
    return points[i]!;
  };
  const out: string[] = [];
  out.push(`M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    // Catmull-Rom -> Bezier conversion (uniform / alpha = 0.5 ish).
    // The 1/6 factor produces a smooth curve passing through p1
    // and p2 with control points pulled from p0 and p3.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    out.push(`C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`);
  }
  if (closed) out.push('Z');
  return out.join(' ');
}
