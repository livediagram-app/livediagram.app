// The Marker finish's geometry (docs/specs/008-canvas/finish.md "Marker"): the outlines Sketch draws (sketch.ts) laid
// down with a felt-tip instead of a pencil. Pure and deterministic, seeded by the element's id as Sketch is; no DOM.
//
// A marker draws one stroke per edge, never two: each one bows a little and runs past its corner as a quick stroke
// does, a straight edge flows into the rounded corner after it in one gesture, and a closed curve overlaps where it
// began. The strokes are dealt alternately into two layers so a renderer can paint each in slightly see-through ink:
// wherever two strokes cross (a corner, a loop's overlap) the ink pools darker, as real marker ink does. An area is
// coloured in with broad overlapping rows, dealt into layers the same way, so their overlaps streak.
import { sketchPoint as fmt, sketchRandom, type Pt, type SketchOutline } from './sketch';

/** Most a marker stroke's end moves, px: a quick, confident line, steadier than Sketch's pencil (1.5). */
export const MARKER_JITTER_PX = 0.8;
/** Most a marker stroke runs past its end, px: corners visibly cross (blueprint: 2 to 5). */
export const MARKER_OVERSHOOT_PX = 3.5;
/** Most a stroke starts before its corner, px: the nib lands a little early. */
export const MARKER_LEAD_IN_PX = 1.5;
/** A stroke's bow as a share of its length, capped by MARKER_BOW_MAX_PX: flatter than a pencil's (0.02, 5). */
export const MARKER_BOW_SHARE = 0.012;
export const MARKER_BOW_MAX_PX = 3;
/** Most a curve sample moves, px, eased between knots every MARKER_CURVE_KNOT_EVERY samples. */
export const MARKER_CURVE_JITTER_PX = 1.2;
const MARKER_CURVE_KNOT_EVERY = 4;
/** The share of a closed curve drawn twice where the stroke comes round past its start. */
export const MARKER_LOOP_OVERLAP = 0.1;

/** How see-through marker ink is: one stroke shows the paper a touch, two crossing strokes pool darker
 *  (blueprint: 0.8 to 0.92; below 0.8 a lone line reads washed out). */
export const MARKER_INK_OPACITY = 0.86;
/** The width thin chrome (bezels, keys, creases) is drawn at in marker, px: a fine-liner beside the nib, a touch
 *  bolder than Flexible's 0.8 px so it reads as ink. */
export const MARKER_DETAIL_PX = 1.2;
/** Colouring in: the broad nib's width, px, and the step between rows as a share of it (rows overlap by the rest). */
export const MARKER_COLOUR_NIB_PX = 12;
export const MARKER_COLOUR_STEP = 0.74;
/** The rows' slant, degrees, and how far one element's slant turns from it either way. */
export const MARKER_COLOUR_ANGLE_DEG = -22;
const MARKER_COLOUR_ANGLE_SPREAD_DEG = 6;
/** Most a row's end falls short of the outline, px: the ends of the strokes show. */
export const MARKER_COLOUR_RAGGED_PX = 5;
/** The most rows one area draws; a larger area widens its nib instead (a 5,000 px tall box draws 200 rows). */
export const MARKER_COLOUR_MAX_ROWS = 200;
/** How strongly the colouring's strokes show over the fill, in the outline's colour: one row is a faint tint, two
 *  overlapping rows a streak, faint enough that a label on it reads as on a plain fill. */
export const MARKER_STREAK_OPACITY = 0.07;

/** Path data dealt into two layers, so a crossing between strokes in different layers pools darker. */
export type MarkerLayers = [string, string];

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const spread = (rng: () => number, amount: number) => (rng() * 2 - 1) * amount;

// ---------------------------------------------------------------------------------------------------------------
// Strokes
// ---------------------------------------------------------------------------------------------------------------

type LineEnds = { leadIn: boolean; overshoot: boolean };

// One marker stroke along a straight edge: landing a little early, bowing slightly, running past its end. Returns the
// path and where it actually ended, so a corner drawn in the same gesture carries on from there.
function markerLine(a: Pt, b: Pt, rng: () => number, ends: LineEnds): { d: string; end: Pt } {
  const len = dist(a, b);
  if (len < 0.5) return { d: `M ${fmt(a)} L ${fmt(b)}`, end: b };
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const j = Math.min(MARKER_JITTER_PX, len * 0.04);
  // Short strokes land and lift closer to their ends.
  const reach = Math.min(1, len / 30);
  const lead = ends.leadIn ? rng() * MARKER_LEAD_IN_PX * reach : 0;
  const over = ends.overshoot ? (0.35 + 0.65 * rng()) * MARKER_OVERSHOOT_PX * reach : 0;
  // A pinned start (an arrow leaving its box) stays exactly where it is, as a pinned end does.
  const s = ends.leadIn
    ? { x: a.x - ux * lead + spread(rng, j), y: a.y - uy * lead + spread(rng, j) }
    : a;
  const e = ends.overshoot
    ? { x: b.x + ux * over + spread(rng, j), y: b.y + uy * over + spread(rng, j) }
    : b;
  const bow = spread(rng, Math.min(len * MARKER_BOW_SHARE, MARKER_BOW_MAX_PX));
  const c = { x: (s.x + e.x) / 2 - uy * bow * 2, y: (s.y + e.y) / 2 + ux * bow * 2 };
  return { d: `M ${fmt(s)} Q ${fmt(c)} ${fmt(e)}`, end: e };
}

// A Catmull-Rom spline through moved[from..to], as path commands after the move to moved[from].
function splineCommands(moved: readonly Pt[], from: number, to: number): string {
  const parts: string[] = [];
  for (let i = from; i < to; i++) {
    const p0 = moved[i - 1] ?? moved[i]!;
    const p1 = moved[i]!;
    const p2 = moved[i + 1]!;
    const p3 = moved[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    parts.push(`C ${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`);
  }
  return parts.join(' ');
}

// A curve's samples drifted low-frequency (eased knots), so it wanders like a hand rather than buzzing.
function drift(pts: readonly Pt[], rng: () => number): Pt[] {
  const knots = Array.from({ length: Math.ceil(pts.length / MARKER_CURVE_KNOT_EVERY) + 1 }, () => ({
    x: spread(rng, MARKER_CURVE_JITTER_PX),
    y: spread(rng, MARKER_CURVE_JITTER_PX),
  }));
  return pts.map((p, i) => {
    const k = Math.floor(i / MARKER_CURVE_KNOT_EVERY);
    const t = (i % MARKER_CURVE_KNOT_EVERY) / MARKER_CURVE_KNOT_EVERY;
    const a = knots[k]!;
    const b = knots[k + 1]!;
    return { x: p.x + a.x + (b.x - a.x) * t, y: p.y + a.y + (b.y - a.y) * t };
  });
}

// A closed curve: started somewhere along itself, drawn once round, then on past its start for a stretch. The stretch
// is its own stroke (`overlap`), so the renderer pools it darker over the start it crosses.
function markerLoop(points: readonly Pt[], rng: () => number): { d: string; overlap: string } {
  const n = points.length;
  const k = Math.floor(rng() * n);
  const pts = [...points.slice(k), ...points.slice(0, k)];
  const extra = clamp(Math.round(n * MARKER_LOOP_OVERLAP), 1, n - 1);
  pts.push(...pts.slice(0, extra + 1));
  const moved = drift(pts, rng);
  return {
    d: `M ${fmt(moved[0]!)} ${splineCommands(moved, 0, n)}`,
    overlap: `M ${fmt(moved[n]!)} ${splineCommands(moved, n, moved.length - 1)}`,
  };
}

/** The outline as marker strokes, dealt into two layers. Each straight edge is a stroke of its own, taking the open
 *  curve after it (a rounded corner) in the same gesture; a closed curve is one stroke and its overlap. `pinEnds`
 *  keeps an open outline's first and last points where they are (an arrow's ends meet their boxes and heads). */
export function markerStrokes(
  outline: SketchOutline,
  seed: number,
  opts: { pinEnds?: boolean } = {},
): MarkerLayers {
  const rng = sketchRandom(seed ^ 0x6a09e667);
  const strokes: string[] = [];
  const overlaps: string[] = [];
  const segs = outline.segments;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    const first = i === 0;
    const last = i === segs.length - 1;
    if (seg.kind === 'curve') {
      if (seg.points.length < 2) continue;
      if (seg.closed) {
        const loop = markerLoop(seg.points, rng);
        strokes.push(loop.d);
        overlaps.push(loop.overlap);
        continue;
      }
      const moved = drift(seg.points, rng);
      if (opts.pinEnds && first) moved[0] = seg.points[0]!;
      if (opts.pinEnds && last) moved[moved.length - 1] = seg.points[seg.points.length - 1]!;
      strokes.push(`M ${fmt(moved[0]!)} ${splineCommands(moved, 0, moved.length - 1)}`);
      continue;
    }
    const next = segs[i + 1];
    const corner = next?.kind === 'curve' && !next.closed && next.points.length >= 2 ? next : null;
    const line = markerLine(seg.from, seg.to, rng, {
      leadIn: !(opts.pinEnds && first),
      // A corner drawn on in the same gesture starts exactly where the line ends.
      overshoot: !corner && !(opts.pinEnds && last),
    });
    if (!corner) {
      strokes.push(line.d);
      continue;
    }
    const moved = drift(corner.points, rng);
    moved[0] = line.end;
    if (opts.pinEnds && i + 1 === segs.length - 1)
      moved[moved.length - 1] = corner.points[corner.points.length - 1]!;
    strokes.push(`${line.d} ${splineCommands(moved, 0, moved.length - 1)}`);
    i++;
  }
  // Alternate layers, so every stroke crosses its neighbours in the other one; the overlaps of closed curves go in
  // the layer their own stroke is not in.
  const layers: [string[], string[]] = [[], []];
  strokes.forEach((d, i) => layers[i % 2]!.push(d));
  layers[strokes.length > 1 ? 0 : 1].push(...overlaps);
  return [layers[0].join(' '), layers[1].join(' ')];
}

/** An open outline with its ends cut back along itself, `startPx` and `endPx` (a hollow head's line stops at its
 *  base). A cut longer than the end segment leaves it as it was. */
export function trimOutline(outline: SketchOutline, startPx: number, endPx: number): SketchOutline {
  const segments = [...outline.segments];
  const cut = (index: number, px: number, atEnd: boolean) => {
    const seg = segments[index];
    if (!seg || px <= 0) return;
    if (seg.kind === 'line') {
      const len = dist(seg.from, seg.to);
      if (len <= px * 1.5) return;
      const t = px / len;
      const from = atEnd ? seg.from : lerp(seg.from, seg.to, t);
      const to = atEnd ? lerp(seg.to, seg.from, t) : seg.to;
      segments[index] = { kind: 'line', from, to };
      return;
    }
    if (seg.closed) return;
    const pts = atEnd ? [...seg.points].reverse() : [...seg.points];
    let left = px;
    let i = 0;
    while (i < pts.length - 1 && left > dist(pts[i]!, pts[i + 1]!)) {
      left -= dist(pts[i]!, pts[i + 1]!);
      i++;
    }
    if (i >= pts.length - 2) return;
    const step = dist(pts[i]!, pts[i + 1]!);
    const kept = [lerp(pts[i]!, pts[i + 1]!, step > 0 ? left / step : 0), ...pts.slice(i + 1)];
    segments[index] = { kind: 'curve', points: atEnd ? kept.reverse() : kept, closed: false };
  };
  cut(0, startPx, false);
  cut(segments.length - 1, endPx, true);
  return { segments, area: outline.area };
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** A marker arrowhead `lengthPx` long at `tip`, opening back against `dir` (the way the head faces). Open: one
 *  chevron stroke drawn without lifting the pen. Closed: a triangle, which the renderer fills for a solid wedge or
 *  leaves hollow. */
export function markerArrowHead(
  tip: Pt,
  dir: Pt,
  lengthPx: number,
  seed: number,
  closed: boolean,
): string {
  const rng = sketchRandom(seed ^ 0x3c6ef372);
  const bx = tip.x - dir.x * lengthPx;
  const by = tip.y - dir.y * lengthPx;
  // A filled wedge reads heavier than two strokes, so it opens a little narrower.
  const half = lengthPx * (closed ? 0.42 : 0.5);
  const j = Math.min(0.8, lengthPx * 0.05);
  const w1 = { x: bx - dir.y * half + spread(rng, j), y: by + dir.x * half + spread(rng, j) };
  const w2 = { x: bx + dir.y * half + spread(rng, j), y: by - dir.x * half + spread(rng, j) };
  const t = { x: tip.x + spread(rng, j / 2), y: tip.y + spread(rng, j / 2) };
  if (closed) return `M ${fmt(w1)} L ${fmt(t)} L ${fmt(w2)} Z`;
  // A slight bow on each arm, the two arms one gesture through the tip.
  const bowed = (a: Pt, b: Pt) => {
    const bow = spread(rng, 0.8);
    const len = dist(a, b) || 1;
    return {
      x: (a.x + b.x) / 2 - ((b.y - a.y) / len) * bow,
      y: (a.y + b.y) / 2 + ((b.x - a.x) / len) * bow,
    };
  };
  return `M ${fmt(w1)} Q ${fmt(bowed(w1, t))} ${fmt(t)} Q ${fmt(bowed(t, w2))} ${fmt(w2)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Colouring in
// ---------------------------------------------------------------------------------------------------------------

type Span = [number, number];

// Where a horizontal line at `y` is inside the polygon: even-odd pairs of its edge crossings, sorted.
function spansAt(poly: readonly Pt[], y: number): Span[] {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((p, q) => p - q);
  const out: Span[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i]!, xs[i + 1]!]);
  return out;
}

// The spans inside both lists (each sorted and disjoint).
function intersectSpans(a: readonly Span[], b: readonly Span[]): Span[] {
  const out: Span[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i]![0], b[j]![0]);
    const hi = Math.min(a[i]![1], b[j]![1]);
    if (hi > lo) out.push([lo, hi]);
    if (a[i]![1] < b[j]![1]) i++;
    else j++;
  }
  return out;
}

/** A closed area coloured in with a broad marker: overlapping rows at a slant, back and forth, each kept inside the
 *  area along its whole width and falling a little short of the outline at its ends. Returns the rows dealt into
 *  two layers (their overlaps streak) and the nib they are drawn at, px. */
export function markerColouring(
  area: readonly Pt[],
  seed: number,
): { streaks: MarkerLayers; nibPx: number } {
  const none = { streaks: ['', ''] as MarkerLayers, nibPx: 0 };
  if (area.length < 3) return none;
  const rng = sketchRandom(seed ^ 0x2545f491);
  const angle =
    ((MARKER_COLOUR_ANGLE_DEG + spread(rng, MARKER_COLOUR_ANGLE_SPREAD_DEG)) * Math.PI) / 180;
  // Turn the area so the rows run horizontally, scan it, and turn each row back.
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const turned = area.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
  const back = (x: number, y: number): Pt => ({ x: x * cos + y * sin, y: -x * sin + y * cos });
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of turned) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const extent = maxY - minY;
  if (!(extent > 2)) return none;
  // The nib never outgrows the area, and widens past MARKER_COLOUR_NIB_PX only to keep a huge area under the row cap.
  const nib = clamp(
    Math.max(MARKER_COLOUR_NIB_PX, extent / (MARKER_COLOUR_MAX_ROWS * MARKER_COLOUR_STEP)),
    2,
    extent,
  );
  const rows = Math.max(1, Math.ceil((extent - nib) / (nib * MARKER_COLOUR_STEP)) + 1);
  const step = rows > 1 ? (extent - nib) / (rows - 1) : 0;
  const half = nib / 2;
  const layers: [string[], string[]] = [[], []];
  for (let r = 0; r < rows; r++) {
    const y = rows > 1 ? minY + half + r * step : (minY + maxY) / 2;
    // Inside along the row's whole width: its centre line and both its edges.
    const edge = half * 0.96;
    const spans = intersectSpans(
      intersectSpans(spansAt(turned, y - edge), spansAt(turned, y)),
      spansAt(turned, y + edge),
    );
    // Back and forth: alternate rows run the other way, as a hand colouring in does.
    const flip = r % 2 === 1;
    for (const [x0, x1] of spans) {
      // The round cap reaches `half` past each end; each end falls short by its own amount.
      const a = x0 + half + rng() * MARKER_COLOUR_RAGGED_PX;
      const b = x1 - half - rng() * MARKER_COLOUR_RAGGED_PX;
      const ry = y + spread(rng, 0.6);
      const from = back(flip ? b : a, ry);
      const to = back(flip ? a : b, ry + spread(rng, 0.6));
      if (b - a < 0.5) {
        // A sliver: a dab of the nib.
        const at = back((x0 + x1) / 2, ry);
        layers[r % 2]!.push(`M ${fmt(at)} L ${fmt(at)}`);
        continue;
      }
      const len = b - a;
      const bow = spread(rng, Math.min(1.2, len * 0.01));
      const mid = back((a + b) / 2, ry + bow * 2);
      layers[r % 2]!.push(`M ${fmt(from)} Q ${fmt(mid)} ${fmt(to)}`);
    }
  }
  return { streaks: [layers[0].join(' '), layers[1].join(' ')], nibPx: nib };
}
