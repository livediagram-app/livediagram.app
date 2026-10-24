// The Sketch finish's geometry (docs/specs/008-canvas/finish.md, blueprint
// docs/specs/008-canvas/blueprints/finish.md): an outline turned into hand-drawn strokes, an area into pencil
// hatching, an arrow end into two loose strokes. Pure and deterministic: the wobble comes from a seeded random
// stream (the element's id), so an element looks the same on every screen, in every export and after every reload.
// No DOM, safe in a worker; read by the canvas overlays and the SVG export alike.
//
// An outline is a list of segments: straight lines (drawn as a slightly bowed stroke that overshoots its ends,
// so corners cross like a pen's) and curves (sampled points, each nudged, drawn as a smooth spline). Two passes
// from two streams give the doubled line that reads as drawn by hand.
import type { ShapePart } from './shape-geometry';
import { seededRandom } from '@liveworkspace/document-core/seeded-random';
import { fnv1aString } from '@liveworkspace/document-core/string-hash';
import { arcPoints } from '@liveworkspace/document-core/svg-path-outline';

export type Pt = { x: number; y: number };

type SketchSegment =
  { kind: 'line'; from: Pt; to: Pt } | { kind: 'curve'; points: Pt[]; closed: boolean };

/** An outline to sketch. `area` is the closed polygon hatching fills, null for an open outline. Marker draws the same
 *  outlines with its own pen (marker.ts). */
export type SketchOutline = { segments: SketchSegment[]; area: Pt[] | null };

/** Most a line's end moves, px (rough.js roughness 1 reads at about 1 to 2 px). */
const SKETCH_JITTER_PX = 1.5;
/** Most a line runs past its end, px: corners visibly cross without stray tails. */
const SKETCH_OVERSHOOT_PX = 2;
/** A line's bow as a share of its length, capped by SKETCH_BOW_MAX_PX. */
const SKETCH_BOW_SHARE = 0.02;
const SKETCH_BOW_MAX_PX = 5;
/** How far apart a curve is sampled, px, and the sample bounds per curve. */
const SKETCH_CURVE_STEP_PX = 20;
const CURVE_MIN_SAMPLES = 8;
const CURVE_MAX_SAMPLES = 64;
/** Most a curve sample moves, px. */
const SKETCH_CURVE_JITTER_PX = 2;
/** A curve's wander is set every this many samples and eased between. */
const CURVE_KNOT_EVERY = 4;
/** Hatching: rough.js's default angle, the gap bounds, and the most lines one area draws. */
const SKETCH_HATCH_ANGLE_DEG = -41;
const HATCH_GAP_MIN_PX = 6;
const HATCH_GAP_MAX_PX = 12;
export const SKETCH_HATCH_MAX_LINES = 300;
/** A rounded corner is sampled at this many points. */
const CORNER_SAMPLES = 6;

// Tenths of a pixel: finer is invisible. Written through integers because turning a fractional double into
// text is the costliest step of a sketch (hundreds of numbers per shape); an integer's digits are cheap.
function num(v: number): string {
  const t = Math.round(v * 10);
  const whole = (t / 10) | 0;
  const tenth = t % 10;
  if (tenth === 0) return String(whole);
  return `${t < 0 && whole === 0 ? '-' : ''}${whole}.${tenth < 0 ? -tenth : tenth}`;
}
/** A point as path text, to a tenth of a pixel (shared with marker.ts). */
export const sketchPoint = (p: Pt) => `${num(p.x)} ${num(p.y)}`;
const fmt = sketchPoint;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------------------------------------------

/** FNV-1a (32-bit) of an id: the seed an element's wobble grows from. */
export const sketchSeed: (id: string) => number = fnv1aString;

/** mulberry32: a small, fast, seeded stream of numbers in [0, 1). */
export const sketchRandom: (seed: number) => () => number = seededRandom;

// ---------------------------------------------------------------------------------------------------------------
// Outlines
// ---------------------------------------------------------------------------------------------------------------

/** A rectangle, its corners rounded by `radius` px (clamped to half the shorter side). */
export function outlineOfRect(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): SketchOutline {
  const r = clamp(radius, 0, Math.min(w, h) / 2);
  if (r < 0.5)
    return outlineOfPolygon([
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]);
  // Clockwise from the top edge; each corner a quarter arc about its centre.
  const corners: [number, number, number][] = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  const arcs = corners.map(([cx, cy, from]) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= CORNER_SAMPLES; i++) {
      const a = from + (Math.PI / 2) * (i / CORNER_SAMPLES);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return pts;
  });
  const segments: SketchSegment[] = [];
  const area: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const arc = arcs[i]!;
    const next = arcs[(i + 1) % 4]!;
    segments.push({ kind: 'curve', points: arc, closed: false });
    segments.push({ kind: 'line', from: arc[arc.length - 1]!, to: next[0]! });
    area.push(...arc);
  }
  // Start on the top edge so the first stroke is a straight one.
  segments.unshift(segments.pop()!);
  return { segments, area };
}

/** An ellipse, as one closed curve. */
export function outlineOfEllipse(cx: number, cy: number, rx: number, ry: number): SketchOutline {
  // Ramanujan's perimeter, good to a fraction of a percent, sets the sample count.
  const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = clamp(
    Math.round(perimeter / SKETCH_CURVE_STEP_PX),
    CURVE_MIN_SAMPLES,
    CURVE_MAX_SAMPLES,
  );
  const points: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return { segments: [{ kind: 'curve', points, closed: true }], area: points };
}

/** A closed polygon, one straight stroke per edge. */
export function outlineOfPolygon(points: readonly Pt[]): SketchOutline {
  const segments: SketchSegment[] = points.map((p, i) => ({
    kind: 'line',
    from: p,
    to: points[(i + 1) % points.length]!,
  }));
  return { segments, area: points.length >= 3 ? [...points] : null };
}

/** A box-shaped kind's outline in its own px box: an ellipse for a circle, a pill for a stadium, else a
 *  rectangle with the given corner. `inset` keeps the stroke inside the box, as a CSS border is. */
export function outlineOfBox(
  kind: string,
  width: number,
  height: number,
  radiusPx: number,
  inset: number,
): SketchOutline {
  const w = Math.max(0, width - inset * 2);
  const h = Math.max(0, height - inset * 2);
  if (kind === 'circle') return outlineOfEllipse(width / 2, height / 2, w / 2, h / 2);
  const r = kind === 'stadium' ? Math.min(w, h) / 2 : Math.max(0, radiusPx - inset);
  return outlineOfRect(inset, inset, w, h, r);
}

/** A shape-table part already mapped into px (svg-shape-fit.ts). */
export function outlineOfPart(part: ShapePart): SketchOutline {
  switch (part.tag) {
    case 'rect':
      return outlineOfRect(
        part.x,
        part.y,
        part.width,
        part.height,
        Math.min(part.rx ?? 0, part.ry ?? part.rx ?? 0),
      );
    case 'ellipse':
      return outlineOfEllipse(part.cx, part.cy, part.rx, part.ry);
    case 'circle':
      return outlineOfEllipse(part.cx, part.cy, part.r, part.r);
    case 'polygon':
      return outlineOfPolygon(
        part.points
          .trim()
          .split(/\s+/)
          .map((pt) => {
            const [x, y] = pt.split(',').map(Number) as [number, number];
            return { x, y };
          }),
      );
    case 'path':
      return outlineOfPath(part.d);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------------------------

type Subpath = { segments: SketchSegment[]; points: Pt[]; closed: boolean };

const PATH_ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 };
const loggedCommands = new Set<string>();

function sampleCount(approxLength: number): number {
  return clamp(Math.ceil(approxLength / SKETCH_CURVE_STEP_PX), 4, 32);
}

function sampleQuad(p0: Pt, c: Pt, p1: Pt): Pt[] {
  const n = sampleCount(dist(p0, c) + dist(c, p1));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    });
  }
  return out;
}

function sampleCubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt): Pt[] {
  const n = sampleCount(dist(p0, c1) + dist(c1, c2) + dist(c2, p1));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push({
      x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
      y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
    });
  }
  return out;
}

// Parses a path into subpaths of segments: straight commands stay lines, consecutive curved commands merge into
// one curve run so a cloud's bumps flow into each other. Supports M L H V Q C A Z, absolute and relative; the
// first other command stops the parse (logged once per letter) and the outline so far is used.
function parsePath(d: string): Subpath[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subpaths: Subpath[] = [];
  let current: Subpath | null = null;
  let curveRun: Pt[] | null = null;
  let pen: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let cmd = '';
  let relative = false;
  let args: number[] = [];

  const endCurveRun = () => {
    if (current && curveRun && curveRun.length > 1)
      current.segments.push({ kind: 'curve', points: curveRun, closed: false });
    curveRun = null;
  };
  const addLine = (to: Pt) => {
    endCurveRun();
    if (!current) return;
    if (dist(pen, to) > 0.01) current.segments.push({ kind: 'line', from: pen, to });
    current.points.push(to);
    pen = to;
  };
  const addCurve = (pts: Pt[]) => {
    if (!current) return;
    if (!curveRun) curveRun = [pen];
    curveRun.push(...pts);
    current.points.push(...pts);
    pen = pts[pts.length - 1]!;
  };
  const at = (x: number, y: number): Pt => (relative ? { x: pen.x + x, y: pen.y + y } : { x, y });

  const run = () => {
    const a = args;
    switch (cmd) {
      case 'M': {
        endCurveRun();
        pen = at(a[0]!, a[1]!);
        start = pen;
        current = { segments: [], points: [pen], closed: false };
        subpaths.push(current);
        // Further pairs after a move are lines.
        cmd = 'L';
        return;
      }
      case 'L':
        return addLine(at(a[0]!, a[1]!));
      case 'H':
        return addLine({ x: relative ? pen.x + a[0]! : a[0]!, y: pen.y });
      case 'V':
        return addLine({ x: pen.x, y: relative ? pen.y + a[0]! : a[0]! });
      case 'Q':
        return addCurve(sampleQuad(pen, at(a[0]!, a[1]!), at(a[2]!, a[3]!)));
      case 'C':
        return addCurve(sampleCubic(pen, at(a[0]!, a[1]!), at(a[2]!, a[3]!), at(a[4]!, a[5]!)));
      case 'A':
        return addCurve(
          arcPoints(
            pen,
            a[0]!,
            a[1]!,
            a[2]!,
            a[3] !== 0,
            a[4] !== 0,
            at(a[5]!, a[6]!),
            sampleCount,
          ),
        );
    }
  };

  for (const t of tokens) {
    if (/[a-zA-Z]/.test(t)) {
      const upper = t.toUpperCase();
      if (!(upper in PATH_ARGS)) {
        if (!loggedCommands.has(upper)) {
          loggedCommands.add(upper);
          console.debug('[sketch] unsupported path command', upper);
        }
        break;
      }
      cmd = upper;
      relative = t !== upper;
      args = [];
      if (cmd === 'Z') {
        addLine(start);
        endCurveRun();
        // `current` is assigned inside `run`, which the checker cannot see from here.
        const open = current as Subpath | null;
        if (open) open.closed = true;
        pen = start;
      }
      continue;
    }
    if (!cmd || cmd === 'Z') continue;
    args.push(Number(t));
    if (args.length === PATH_ARGS[cmd]) {
      run();
      args = [];
    }
  }
  endCurveRun();
  return subpaths;
}

/** Any SVG path the canvas draws (a shape-table silhouette, an arrow's line). The area is the first closed
 *  subpath, enough for every silhouette in the table. */
export function outlineOfPath(d: string): SketchOutline {
  const subpaths = parsePath(d);
  const closed = subpaths.find((s) => s.closed && s.points.length >= 3);
  return { segments: subpaths.flatMap((s) => s.segments), area: closed ? closed.points : null };
}

/** Where a path starts and ends and which way it points there (outward: the way an arrowhead faces). */
export function pathEndTangents(
  d: string,
): { start: { at: Pt; dir: Pt }; end: { at: Pt; dir: Pt } } | null {
  const pts = parsePath(d).flatMap((s) => s.points);
  if (pts.length < 2) return null;
  const away = (from: Pt, others: Pt[]): Pt | null => {
    for (const p of others) {
      const l = dist(from, p);
      if (l > 0.5) return { x: (from.x - p.x) / l, y: (from.y - p.y) / l };
    }
    return null;
  };
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const startDir = away(first, pts.slice(1));
  const endDir = away(last, pts.slice(0, -1).reverse());
  if (!startDir || !endDir) return null;
  return { start: { at: first, dir: startDir }, end: { at: last, dir: endDir } };
}

// ---------------------------------------------------------------------------------------------------------------
// Strokes
// ---------------------------------------------------------------------------------------------------------------

const spread = (rng: () => number, amount: number) => (rng() * 2 - 1) * amount;

// One hand-drawn straight stroke: ends nudged, run a little past, the middle bowed. `scale` softens it for the
// short strokes of hatching and arrowheads.
function roughLine(a: Pt, b: Pt, rng: () => number, scale = 1): string {
  const len = dist(a, b);
  if (len < 0.5) return `M ${fmt(a)} L ${fmt(b)}`;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const j = Math.min(SKETCH_JITTER_PX, len * 0.05) * scale;
  const reach = SKETCH_OVERSHOOT_PX * Math.min(1, len / 40) * scale;
  const o1 = rng() * reach;
  const o2 = rng() * reach;
  const s = { x: a.x - ux * o1 + spread(rng, j), y: a.y - uy * o1 + spread(rng, j) };
  const e = { x: b.x + ux * o2 + spread(rng, j), y: b.y + uy * o2 + spread(rng, j) };
  const bow = spread(rng, Math.min(len * SKETCH_BOW_SHARE, SKETCH_BOW_MAX_PX)) * scale;
  // The quadratic's control point that puts the curve's middle `bow` px off the chord.
  const c = { x: (s.x + e.x) / 2 - uy * bow * 2, y: (s.y + e.y) / 2 + ux * bow * 2 };
  return `M ${fmt(s)} Q ${fmt(c)} ${fmt(e)}`;
}

// One hand-drawn curve: every sample nudged, drawn as a Catmull-Rom spline. A closed curve starts somewhere
// along itself and runs one sample past its start, so its ends overlap like a pen lifted late.
function roughCurve(points: readonly Pt[], closed: boolean, rng: () => number): string {
  if (points.length < 2) return '';
  let pts = [...points];
  if (closed) {
    const k = Math.floor(rng() * pts.length);
    pts = [...pts.slice(k), ...pts.slice(0, k)];
    pts.push(pts[0]!, pts[1]!);
  }
  // The wander is low-frequency: random offsets every CURVE_KNOT_EVERY samples, eased between, so a curve
  // drifts like a hand rather than buzzing sample to sample.
  const knots = Array.from({ length: Math.ceil(pts.length / CURVE_KNOT_EVERY) + 1 }, () => ({
    x: spread(rng, SKETCH_CURVE_JITTER_PX),
    y: spread(rng, SKETCH_CURVE_JITTER_PX),
  }));
  const moved = pts.map((p, i) => {
    const k = Math.floor(i / CURVE_KNOT_EVERY);
    const t = (i % CURVE_KNOT_EVERY) / CURVE_KNOT_EVERY;
    const a = knots[k]!;
    const b = knots[k + 1]!;
    return { x: p.x + a.x + (b.x - a.x) * t, y: p.y + a.y + (b.y - a.y) * t };
  });
  const parts = [`M ${fmt(moved[0]!)}`];
  for (let i = 0; i < moved.length - 1; i++) {
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

/** The outline as hand-drawn strokes: one path `d`, `passes` strokes over each segment. */
export function sketchStrokes(outline: SketchOutline, seed: number, passes: 1 | 2 = 2): string {
  const out: string[] = [];
  for (let pass = 0; pass < passes; pass++) {
    const rng = sketchRandom(seed + pass * 7919);
    for (const seg of outline.segments) {
      const d =
        seg.kind === 'line'
          ? roughLine(seg.from, seg.to, rng)
          : roughCurve(seg.points, seg.closed, rng);
      if (d) out.push(d);
    }
  }
  return out.join(' ');
}

/** A closed area as a plain filled path (the solid fill under a sketched outline). */
export function sketchAreaPath(area: readonly Pt[]): string {
  if (area.length < 3) return '';
  return `M ${area.map(fmt).join(' L ')} Z`;
}

/** The hatching gap for a border width: rough.js's four strokes apart, kept between 6 and 12 px. */
export function sketchHatchGap(strokePx: number): number {
  return clamp(4 * strokePx, HATCH_GAP_MIN_PX, HATCH_GAP_MAX_PX);
}

/** Pencil hatching across a closed area: parallel strokes at SKETCH_HATCH_ANGLE_DEG, each one a softened
 *  hand-drawn line, at most SKETCH_HATCH_MAX_LINES of them. */
export function sketchHatching(area: readonly Pt[], seed: number, strokePx: number): string {
  if (area.length < 3) return '';
  const rng = sketchRandom(seed ^ 0x9e3779b9);
  // Turn the area so the hatch lines run horizontally, scan it, and turn each piece back.
  const angle = (SKETCH_HATCH_ANGLE_DEG * Math.PI) / 180;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const turned = area.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of turned) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const extent = maxY - minY;
  if (!(extent > 0)) return '';
  const gap = Math.max(sketchHatchGap(strokePx), extent / SKETCH_HATCH_MAX_LINES);
  const back = (x: number, y: number): Pt => ({ x: x * cos + y * sin, y: -x * sin + y * cos });
  const out: string[] = [];
  const xs: number[] = [];
  for (let y = minY + gap / 2; y < maxY; y += gap) {
    xs.length = 0;
    for (let i = 0; i < turned.length; i++) {
      const a = turned[i]!;
      const b = turned[(i + 1) % turned.length]!;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
        xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      // Pulled in a pixel at each end so the overshoot stays about on the outline.
      const x0 = xs[i]! + 1;
      const x1 = xs[i + 1]! - 1;
      if (x1 - x0 < 1) continue;
      out.push(roughLine(back(x0, y), back(x1, y), rng, 0.5));
    }
  }
  return out.join(' ');
}

/** A sketched arrowhead: two loose strokes meeting at `tip`, `lengthPx` long, opening back against `dir`
 *  (the way the head faces). */
export function sketchArrowHead(tip: Pt, dir: Pt, lengthPx: number, seed: number): string {
  const rng = sketchRandom(seed ^ 0x51ed27);
  const bx = tip.x - dir.x * lengthPx;
  const by = tip.y - dir.y * lengthPx;
  const half = lengthPx / 2;
  const w1 = { x: bx - dir.y * half, y: by + dir.x * half };
  const w2 = { x: bx + dir.y * half, y: by - dir.x * half };
  return `${roughLine(w1, tip, rng, 0.6)} ${roughLine(w2, tip, rng, 0.6)}`;
}
