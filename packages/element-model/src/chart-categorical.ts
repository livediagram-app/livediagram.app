// A chart's categorical colours (docs/specs/009-elements/pie-chart.md "Chart palettes", "How a chart is drawn"): the
// theme's own hues first, each stepped into the band a chart mark reads in, then a validated set of distinct hues, each
// kept only where it stands plainly apart from its neighbour for every reader. Before this a single-accent theme gave
// tints and shades of one blue (Brand's neighbours a ΔE of about 5 apart, three of them reading grey), so a pie's
// wedges could not be told apart. Pure; computed, never stored.
//
// The gates are the data-viz method's (the `dataviz` skill's validator, checks 2 to 4b): OKLCH lightness inside the
// mode's band, chroma over the floor where a hue reads grey, neighbours at least 8 apart under simulated protan and
// deutan vision (OKLab ΔE ×100, Machado 2009 at full severity) and at least 15 apart under normal vision. Every theme's
// palette is held to them by chart-categorical.test.ts.

import { hexToRgb, normaliseHex, rgbToHex } from './colour-math';

export type ChartMode = 'light' | 'dark';

// OKLCH lightness a mark reads in, per surface.
export const CHART_BAND: Record<ChartMode, readonly [number, number]> = {
  light: [0.43, 0.78],
  dark: [0.48, 0.7],
};
export const CHART_CHROMA_FLOOR = 0.1;
export const CHART_CVD_TARGET = 8;
export const CHART_NORMAL_FLOOR = 15;
// Any two colours of a palette, neighbours or not, stand at least this far apart under normal vision, so a pie never
// carries near twins (a sky and a blue). A light page's wide band affords a clear gap; a dark page's narrow one
// (lightness 0.48 to 0.70) would leave four colours at that gap, so it keeps the reference palette's own closest
// non-neighbours' (yellow and orange, about 10).
export const CHART_TWIN_FLOOR: Record<ChartMode, number> = { light: 14, dark: 9 };

// The reference categorical hues (the dataviz skill's palette.md), in the order that clears every neighbour gate,
// stepped for each surface: blue, orange, aqua, yellow, magenta, green, violet, red.
const BASE: Record<ChartMode, readonly string[]> = {
  light: ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'],
  dark: ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'],
};

// At most this many colours: past eight a key is unreadable and a chart wants another form.
const MAX_COLOURS = 8;

type Vec = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linear(hex: string): Vec | null {
  const rgb = hexToRgb(hex);
  return rgb ? [toLinear(rgb.r / 255), toLinear(rgb.g / 255), toLinear(rgb.b / 255)] : null;
}

function oklabOf([r, g, b]: Vec): Vec {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function linearOfOklab([L, a, b]: Vec): Vec {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// Machado, Oliveira and Fernandes (2009) at severity 1.0, on linear RGB.
const CVD: Record<'protan' | 'deutan', readonly Vec[]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function simulate(v: Vec, kind: 'protan' | 'deutan'): Vec {
  const M = CVD[kind];
  return M.map((row) => clamp01(row[0] * v[0] + row[1] * v[1] + row[2] * v[2])) as Vec;
}

const distance = (a: Vec, b: Vec) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Two colours' OKLab ΔE ×100 under normal vision, or the least of protan's and deutan's with `cvd`. */
export function chartDeltaE(a: string, b: string, cvd = false): number {
  const la = linear(a);
  const lb = linear(b);
  if (!la || !lb) return 0;
  if (!cvd) return distance(oklabOf(la), oklabOf(lb));
  return Math.min(
    distance(oklabOf(simulate(la, 'protan')), oklabOf(simulate(lb, 'protan'))),
    distance(oklabOf(simulate(la, 'deutan')), oklabOf(simulate(lb, 'deutan'))),
  );
}

/** A colour's OKLCH lightness and chroma. */
export function chartLightChroma(hex: string): [number, number] {
  const v = linear(hex);
  if (!v) return [0, 0];
  const [L, a, b] = oklabOf(v);
  return [L, Math.hypot(a, b)];
}

// A hue stepped into the mode's band, a touch inside its edges, keeping its hue; its chroma eased only as far as sRGB
// needs. Null for a grey (no hue to keep) or a hue that cannot keep the floor in gamut at that lightness.
function intoBand(hex: string, mode: ChartMode): string | null {
  const v = linear(hex);
  if (!v) return null;
  const [L, a, b] = oklabOf(v);
  const C = Math.hypot(a, b);
  if (C < CHART_CHROMA_FLOOR) return null;
  const [lo, hi] = CHART_BAND[mode];
  const target = Math.min(hi - 0.03, Math.max(lo + 0.03, L));
  if (target === L) return normaliseHex(hex);
  const h = Math.atan2(b, a);
  for (let c = C; c >= CHART_CHROMA_FLOOR + 0.005; c -= 0.005) {
    const rgb = linearOfOklab([target, c * Math.cos(h), c * Math.sin(h)]);
    if (rgb.every((x) => x >= -1e-4 && x <= 1 + 1e-4)) {
      const [r, g, bl] = rgb.map((x) => Math.round(clamp01(toGamma(clamp01(x))) * 255));
      return rgbToHex({ r: r!, g: g!, b: bl! });
    }
  }
  return null;
}

const fitsAfter = (next: string, prev: string) =>
  chartDeltaE(next, prev, true) >= CHART_CVD_TARGET &&
  chartDeltaE(next, prev) >= CHART_NORMAL_FLOOR;

// How many orderings the search may try before it settles for the longest it has found: a pool of a dozen hues finds
// eight in a few hundred steps; the cap only bounds a pathological pool.
const SEARCH_STEPS = 3000;

const memory = new Map<string, string[]>();

/**
 * The categorical colours for `seeds` (the theme's hues, its lead first) on a `mode` surface: each seed stepped into
 * the band, then the reference hues. The lead is always first, so a one-series chart wears the theme's own colour;
 * after it, the longest run (up to eight) the pool allows where each colour clears the gates against the one before it
 * and is no near twin (normal ΔE 9) of any one before, earlier pool hues preferred. Remembered per input, as
 * every chart on a page asks for the same theme's.
 */
export function chartCategorical(seeds: readonly string[], mode: ChartMode): string[] {
  const key = `${mode}|${seeds.join(',')}`;
  const hit = memory.get(key);
  if (hit) return [...hit];
  const pool: string[] = [];
  for (const seed of seeds) {
    const c = intoBand(seed, mode);
    if (c && !pool.includes(c)) pool.push(c);
  }
  for (const c of BASE[mode]) if (!pool.includes(c)) pool.push(c);
  const lead = pool.shift()!;
  let best: string[] = [lead];
  let steps = 0;
  const walk = (run: string[], left: string[]): boolean => {
    if (run.length > best.length) best = [...run];
    if (run.length >= MAX_COLOURS) return true;
    const prev = run[run.length - 1]!;
    for (let i = 0; i < left.length; i++) {
      if (++steps > SEARCH_STEPS) return true;
      const c = left[i]!;
      if (!fitsAfter(c, prev) || !run.every((o) => chartDeltaE(c, o) >= CHART_TWIN_FLOOR[mode]))
        continue;
      if (walk([...run, c], [...left.slice(0, i), ...left.slice(i + 1)])) return true;
    }
    return false;
  };
  walk([lead], pool);
  if (memory.size > 256) memory.clear();
  memory.set(key, best);
  return [...best];
}

/** The gates a palette fails, by name; empty when it passes (the dataviz validator's hard checks). */
export function chartPaletteFailures(palette: readonly string[], mode: ChartMode): string[] {
  const [lo, hi] = CHART_BAND[mode];
  const out: string[] = [];
  palette.forEach((c, i) => {
    const [L, C] = chartLightChroma(c);
    if (L < lo || L > hi) out.push(`band ${c}`);
    if (C < CHART_CHROMA_FLOOR) out.push(`chroma ${c}`);
    const next = palette[i + 1];
    if (next !== undefined) {
      if (chartDeltaE(c, next, true) < 6) out.push(`cvd ${c}/${next}`);
      if (chartDeltaE(c, next) < CHART_NORMAL_FLOOR) out.push(`normal ${c}/${next}`);
    }
  });
  return out;
}
