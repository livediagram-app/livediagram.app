// Thinning a pen stroke's points (docs/specs/020-import-export/whiteboard-import.md "Pen strokes"):
// Whiteboard samples the pen far denser than a line needs. Ramer-Douglas-Peucker in three
// dimensions, x and y in px and pressure scaled by the stroke's width (a full pressure swing moves
// the drawn edge by about one width), so a point stays whenever dropping it would move the line or
// its thickness by more than the tolerance.
import type { ScenePoint } from '@/lib/board-scene/scene';

// Under half a device pixel at 2x: invisible on any screen.
export const SIMPLIFY_TOLERANCE_PX = 0.2;

type P3 = [number, number, number];

function distanceToSegment(p: P3, a: P3, b: P3): number {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = d[0]! * d[0]! + d[1]! * d[1]! + d[2]! * d[2]!;
  let t = 0;
  if (len2 > 0) {
    t = ((p[0] - a[0]) * d[0]! + (p[1] - a[1]) * d[1]! + (p[2] - a[2]) * d[2]!) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.hypot(
    p[0] - (a[0] + t * d[0]!),
    p[1] - (a[1] + t * d[1]!),
    p[2] - (a[2] + t * d[2]!),
  );
}

/** The stroke's points with the ones no eye could miss removed; ends always kept. */
export function simplifyStroke(
  points: readonly ScenePoint[],
  widthPx: number,
  tolerance = SIMPLIFY_TOLERANCE_PX,
): ScenePoint[] {
  if (points.length <= 2) return [...points];
  const p3 = points.map<P3>((p) => [p.x, p.y, (p.p ?? 0) * widthPx]);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  // Iterative, so a stroke of thousands of points cannot overflow the stack.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let i = from + 1; i < to; i++) {
      const d = distanceToSegment(p3[i]!, p3[from]!, p3[to]!);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at >= 0 && worst > tolerance) {
      keep[at] = 1;
      stack.push([from, at], [at, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
