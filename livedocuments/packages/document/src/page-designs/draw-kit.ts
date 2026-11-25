// What every page design draws with (docs/specs/011-theme/blueprints/page-designs.md "Drawing"): the context a
// drawer is handed, its layers, a seeded random source and small SVG helpers. Every number is rounded to two places
// and every colour is a hex the palette made, so the markup is ours alone (builder markup). Pure.
import type { DesignTuning } from './tuning';

/** The colours a design draws in, worked out for its page. */
export type DesignPalette = {
  a: string;
  b: string;
  c: string;
  // Lines and textures: near white on a dark page, near black on a light one.
  ink: string;
  // The page's own tone under the design.
  base: string;
  dark: boolean;
};

/** How a layer moves on screen (never in an export): every motion starts from rest, its still frame. */
export type LayerMotion = {
  kind: 'drift' | 'pan' | 'spin' | 'breathe' | 'twinkle' | 'swing';
  // One loop, at speed 1.
  seconds: number;
  // How far a drift or pan goes, in px; a breathe's scale; a spin's or swing's turn in degrees.
  x?: number;
  y?: number;
  scale?: number;
  turn?: number;
  // Where a spin, swing or breathe turns about, in page px.
  origin?: [number, number];
};

/** A solid part a design paints at near full strength (a photo's frame, a tile), as a box in page px round it: the
 *  contrast guard weighs its colours at its own opacity wherever a text overlaps it, rather than at the design's
 *  average busyness (spec "Readability"). */
export type DesignPlate = {
  x: number;
  y: number;
  w: number;
  h: number;
  colours: readonly string[];
  opacity: number;
};

/** One drawing layer: SVG markup in page px (0 to the page's width and height; a panning layer reaches further). */
export type DesignLayer = {
  svg: string;
  motion?: LayerMotion;
  defs?: string;
  plates?: readonly DesignPlate[];
};

export type DrawCtx = {
  w: number;
  h: number;
  p: DesignPalette;
  t: DesignTuning;
  // A seeded random number in [0, 1).
  rnd: () => number;
  // Prefixes every id the drawing defines.
  uid: string;
  // The page's place in a flowing strip: its left edge's offset and the strip's whole width (0 and w alone).
  ox: number;
  span: number;
  // The tab's font, as a CSS font stack.
  font: string;
};

export type Drawer = (c: DrawCtx) => DesignLayer[];

/** A seeded generator (mulberry32): the same numbers for the same seed on every machine. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number for markup: two places at most. */
export function n(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/** A value between `lo` and `hi`. */
export const between = (rnd: () => number, lo: number, hi: number) => lo + (hi - lo) * rnd();

/** One of `list`. */
export const pick = <T>(rnd: () => number, list: readonly T[]): T =>
  list[Math.floor(rnd() * list.length) % list.length]!;

/** The palette's three colours, for cycling through. */
export const trio = (c: DrawCtx): [string, string, string] => [c.p.a, c.p.b, c.p.c];

/** A radial gradient fading `colour` from `opacity` at its centre to nothing at its edge; `soft` 0 to 1 holds the
 *  colour further out before it fades (0 a hard-edged disc's fade, 1 a glow). */
export function glowDef(id: string, colour: string, opacity: number, soft: number): string {
  const hold = Math.max(0, Math.min(0.85, 0.85 - soft * 0.85));
  return (
    `<radialGradient id="${id}">` +
    `<stop offset="0" stop-color="${colour}" stop-opacity="${n(opacity)}"/>` +
    `<stop offset="${n(hold)}" stop-color="${colour}" stop-opacity="${n(opacity * (hold > 0 ? 0.9 : 1))}"/>` +
    `<stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient>`
  );
}

/** A linear gradient from `from` to `to` along an angle (CSS degrees), across its shape's box. */
export function linearDef(
  id: string,
  stops: readonly [offset: number, colour: string, opacity: number][],
  angle = 180,
): string {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2;
  const dy = -Math.cos(a) / 2;
  return (
    `<linearGradient id="${id}" x1="${n(0.5 - dx)}" y1="${n(0.5 - dy)}" x2="${n(0.5 + dx)}" y2="${n(0.5 + dy)}">` +
    stops
      .map(([o, col, op]) => `<stop offset="${n(o)}" stop-color="${col}" stop-opacity="${n(op)}"/>`)
      .join('') +
    `</linearGradient>`
  );
}

/** A smooth closed path through points (Catmull-Rom turned to cubic Béziers). */
export function smoothClosed(pts: readonly [number, number][]): string {
  const k = pts.length;
  let d = `M${n(pts[0]![0])} ${n(pts[0]![1])}`;
  for (let i = 0; i < k; i += 1) {
    const p0 = pts[(i - 1 + k) % k]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % k]!;
    const p3 = pts[(i + 2) % k]!;
    d +=
      `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}Z`;
}

/** A smooth open path through points. */
export function smoothOpen(pts: readonly [number, number][]): string {
  let d = `M${n(pts[0]![0])} ${n(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    d +=
      `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

/** A blob around (cx, cy) of radius r, its edge wobbling by `wobble` (0 to 1). */
export function blobPath(
  rnd: () => number,
  cx: number,
  cy: number,
  r: number,
  wobble = 0.35,
  points = 7,
): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + wobble * rnd());
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smoothClosed(pts);
}

/** Whole-page rect markup. */
export const pageRect = (c: Pick<DrawCtx, 'w' | 'h'>, attrs: string) =>
  `<rect width="${n(c.w)}" height="${n(c.h)}" ${attrs}/>`;

/** The page's shorter and longer sides. */
export const sides = (c: Pick<DrawCtx, 'w' | 'h'>) => ({
  min: Math.min(c.w, c.h),
  max: Math.max(c.w, c.h),
});

/** A unit the page is drawn in: its shorter side's hundredth, times the scale. */
export const unit = (c: DrawCtx) => (Math.min(c.w, c.h) / 100) * c.t.scale;

/** A fine grain over a rect: fractal noise in `colour` at `opacity` (an SVG filter; static layers only). */
export function grainSvg(
  id: string,
  w: number,
  h: number,
  colour: string,
  opacity: number,
  seed: number,
  frequency = 0.85,
): string {
  const rgb = hexChannels(colour);
  return (
    `<defs><filter id="${id}" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${n(frequency)}" numOctaves="2" seed="${seed % 1000}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 ${n(rgb[0])} 0 0 0 0 ${n(rgb[1])} 0 0 0 0 ${n(rgb[2])} 0 0 0 ${n(opacity * 1.6)} ${n(-opacity * 0.45)}"/>` +
    `</filter></defs><rect width="${n(w)}" height="${n(h)}" filter="url(#${id})"/>`
  );
}

/** A hex's channels as fractions. */
export function hexChannels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}
