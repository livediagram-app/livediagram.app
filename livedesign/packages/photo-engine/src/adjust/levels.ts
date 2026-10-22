// Levels and Curves (docs/specs/031-photo/photo-adjustments.md "The adjustments"), and the auto
// adjustments that fill them from a histogram. Each channel's own setting applies first, then the
// RGB one (docs/specs/031-photo/blueprints/DEFAULTS.md D11).
import { composeLuts, identityLut, type ChannelLut } from './lut';
import { isRec, num } from './params';

export type LevelsChannel = {
  inBlack: number;
  inWhite: number;
  gamma: number;
  outBlack: number;
  outWhite: number;
};
export type LevelsParams = Record<'rgb' | 'red' | 'green' | 'blue', LevelsChannel>;

export const LEVELS_IDENTITY: LevelsChannel = {
  inBlack: 0,
  inWhite: 255,
  gamma: 1,
  outBlack: 0,
  outWhite: 255,
};

const CHANNELS = ['rgb', 'red', 'green', 'blue'] as const;

function readLevelsChannel(v: unknown): LevelsChannel {
  const inBlack = num(v, 'inBlack', 0, 253, 0);
  const inWhite = Math.max(inBlack + 2, num(v, 'inWhite', 2, 255, 255));
  return {
    inBlack,
    inWhite,
    gamma: num(v, 'gamma', 0.1, 9.99, 1),
    outBlack: num(v, 'outBlack', 0, 255, 0),
    outWhite: num(v, 'outWhite', 0, 255, 255),
  };
}

export function readLevels(p: unknown): LevelsParams {
  const r = isRec(p) ? p : {};
  return {
    rgb: readLevelsChannel(r.rgb),
    red: readLevelsChannel(r.red),
    green: readLevelsChannel(r.green),
    blue: readLevelsChannel(r.blue),
  };
}

function levelsCurve(ch: LevelsChannel): (i: number) => number {
  return (i) => {
    const t = Math.min(1, Math.max(0, (i - ch.inBlack) / (ch.inWhite - ch.inBlack)));
    const g = t ** (1 / ch.gamma);
    return ch.outBlack + g * (ch.outWhite - ch.outBlack);
  };
}

function channelTable(
  curves: [(i: number) => number, (i: number) => number, (i: number) => number],
) {
  const lut = identityLut();
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 256; i++)
      lut[c * 256 + i] = Math.round(Math.min(255, Math.max(0, curves[c]!(i))));
  return lut;
}

export function levelsLut(p: LevelsParams): ChannelLut {
  const own = channelTable([levelsCurve(p.red), levelsCurve(p.green), levelsCurve(p.blue)]);
  const master = levelsCurve(p.rgb);
  return composeLuts(own, channelTable([master, master, master]));
}

export function isLevelsIdentity(p: LevelsParams): boolean {
  return CHANNELS.every((c) => {
    const ch = p[c];
    return (
      ch.inBlack === 0 &&
      ch.inWhite === 255 &&
      ch.gamma === 1 &&
      ch.outBlack === 0 &&
      ch.outWhite === 255
    );
  });
}

// Curves: per channel, 2 to 16 points joined by a monotone cubic (Fritsch-Carlson), flat past the
// first and last point.
export type CurvePoint = [number, number];
export type CurvesParams = Record<'rgb' | 'red' | 'green' | 'blue', CurvePoint[]>;
export const CURVE_IDENTITY: CurvePoint[] = [
  [0, 0],
  [255, 255],
];
const MAX_POINTS = 16;

function readCurve(v: unknown): CurvePoint[] {
  if (!Array.isArray(v)) return CURVE_IDENTITY;
  const pts: CurvePoint[] = [];
  for (const p of v.slice(0, MAX_POINTS)) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const [x, y] = p as unknown[];
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      continue;
    pts.push([Math.min(255, Math.max(0, x)), Math.min(255, Math.max(0, y))]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  // One point per input: the later wins.
  const uniq: CurvePoint[] = [];
  for (const p of pts) {
    if (uniq.length && uniq[uniq.length - 1]![0] === p[0]) uniq[uniq.length - 1] = p;
    else uniq.push(p);
  }
  return uniq.length >= 2 ? uniq : CURVE_IDENTITY;
}

export function readCurves(p: unknown): CurvesParams {
  const r = isRec(p) ? p : {};
  return {
    rgb: readCurve(r.rgb),
    red: readCurve(r.red),
    green: readCurve(r.green),
    blue: readCurve(r.blue),
  };
}

/** The monotone cubic through the points, sampled at 0..255. */
export function curveTable(points: readonly CurvePoint[]): Float64Array {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const out = new Float64Array(256);
  if (n === 2) {
    const [x0, x1] = xs as [number, number];
    const [y0, y1] = ys as [number, number];
    for (let i = 0; i < 256; i++) {
      const t = x1 === x0 ? 0 : Math.min(1, Math.max(0, (i - x0) / (x1 - x0)));
      out[i] = y0 + (y1 - y0) * t;
    }
    return out;
  }
  const d = new Float64Array(n - 1);
  for (let k = 0; k < n - 1; k++) d[k] = (ys[k + 1]! - ys[k]!) / (xs[k + 1]! - xs[k]!);
  const m = new Float64Array(n);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1]! * d[k]! <= 0 ? 0 : (d[k - 1]! + d[k]!) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k]! / d[k]!;
    const b = m[k + 1]! / d[k]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[k] = t * a * d[k]!;
      m[k + 1] = t * b * d[k]!;
    }
  }
  let seg = 0;
  for (let i = 0; i < 256; i++) {
    if (i <= xs[0]!) {
      out[i] = ys[0]!;
      continue;
    }
    if (i >= xs[n - 1]!) {
      out[i] = ys[n - 1]!;
      continue;
    }
    while (seg < n - 2 && i > xs[seg + 1]!) seg++;
    const h = xs[seg + 1]! - xs[seg]!;
    const t = (i - xs[seg]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    out[i] =
      (2 * t3 - 3 * t2 + 1) * ys[seg]! +
      (t3 - 2 * t2 + t) * h * m[seg]! +
      (-2 * t3 + 3 * t2) * ys[seg + 1]! +
      (t3 - t2) * h * m[seg + 1]!;
  }
  return out;
}

export function curvesLut(p: CurvesParams): ChannelLut {
  const t = (pts: CurvePoint[]) => {
    const tab = curveTable(pts);
    return (i: number) => tab[i]!;
  };
  const own = channelTable([t(p.red), t(p.green), t(p.blue)]);
  const master = t(p.rgb);
  return composeLuts(own, channelTable([master, master, master]));
}

const isIdentityCurve = (pts: CurvePoint[]) => pts.every(([x, y]) => x === y);

export function isCurvesIdentity(p: CurvesParams): boolean {
  return CHANNELS.every((c) => isIdentityCurve(p[c]));
}

// The auto adjustments (docs/specs/031-photo/photo-adjustments.md "Auto Tone"): from a histogram
// (256 counts a channel: red, green, blue, luma), clipping a share at each end.
export type Histogram = {
  red: Uint32Array;
  green: Uint32Array;
  blue: Uint32Array;
  luma: Uint32Array;
};

const AUTO_CLIP = 0.001;

function clipPoints(h: Uint32Array, clip = AUTO_CLIP): [number, number] {
  let total = 0;
  for (const v of h) total += v;
  if (total === 0) return [0, 255];
  const cut = total * clip;
  let lo = 0;
  let acc = 0;
  while (lo < 255 && acc + h[lo]! <= cut) acc += h[lo++]!;
  let hi = 255;
  acc = 0;
  while (hi > 0 && acc + h[hi]! <= cut) acc += h[hi--]!;
  if (hi - lo < 2) return [Math.max(0, Math.min(lo, 253)), Math.max(lo + 2, Math.min(255, hi))];
  return [lo, hi];
}

/** Auto Tone: Levels per channel, each stretched to its own range. */
export function autoTone(h: Histogram): LevelsParams {
  const ch = (hist: Uint32Array): LevelsChannel => {
    const [inBlack, inWhite] = clipPoints(hist);
    return { ...LEVELS_IDENTITY, inBlack, inWhite };
  };
  return { rgb: LEVELS_IDENTITY, red: ch(h.red), green: ch(h.green), blue: ch(h.blue) };
}

/** Auto Contrast: Levels on luminosity, the same stretch for every channel (colours kept). */
export function autoContrast(h: Histogram): LevelsParams {
  const [inBlack, inWhite] = clipPoints(h.luma);
  return {
    rgb: { ...LEVELS_IDENTITY, inBlack, inWhite },
    red: LEVELS_IDENTITY,
    green: LEVELS_IDENTITY,
    blue: LEVELS_IDENTITY,
  };
}

function mean(h: Uint32Array, lut: (i: number) => number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 256; i++) {
    sum += lut(i) * h[i]!;
    n += h[i]!;
  }
  return n > 0 ? sum / n : 128;
}

/** Auto Colour: Auto Tone, then each channel's gamma set so its mean meets the others' (neutral
 *  midtones). */
export function autoColour(h: Histogram): LevelsParams {
  const tone = autoTone(h);
  const means = (['red', 'green', 'blue'] as const).map((c) => mean(h[c], levelsCurve(tone[c])));
  const target = (means[0]! + means[1]! + means[2]!) / 3;
  const withGamma = (c: 'red' | 'green' | 'blue', m: number): LevelsChannel => {
    const ch = tone[c];
    if (m <= 0 || m >= 255 || target <= 0 || target >= 255) return ch;
    // A level at m maps to target: (m/255)^(1/gamma) = target/255.
    const gamma = Math.log(m / 255) / Math.log(target / 255);
    return { ...ch, gamma: Math.min(9.99, Math.max(0.1, gamma)) };
  };
  return {
    rgb: LEVELS_IDENTITY,
    red: withGamma('red', means[0]!),
    green: withGamma('green', means[1]!),
    blue: withGamma('blue', means[2]!),
  };
}
