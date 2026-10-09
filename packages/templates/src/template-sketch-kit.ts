// The hand-drawn kit the Draw templates are made with (docs/specs/007-editor/templates-by-mode.md
// "Draw templates"): marker strokes laid down the way the whiteboard pen lays them down
// (docs/specs/023-draw-mode/draw-mode.md "Pens"), plus the notes, text and stickers a person adds
// in Draw mode.
//
// Every mark starts as clean geometry (a line, a box, an ellipse, a cloud) and is then resampled
// and given a slow, smooth wobble along its length, so the board reads as drawn, not ruled. The
// wobble is DETERMINISTIC: it is a sum of sines of the distance along the stroke, phased by a
// seed, and never reads the absolute position, so a template built at any centre is the same
// drawing moved (the builders' translation-invariance test) and every build is identical.
//
// Strokes are pen strokes (a `penWidth`, a streamline and a pressure per point, which tapers the
// ends like a marker), coloured by stock NAME (`penColour`) or left as Ink, so each is drawn in
// its version for the board it is shown on, light or dark. Pure.

import {
  createFreehand,
  createShape,
  createSticky,
  createText,
  type Element,
  type FreehandElement,
  type PenColourName,
  type ShapeElement,
  type StickyElement,
  type TextElement,
  pointDistance,
} from '@livediagram/document';

export type Pt = { x: number; y: number };

// The marker widths (the dock's Medium and Bold, WHITEBOARD_PEN_WIDTHS) and a Fine detail line.
export const FINE = 1.5;
export const BOLD = 2.5;
// The whiteboard pen's streamline for a stylus (PEN_STREAMLINE.pen): light smoothing, so corners
// stay corners.
const STREAMLINE = 0.2;
// Resample spacing along a stroke, in canvas px: dense enough that the outline is smooth.
const STEP = 5;
// The hand font a sketch is lettered in.
export const HAND = 'caveat';

// --- Deterministic wobble ------------------------------------------------------------------------

// A repeatable number in [-1, 1] for (seed, i): the classic fract(sin) hash.
export function noise(seed: number, i: number): number {
  const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

// A smooth wave in about [-1, 1] at distance `s` (canvas px) along a stroke: two slow sines and a
// faster one, their wavelengths and phases set by the seed, the way a hand drifts off a line.
function wave(seed: number, s: number): number {
  const l1 = 150 + 60 * noise(seed, 1);
  const l2 = 55 + 20 * noise(seed, 2);
  const l3 = 23 + 6 * noise(seed, 3);
  return (
    0.55 * Math.sin((s / l1) * 2 * Math.PI + 3 * noise(seed, 4)) +
    0.3 * Math.sin((s / l2) * 2 * Math.PI + 3 * noise(seed, 5)) +
    0.15 * Math.sin((s / l3) * 2 * Math.PI + 3 * noise(seed, 6))
  );
}

// The polyline resampled every STEP px (its corners kept), each point tagged with its distance
// along the line.
function resample(points: readonly Pt[]): (Pt & { s: number })[] {
  if (points.length === 0) return [];
  const out: (Pt & { s: number })[] = [{ ...points[0]!, s: 0 }];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = pointDistance(a, b);
    const n = Math.max(1, Math.round(len / STEP));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: s + len * t });
    }
    s += len;
  }
  return out;
}

// The polyline resampled and wobbled by up to `amp` px on each axis.
export function wobble(points: readonly Pt[], seed: number, amp = 2): Pt[] {
  return resample(points).map((p) => ({
    x: p.x + amp * wave(seed, p.s),
    y: p.y + amp * wave(seed + 17, p.s),
  }));
}

// --- Strokes -------------------------------------------------------------------------------------

export type Pen = { colour?: PenColourName; width?: number; amp?: number };

// One marker stroke through `points` (already shaped), tapering at both ends.
export function inkStroke(points: readonly Pt[], pen: Pen = {}): FreehandElement {
  const n = points.length;
  const pressures = points.map((_, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5;
    return 0.38 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.6, (1 - t) * 3));
  });
  return {
    ...createFreehand(points, false, pressures),
    penWidth: pen.width ?? BOLD,
    streamline: STREAMLINE,
    ...(pen.colour ? { penColour: pen.colour } : {}),
  };
}

// A clean polyline drawn by hand: wobbled, then inked.
export function drawn(points: readonly Pt[], seed: number, pen: Pen = {}): FreehandElement {
  return inkStroke(wobble(points, seed, pen.amp ?? 1.6), pen);
}

// --- Geometry (clean, before the wobble) ---------------------------------------------------------

// A straight line that bows slightly, as a ruler-free hand does.
export function bowLine(a: Pt, b: Pt, bow = 0): Pt[] {
  const n = 8;
  const len = pointDistance(a, b) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const o = bow * Math.sin(Math.PI * t);
    return { x: a.x + (b.x - a.x) * t + nx * o, y: a.y + (b.y - a.y) * t + ny * o };
  });
}

// A box drawn in one go: round the four sides from the top-left, overshooting the start a little
// where the pen comes home.
export function boxPath(x: number, y: number, w: number, h: number, seed = 0): Pt[] {
  const o = 3 + 2 * noise(seed, 9);
  return [
    { x: x + 2, y: y - 1 },
    { x: x + w, y },
    { x: x + w + 1, y: y + h },
    { x, y: y + h + 1 },
    { x: x - 1, y: y - o },
    { x: x + 10 + o, y: y + 2 },
  ];
}

// A rounded box (a speech bubble's body), clockwise from the top-left corner's end, with an
// optional tail on its bottom edge reaching to `tail`.
export function bubblePath(
  x: number,
  y: number,
  w: number,
  h: number,
  tail?: Pt,
  r = Math.min(18, h / 2.5),
): Pt[] {
  const arc = (cx: number, cy: number, from: number): Pt[] =>
    [0, 1, 2, 3].map((k) => {
      const a = from + (k / 3) * (Math.PI / 2);
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
  const pts: Pt[] = [...arc(x + w - r, y + r, -Math.PI / 2), ...arc(x + w - r, y + h - r, 0)];
  if (tail) {
    const base = Math.max(
      x + r + 14,
      Math.min(x + w - r - 14, tail.x + (tail.x < x + w / 2 ? 30 : -30)),
    );
    pts.push({ x: base + 16, y: y + h }, tail, { x: base - 14, y: y + h });
  }
  pts.push(...arc(x + r, y + h - r, Math.PI / 2), ...arc(x + r, y + r, Math.PI));
  pts.push({ x: x + r + 8, y: y - 1.5 }, { x: x + w - r + 4, y: y - 0.5 });
  return pts;
}

// An ellipse drawn as a loop that runs on past its start, spiralling out a touch.
export function ellipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed = 0,
  turns = 1.1,
): Pt[] {
  const start = -Math.PI * (0.6 + 0.2 * noise(seed, 7));
  const n = Math.max(16, Math.round((2 * Math.PI * Math.max(rx, ry) * turns) / 6));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = start + t * turns * 2 * Math.PI;
    const grow = 1 + 0.06 * t;
    return { x: cx + rx * grow * Math.cos(a), y: cy + ry * grow * Math.sin(a) };
  });
}

// A cloud: scallops bulging out round an ellipse, closed back at its first bump.
export function cloudPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  bumps = 9,
  seed = 0,
): Pt[] {
  const on = (k: number): Pt => {
    const a = -Math.PI / 2 + (k / bumps) * 2 * Math.PI + 0.06 * noise(seed, k);
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  };
  const pts: Pt[] = [];
  for (let k = 0; k < bumps; k++) {
    const a = on(k);
    const b = on(k + 1);
    const half = pointDistance(a, b) / 2;
    const ux = (b.x - a.x) / (2 * half);
    const uy = (b.y - a.y) / (2 * half);
    // Outward: away from the cloud's centre.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const ml = Math.hypot(mx - cx, my - cy) || 1;
    const nx = (mx - cx) / ml;
    const ny = (my - cy) / ml;
    const bulge = half * (0.6 + 0.12 * noise(seed, k + 40));
    for (let j = 0; j <= 8; j++) {
      const f = (j / 8) * Math.PI;
      pts.push({
        x: mx - Math.cos(f) * half * ux + Math.sin(f) * bulge * nx,
        y: my - Math.cos(f) * half * uy + Math.sin(f) * bulge * ny,
      });
    }
  }
  pts.push(pts[2]!);
  return pts;
}

// A ribbon banner's body and its two folded tails, as three strokes.
export function bannerPaths(x: number, y: number, w: number, h: number): Pt[][] {
  const t = 34;
  const drop = 14;
  return [
    boxPath(x, y, w, h, 3),
    [
      { x: x + 4, y: y + drop + h - 6 },
      { x: x - t, y: y + drop + h },
      { x: x - t + 16, y: y + drop + h / 2 },
      { x: x - t, y: y + drop },
      { x, y: y + drop },
    ],
    [
      { x: x + w - 4, y: y + drop + h - 6 },
      { x: x + w + t, y: y + drop + h },
      { x: x + w + t - 16, y: y + drop + h / 2 },
      { x: x + w + t, y: y + drop },
      { x: x + w, y: y + drop },
    ],
  ];
}

// An arrow: a gently bent shaft from `a` to `b` and its open head, as two strokes.
export function arrowPaths(a: Pt, b: Pt, bend = 0.15, head = 16): Pt[][] {
  const len = pointDistance(a, b) || 1;
  const mx = (a.x + b.x) / 2 - ((b.y - a.y) / len) * len * bend;
  const my = (a.y + b.y) / 2 + ((b.x - a.x) / len) * len * bend;
  const shaft = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    return {
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y,
    };
  });
  const ang = Math.atan2(b.y - my, b.x - mx);
  const wing = (s: number): Pt => ({
    x: b.x - head * Math.cos(ang + s * 0.5),
    y: b.y - head * Math.sin(ang + s * 0.5),
  });
  return [shaft, [wing(1), b, wing(-1)]];
}

// A five-pointed star centred on (cx, cy), drawn in one line.
export function starPath(cx: number, cy: number, r: number): Pt[] {
  return Array.from({ length: 12 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) };
  });
}

// A tick, its short stroke then its long one.
export function tickPath(x: number, y: number, s = 16): Pt[] {
  return [
    { x, y: y + s * 0.5 },
    { x: x + s * 0.35, y: y + s * 0.9 },
    { x: x + s, y: y - s * 0.1 },
  ];
}

// A wavy underline, `waves` humps long.
export function wavyPath(x: number, y: number, w: number, waves = 5, amp = 3): Pt[] {
  const n = waves * 6;
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: x + (i / n) * w,
    y: y + amp * Math.sin((i / n) * waves * 2 * Math.PI),
  }));
}

// --- Strokes for whole marks ----------------------------------------------------------------------

export const many = (paths: Pt[][], seed: number, pen: Pen = {}): FreehandElement[] =>
  paths.map((p, i) => drawn(p, seed + i * 7, pen));

// --- Notes, text and stickers --------------------------------------------------------------------

type TextOpts = Partial<TextElement> & { colour?: PenColourName };

// Hand lettering in a fixed box, in Caveat, Ink unless given a stock colour by name.
export function letter(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  opts: TextOpts = {},
): TextElement {
  const { colour, ...rest } = opts;
  return {
    ...createText(x, y),
    width: w,
    height: h,
    label,
    font: HAND,
    textSize: 'md',
    textAlignX: 'left',
    ...(colour ? { penTextColour: colour } : {}),
    ...rest,
  };
}

// The sticky note colours a sketch uses: the fill and the text that reads on it (a note's fill
// does not adapt to the board, so its text keeps an exact colour).
export const NOTE = {
  yellow: { fillColor: '#fde68a', textColor: '#451a03' },
  pink: { fillColor: '#fecdd3', textColor: '#4c0519' },
  blue: { fillColor: '#bae6fd', textColor: '#082f49' },
  green: { fillColor: '#bbf7d0', textColor: '#052e16' },
} as const;

export function note(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  tone: keyof typeof NOTE = 'yellow',
  extra: Partial<StickyElement> = {},
): StickyElement {
  return {
    ...createSticky(x, y),
    width: w,
    height: h,
    label,
    font: HAND,
    textSize: 'md',
    ...NOTE[tone],
    ...extra,
  };
}

// A sticker, `size` square, by its catalogue id ('emoji-rocket').
export function sticker(
  id: string,
  x: number,
  y: number,
  size: number,
  rotation = 0,
): ShapeElement {
  return {
    ...createShape('sticker', x, y),
    width: size,
    height: size,
    stickerId: id,
    ...(rotation ? { rotation } : {}),
  };
}

// A speech bubble drawn round its words, its tail reaching to the speaker at `tail`.
export function says(
  x: number,
  y: number,
  w: number,
  h: number,
  tail: Pt,
  words: string,
  seed: number,
  pen: Pen = {},
  text: TextOpts = {},
): Element[] {
  return [
    drawn(bubblePath(x, y, w, h, tail), seed, { width: 2, ...pen, amp: pen.amp ?? 1 }),
    letter(x + 12, y + 6, w - 24, h - 12, words, { textAlignX: 'center', ...text }),
  ];
}
