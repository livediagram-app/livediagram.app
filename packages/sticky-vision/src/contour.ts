// The OUTLINE of a blob of paper (docs/specs/021-event-storming/event-storming.md Phase 9, experiments B1–B2).
//
// Two notes lapped over each other are one blob to the colour mask, but not to
// its outline: where one note's edge meets the other's, the outline turns
// INWARDS, a notch no single rectangle has. Tracing the border, simplifying it
// and measuring how far it falls inside its convex hull finds those notches,
// and a cut between two of them is the seam between two notes.
//
// Pure over a binary mask (one byte per pixel, 0 or 1), iterative throughout:
// a blob is a few thousand pixels, but a recursion per pixel still has no
// place on a phone.

export type Point = { x: number; y: number };

// The eight neighbours, clockwise with y pointing down: E, SE, S, SW, W, NW,
// N, NE. The tracer searches them in this order.
const DX = [1, 1, 0, -1, -1, -1, 0, 1] as const;
const DY = [0, 1, 1, 1, 0, -1, -1, -1] as const;

function directionOf(dx: number, dy: number): number {
  for (let d = 0; d < 8; d += 1) if (DX[d] === dx && DY[d] === dy) return d;
  return 4;
}

// The outer border of the first region met in raster order, as the centres
// of its border pixels, clockwise (Moore-neighbour tracing with Jacob's
// stopping rule, the outer-border half of Suzuki–Abe). Pass a mask holding
// one region (see `largestRegion`) to get THAT region's outline.
export function traceOuterContour(bin: Uint8Array, width: number, height: number): Point[] {
  let start = -1;
  for (let i = 0; i < bin.length; i += 1) {
    if (bin[i] !== 0) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];
  const set = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && bin[y * width + x] !== 0;
  const sx = start % width;
  const sy = (start / width) | 0;
  const contour: Point[] = [{ x: sx, y: sy }];
  // The first pixel in raster order has nothing to its west, so the walk
  // starts as if it had just come from there.
  let cx = sx;
  let cy = sy;
  let back = 4;
  let firstMove = -1;
  // A border can visit a pixel at most four times (once per side), which
  // bounds the walk even on a pathological mask.
  const limit = 4 * bin.length + 8;
  for (let steps = 0; steps < limit; steps += 1) {
    let moved = -1;
    for (let k = 1; k <= 8; k += 1) {
      const d = (back + k) % 8;
      if (set(cx + DX[d]!, cy + DY[d]!)) {
        moved = d;
        break;
      }
    }
    if (moved === -1) return contour;
    if (cx === sx && cy === sy) {
      if (firstMove === -1) firstMove = moved;
      else if (moved === firstMove) {
        contour.pop();
        return contour;
      }
    }
    // The last neighbour checked before the move was unset; it is where the
    // search starts from the new pixel.
    const prev = (moved + 7) % 8;
    const px = cx + DX[prev]!;
    const py = cy + DY[prev]!;
    cx += DX[moved]!;
    cy += DY[moved]!;
    back = directionOf(px - cx, py - cy);
    contour.push({ x: cx, y: cy });
  }
  return contour;
}

// Only the biggest 8-connected region of a mask, as a fresh mask. A cut
// piece of a blob can hold a stray fragment of a neighbour's paper, and its
// outline is not the note's.
export function largestRegion(bin: Uint8Array, width: number, height: number): Uint8Array {
  const labels = new Int32Array(bin.length);
  const queue = new Int32Array(bin.length);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let i = 0; i < bin.length; i += 1) {
    if (bin[i] === 0 || labels[i] !== 0) continue;
    next += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    labels[i] = next;
    while (head < tail) {
      const p = queue[head++]!;
      const x = p % width;
      const y = (p / width) | 0;
      for (let d = 0; d < 8; d += 1) {
        const nx = x + DX[d]!;
        const ny = y + DY[d]!;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (bin[q] === 0 || labels[q] !== 0) continue;
        labels[q] = next;
        queue[tail++] = q;
      }
    }
    if (tail > bestSize) {
      bestSize = tail;
      best = next;
    }
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) if (labels[i] === best && best !== 0) out[i] = 1;
  return out;
}

function distanceToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// Ramer–Douglas–Peucker on an open run of points, keeping the ends.
function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop()!;
    let worst = -1;
    let worstAt = -1;
    for (let i = from + 1; i < to; i += 1) {
      const d = distanceToLine(points[i]!, points[from]!, points[to]!);
      if (d > worst) {
        worst = d;
        worstAt = i;
      }
    }
    if (worst > epsilon) {
      keep[worstAt] = 1;
      stack.push([from, worstAt], [worstAt, to]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

// A closed outline simplified to the vertices that matter: split at the start
// and at the point farthest from it, and simplify each half. A traced
// rectangle comes back as its four corners.
export function simplifyClosed(contour: Point[], epsilon: number): Point[] {
  if (contour.length < 4) return contour;
  const origin = contour[0]!;
  let far = 0;
  let farDist = -1;
  contour.forEach((p, i) => {
    const d = Math.hypot(p.x - origin.x, p.y - origin.y);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  });
  const first = rdp(contour.slice(0, far + 1), epsilon);
  const second = rdp([...contour.slice(far), origin], epsilon);
  const poly = [...first, ...second.slice(1, -1)];
  // The start point survives the split whatever it is; drop it when it sits
  // on the straight line between its neighbours.
  if (poly.length > 3) {
    const prev = poly[poly.length - 1]!;
    if (distanceToLine(poly[0]!, prev, poly[1]!) <= epsilon) poly.shift();
  }
  return poly;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Andrew's monotone chain; the hull's vertices as keys `x,y`.
function hullKeys(points: Point[]): Set<string> {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (pts: Point[]) => {
    const out: Point[] = [];
    for (const p of pts) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0)
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  return new Set(hull.map((p) => `${p.x},${p.y}`));
}

export type Notch = {
  // The deepest point of the outline between two hull vertices.
  at: Point;
  // Its distance inside the hull edge, in pixels.
  depth: number;
  // Its index in the contour, and the hull vertices either side of it.
  index: number;
  from: number;
  to: number;
};

// Where the outline falls inside its convex hull by at least `minDepth`: the
// notches. Between every two consecutive hull vertices the deepest contour
// point is a candidate; a rectangle has none, two offset rectangles have one
// each side of the seam.
export function convexityDefects(contour: Point[], minDepth: number): Notch[] {
  if (contour.length < 4) return [];
  const keys = hullKeys(contour);
  const seen = new Set<string>();
  const hullAt: number[] = [];
  contour.forEach((p, i) => {
    const key = `${p.x},${p.y}`;
    if (keys.has(key) && !seen.has(key)) {
      seen.add(key);
      hullAt.push(i);
    }
  });
  if (hullAt.length < 2) return [];
  const notches: Notch[] = [];
  for (let h = 0; h < hullAt.length; h += 1) {
    const from = hullAt[h]!;
    const to = hullAt[(h + 1) % hullAt.length]!;
    const a = contour[from]!;
    const b = contour[to]!;
    let deepest = -1;
    let depth = 0;
    const span = (to - from + contour.length) % contour.length;
    for (let k = 1; k < span; k += 1) {
      const i = (from + k) % contour.length;
      const d = distanceToLine(contour[i]!, a, b);
      if (d > depth) {
        depth = d;
        deepest = i;
      }
    }
    if (deepest !== -1 && depth >= minDepth) {
      notches.push({ at: contour[deepest]!, depth, index: deepest, from, to });
    }
  }
  return notches;
}
