// The hero windows' cursors ride a polyline (CSS motion path), stopping at each point in turn
// (docs/specs/019-marketing/marketing-site.md "Hero"). The keyframes fix when each stop is reached;
// how far along the path each stop lies depends on the layout (a phone's portrait layout moves the
// points), so it is worked out here and handed to the keyframes as --p1, --p2 ... (percentages).

export type Point = readonly [number, number];

export function polylinePath(points: readonly Point[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

// How far along the polyline each point after the first lies, as a percentage of its length.
export function polylineStops(points: readonly Point[]): number[] {
  const legs = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  const total = legs.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  return legs.map((leg) => {
    run += leg;
    return Math.round((run / total) * 10000) / 100;
  });
}

// The style a cursor needs to ride `points`: its motion path and the stop distances.
export function cursorRide(points: readonly Point[]): Record<string, string> {
  const style: Record<string, string> = { offsetPath: `path('${polylinePath(points)}')` };
  polylineStops(points).forEach((p, i) => {
    style[`--p${i + 1}`] = `${p}%`;
  });
  return style;
}
