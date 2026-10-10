// An open line with fewer points (Ramer-Douglas-Peucker): what Mirror's merge and Tidy Up turn a
// drawn stroke's samples into (docs/specs/007-editor/logo-pages.md "Mirror", "Tidy Up"). Pure.

/** The fewest of `pts` within `tol` of the polyline they draw, its ends kept. */
export function simplifyLine(pts: readonly { x: number; y: number }[], tol: number) {
  if (pts.length <= 2) return [...pts];
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const pa = pts[a]!;
    const pb = pts[b]!;
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy);
    let far = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const p = pts[i]!;
      // Ends that meet (a loop drawn back to its start) have no line between them: the distance
      // is from that point, or every sample would count as on the line and the loop collapse.
      const d =
        len < 1e-6
          ? Math.hypot(p.x - pa.x, p.y - pa.y)
          : Math.abs(dx * (pa.y - p.y) - dy * (pa.x - p.x)) / len;
      if (d > far) {
        far = d;
        at = i;
      }
    }
    if (far > tol && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
