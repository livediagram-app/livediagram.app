// Hand-drawn shape recognition. Takes the simplified polyline a
// pencil-tool gesture produced (post-RDP, before Catmull-Rom
// smoothing) and, when the gesture clearly resembles a primitive,
// returns the matching shape kind + bounding box + a 0..1
// confidence score. The editor-page commit handler decides whether
// to convert the freehand into a proper shape element based on the
// score; see spec/09 Pencil (freehand) subsection for the user-
// visible contract.
//
// Heuristics over template-matching ($1 Recognizer et al) on purpose:
// fewer constants to tune, no templates to maintain per shape kind,
// rotation-tolerant detection comes for free from the geometric
// measurements rather than from rotating each template through a
// hundred angles.
//
// Detection order:
//
//   1. Open polyline + first/last endpoints far apart -> Line
//   2. Closed polyline, scored against each idealised outline; the
//      highest-confidence match that clears its threshold wins:
//        a. bounding-box edges        -> Rectangle
//        b. diamond (edge-midpoint) edges -> Diamond
//        c. upward-triangle edges     -> Triangle
//        d. point-up 5-pointed star edges -> Star
//        e. inscribed ellipse         -> Circle
//
// Each branch returns a confidence in [0, 1]. The caller's threshold
// (today 0.40 in commitFreehand) leans hard toward "convert it":
// turning the recognise-shape mode on is an explicit opt-in via the
// persisted spec/20 `recogniseShapes` preference, so the user has
// already asked for classification. A false-positive convert is one
// Cmd-Z away; a false negative (a wobbly square that stayed a
// sketch) is more frustrating, so the bar is set well below the
// detector's internal reject points. Previous values: 0.72 (too
// strict), 0.55 (still too strict per user feedback).

export type RecognisedShapeKind = 'square' | 'circle' | 'diamond' | 'triangle' | 'star' | 'line';

export type RecognisedShape = {
  kind: RecognisedShapeKind;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  // For lines specifically, the two endpoints in canvas coords (so
  // the caller can mint an ArrowElement with the right `from` / `to`).
  // Other kinds use `bbox` only.
  from?: { x: number; y: number };
  to?: { x: number; y: number };
};

type Point = { x: number; y: number };

function aabb(points: Point[]): { x: number; y: number; width: number; height: number } {
  let minX = points[0]!.x;
  let maxX = points[0]!.x;
  let minY = points[0]!.y;
  let maxY = points[0]!.y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

// Perpendicular distance from a point to a line segment. Returns 0
// when the segment is degenerate (start === end). Used to score how
// closely a freehand polyline tracks an idealised shape's edges.
function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  // Clamp t to [0, 1] so the distance is to the segment, not the
  // infinite line.
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

// Min distance from a point to any edge in a closed polygon (the
// edges define a shape's outline). Used by the rectangle / diamond
// scorers: if every freehand sample sits close to one of the shape's
// edges, the shape matches.
function meanEdgeDistance(points: Point[], edges: [Point, Point][]): number {
  let total = 0;
  for (const p of points) {
    let best = Infinity;
    for (const [a, b] of edges) {
      const d = pointToSegmentDistance(p, a, b);
      if (d < best) best = d;
    }
    total += best;
  }
  return total / points.length;
}

// Distance from a point to the boundary of an axis-aligned ellipse
// inscribed in the given bbox. Approximates via the parametric form,
// not the exact closed-form ellipse distance, which is iterative and
// overkill for a "is this freehand roughly a circle" check. The
// approximation is accurate enough for confidence scoring.
function pointToEllipseDistance(p: Point, cx: number, cy: number, rx: number, ry: number): number {
  if (rx <= 0 || ry <= 0) return Math.hypot(p.x - cx, p.y - cy);
  // Vector from centre to point, normalised against ellipse radii.
  // For a point on the ellipse, sqrt((dx/rx)^2 + (dy/ry)^2) = 1.
  const dx = (p.x - cx) / rx;
  const dy = (p.y - cy) / ry;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r === 0) return Math.min(rx, ry);
  // The closest point on the ellipse along that ray is at (cx +
  // (dx/r) * rx, cy + (dy/r) * ry). Distance from p to that point.
  const ellipseX = cx + (dx / r) * rx;
  const ellipseY = cy + (dy / r) * ry;
  return Math.hypot(p.x - ellipseX, p.y - ellipseY);
}

function meanEllipseDistance(
  points: Point[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): number {
  let total = 0;
  for (const p of points) total += pointToEllipseDistance(p, cx, cy, rx, ry);
  return total / points.length;
}

// Min-side-length floor below which we don't bother recognising. Two
// reasons: (1) a flick that produces a 4x4 sketch is probably an
// accident, not an intentional shape; (2) the bounding-box-area-based
// scoring becomes noisy at tiny scales where one pixel of jitter
// swings the confidence by a lot.
const MIN_SIZE = 12;

// Closed-curve test: how close the endpoints have to be (as a
// fraction of the longer bbox axis) to count as "the user came back
// around". Hand-drawn shapes rarely close perfectly; 0.18 is the
// sweet spot from tuning against real strokes.
const CLOSURE_THRESHOLD = 0.18;

function recogniseLine(points: Point[], bbox: ReturnType<typeof aabb>): RecognisedShape | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const chord = Math.hypot(last.x - first.x, last.y - first.y);
  if (chord < MIN_SIZE) return null;
  const length = polylineLength(points);
  if (length === 0) return null;
  // Straightness score: how close the polyline length is to the chord
  // length. A perfect line has the two equal; a curve has length > chord.
  const straightness = chord / length;
  if (straightness < 0.85) return null;
  // Aspect ratio sanity check: a tiny chord drawn next to a tall scribble
  // can still pass straightness if it's overall direct. Require the
  // line to actually span the bbox.
  const longerSide = Math.max(bbox.width, bbox.height);
  if (chord / longerSide < 0.75) return null;
  return {
    kind: 'line',
    bbox,
    confidence: Math.min(1, (straightness - 0.85) / 0.12 + 0.6),
    from: first,
    to: last,
  };
}

function recogniseRectangle(
  points: Point[],
  bbox: ReturnType<typeof aabb>,
): RecognisedShape | null {
  // The four sides of an axis-aligned rectangle. If the user's freehand
  // tracks these edges well (mean perpendicular distance is small
  // relative to the longer side), it's a rectangle.
  const tl: Point = { x: bbox.x, y: bbox.y };
  const tr: Point = { x: bbox.x + bbox.width, y: bbox.y };
  const br: Point = { x: bbox.x + bbox.width, y: bbox.y + bbox.height };
  const bl: Point = { x: bbox.x, y: bbox.y + bbox.height };
  const edges: [Point, Point][] = [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ];
  const meanDist = meanEdgeDistance(points, edges);
  const longerSide = Math.max(bbox.width, bbox.height);
  if (longerSide === 0) return null;
  const error = meanDist / longerSide;
  // Reject anything that's not even close. Tunable; 0.08 ~ 8% of the
  // bbox is a generous tolerance for hand-drawn rectangles.
  if (error > 0.08) return null;
  // Map error to confidence: 0 error -> 1, 0.08 -> 0.
  const confidence = Math.max(0, 1 - error / 0.08);
  return { kind: 'square', bbox, confidence };
}

function recogniseDiamond(points: Point[], bbox: ReturnType<typeof aabb>): RecognisedShape | null {
  // Diamond corners sit at the bbox edge midpoints (the rotated-square
  // / kite shape). Score the same way as rectangle: mean distance from
  // every freehand sample to the nearest diamond edge.
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const north: Point = { x: cx, y: bbox.y };
  const east: Point = { x: bbox.x + bbox.width, y: cy };
  const south: Point = { x: cx, y: bbox.y + bbox.height };
  const west: Point = { x: bbox.x, y: cy };
  const edges: [Point, Point][] = [
    [north, east],
    [east, south],
    [south, west],
    [west, north],
  ];
  const meanDist = meanEdgeDistance(points, edges);
  const longerSide = Math.max(bbox.width, bbox.height);
  if (longerSide === 0) return null;
  const error = meanDist / longerSide;
  // Tighter than rectangle: a square drawn loosely could otherwise
  // beat a deliberate diamond. The two shapes' edge sets compete on
  // the same scale, so being stricter here keeps the more common
  // square / rectangle as the rectangle scorer's win in close calls.
  if (error > 0.06) return null;
  const confidence = Math.max(0, 1 - error / 0.06);
  return { kind: 'diamond', bbox, confidence };
}

function recogniseTriangle(points: Point[], bbox: ReturnType<typeof aabb>): RecognisedShape | null {
  // Upward triangle: apex at the top-centre, base spanning the two
  // bottom corners — matching the 'triangle' shape's geometry. Scored
  // like rectangle / diamond: mean distance from every freehand sample
  // to the nearest of the three edges.
  const apex: Point = { x: bbox.x + bbox.width / 2, y: bbox.y };
  const bl: Point = { x: bbox.x, y: bbox.y + bbox.height };
  const br: Point = { x: bbox.x + bbox.width, y: bbox.y + bbox.height };
  const edges: [Point, Point][] = [
    [apex, br],
    [br, bl],
    [bl, apex],
  ];
  const meanDist = meanEdgeDistance(points, edges);
  const longerSide = Math.max(bbox.width, bbox.height);
  if (longerSide === 0) return null;
  const error = meanDist / longerSide;
  if (error > 0.08) return null;
  return { kind: 'triangle', bbox, confidence: Math.max(0, 1 - error / 0.08) };
}

function recogniseStar(points: Point[], bbox: ReturnType<typeof aabb>): RecognisedShape | null {
  // Point-up 5-pointed star fit to the bbox: outer vertices on the
  // bbox-radius ellipse, inner vertices at ~0.4 of that. Scored by mean
  // distance to the nearest of the ten edges, so a circle (no notches)
  // and a triangle (no inner points) both fall away.
  if (bbox.width < MIN_SIZE || bbox.height < MIN_SIZE) return null;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const rx = bbox.width / 2;
  const ry = bbox.height / 2;
  const innerRatio = 0.4;
  const verts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = ((-90 + i * 36) * Math.PI) / 180;
    const r = i % 2 === 0 ? 1 : innerRatio;
    verts.push({ x: cx + Math.cos(ang) * rx * r, y: cy + Math.sin(ang) * ry * r });
  }
  const edges: [Point, Point][] = [];
  for (let i = 0; i < 10; i++) edges.push([verts[i]!, verts[(i + 1) % 10]!]);
  const meanDist = meanEdgeDistance(points, edges);
  const longerSide = Math.max(bbox.width, bbox.height);
  if (longerSide === 0) return null;
  const error = meanDist / longerSide;
  // Stars are hard to draw cleanly, so the tolerance is the widest.
  if (error > 0.1) return null;
  return { kind: 'star', bbox, confidence: Math.max(0, 1 - error / 0.1) };
}

function recogniseCircle(points: Point[], bbox: ReturnType<typeof aabb>): RecognisedShape | null {
  // Score by mean distance from each freehand sample to the inscribed
  // ellipse boundary. A perfect circle / oval has every sample on the
  // ellipse, so the mean distance is 0.
  if (bbox.width < MIN_SIZE || bbox.height < MIN_SIZE) return null;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const rx = bbox.width / 2;
  const ry = bbox.height / 2;
  const meanDist = meanEllipseDistance(points, cx, cy, rx, ry);
  const longerSide = Math.max(bbox.width, bbox.height);
  const error = meanDist / longerSide;
  // Circles are slightly harder to draw than rectangles (no straight
  // edges to anchor against), so the tolerance is wider.
  if (error > 0.1) return null;
  const confidence = Math.max(0, 1 - error / 0.1);
  return { kind: 'circle', bbox, confidence };
}

// Public entry point. Returns the highest-confidence match across
// the registered shape kinds, or null when no kind clears its
// branch's reject threshold. Callers should compare the score to
// their own threshold before acting; the editor currently uses
// 0.40 because the mode is opt-in via the persisted spec/20
// `recogniseShapes` preference (see the header comment).
export function recogniseShape(points: Point[]): RecognisedShape | null {
  if (points.length < 4) return null;
  const bbox = aabb(points);
  if (bbox.width < MIN_SIZE && bbox.height < MIN_SIZE) return null;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const closingDist = Math.hypot(last.x - first.x, last.y - first.y);
  const longerSide = Math.max(bbox.width, bbox.height) || 1;
  const closed = closingDist / longerSide < CLOSURE_THRESHOLD;

  // Open polyline that's clearly elongated -> line attempt. Doesn't
  // recurse into the closed branch if the line branch fails: an open
  // squiggle doesn't look like a closed shape.
  if (!closed) {
    return recogniseLine(points, bbox);
  }

  // Closed polyline: score against rectangle, diamond, circle. Take
  // the highest-scoring branch that passed its own threshold.
  const candidates: RecognisedShape[] = [];
  const rect = recogniseRectangle(points, bbox);
  if (rect) candidates.push(rect);
  const diamond = recogniseDiamond(points, bbox);
  if (diamond) candidates.push(diamond);
  const triangle = recogniseTriangle(points, bbox);
  if (triangle) candidates.push(triangle);
  const star = recogniseStar(points, bbox);
  if (star) candidates.push(star);
  const circle = recogniseCircle(points, bbox);
  if (circle) candidates.push(circle);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0]!;
}
