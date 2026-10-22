// GrabCut (docs/specs/031-photo/photo-tools.md "Smart selections"): the subject split from the rest
// by colour models of each, refined by graph cuts along the picture's edges. Select Subject seeds it
// from the photo's border (background) and the rest (probably the subject); Quick Select seeds it
// from the strokes.
import type { Raster } from '../raster/raster';
import { bestComponent, fitAssigned, fitGmm, negLogLikelihood, type Gmm } from './gmm';
import { GridGraph } from './maxflow';

/** What is known of each pixel before the cut. */
export const TRIMAP = {
  background: 0,
  probablyBackground: 1,
  probablyForeground: 2,
  foreground: 3,
} as const;
export type Trimap = Uint8Array;

// The smoothness weight (the paper's gamma) and the hard constraint's capacity.
const GAMMA = 50;
const HARD = 1e9;

function colours(r: Raster): Float32Array {
  const n = r.width * r.height;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = r.data[i * 4]!;
    out[i * 3 + 1] = r.data[i * 4 + 1]!;
    out[i * 3 + 2] = r.data[i * 4 + 2]!;
  }
  return out;
}

const DX = [1, 1, 0, -1];
const DY = [0, 1, 1, 1];

/** The smoothness edges' weights, for the four forward neighbours of every pixel. */
function edgeWeights(c: Float32Array, w: number, h: number): Float32Array {
  // beta: one over twice the mean squared colour difference of neighbours.
  let sum = 0;
  let count = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k]!;
        const ny = y + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const i = (y * w + x) * 3;
        const j = (ny * w + nx) * 3;
        sum += (c[i]! - c[j]!) ** 2 + (c[i + 1]! - c[j + 1]!) ** 2 + (c[i + 2]! - c[j + 2]!) ** 2;
        count++;
      }
  const beta = count > 0 && sum > 0 ? 1 / ((2 * sum) / count) : 0;
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k]!;
        const ny = y + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const i = (y * w + x) * 3;
        const j = (ny * w + nx) * 3;
        const d =
          (c[i]! - c[j]!) ** 2 + (c[i + 1]! - c[j + 1]!) ** 2 + (c[i + 2]! - c[j + 2]!) ** 2;
        const dist = k === 1 || k === 3 ? Math.SQRT2 : 1;
        out[(y * w + x) * 4 + k] = (GAMMA / dist) * Math.exp(-beta * d);
      }
  return out;
}

function samplesOf(c: Float32Array, trimap: Trimap, fg: boolean, cap = 20000): Float32Array {
  const idx: number[] = [];
  for (let i = 0; i < trimap.length; i++) {
    const t = trimap[i]!;
    if (fg ? t >= TRIMAP.probablyForeground : t <= TRIMAP.probablyBackground) idx.push(i);
  }
  const step = Math.max(1, Math.floor(idx.length / cap));
  const picked = idx.filter((_, k) => k % step === 0);
  const out = new Float32Array(picked.length * 3);
  picked.forEach((i, k) => {
    out[k * 3] = c[i * 3]!;
    out[k * 3 + 1] = c[i * 3 + 1]!;
    out[k * 3 + 2] = c[i * 3 + 2]!;
  });
  return out;
}

function refit(c: Float32Array, trimap: Trimap, gmm: Gmm, fg: boolean): Gmm {
  const s = samplesOf(c, trimap, fg);
  if (s.length === 0 || gmm.length === 0) return gmm;
  const assign = new Int32Array(s.length / 3);
  for (let i = 0; i < assign.length; i++)
    assign[i] = bestComponent(gmm, s[i * 3]!, s[i * 3 + 1]!, s[i * 3 + 2]!);
  const next = fitAssigned(s, assign, gmm.length);
  return next.length > 0 ? next : gmm;
}

/** The subject (255) and the rest (0) of `r`, from what the trimap knows, after `iterations`
 *  rounds of fitting and cutting. The trimap's probable entries are updated in place. */
export function grabCut(r: Raster, trimap: Trimap, iterations = 4): Uint8Array {
  const w = r.width;
  const h = r.height;
  const c = colours(r);
  const weights = edgeWeights(c, w, h);
  let fgModel = fitGmm(samplesOf(c, trimap, true));
  let bgModel = fitGmm(samplesOf(c, trimap, false));
  const out = new Uint8Array(w * h);
  if (fgModel.length === 0 || bgModel.length === 0) {
    for (let i = 0; i < out.length; i++) out[i] = trimap[i]! >= TRIMAP.probablyForeground ? 255 : 0;
    return out;
  }
  for (let it = 0; it < iterations; it++) {
    if (it > 0) {
      fgModel = refit(c, trimap, fgModel, true);
      bgModel = refit(c, trimap, bgModel, false);
    }
    const g = new GridGraph(w, h);
    for (let i = 0; i < w * h; i++) {
      const t = trimap[i]!;
      if (t === TRIMAP.background) g.setTerminal(i, 0, HARD);
      else if (t === TRIMAP.foreground) g.setTerminal(i, HARD, 0);
      else {
        const dFg = negLogLikelihood(fgModel, c[i * 3]!, c[i * 3 + 1]!, c[i * 3 + 2]!);
        const dBg = negLogLikelihood(bgModel, c[i * 3]!, c[i * 3 + 1]!, c[i * 3 + 2]!);
        // Source is the subject: cutting a pixel off the source costs its subject-ness.
        g.setTerminal(i, dBg, dFg);
      }
      for (let k = 0; k < 4; k++) {
        const v = weights[i * 4 + k]!;
        if (v > 0) g.setEdge(i, [0, 1, 2, 3][k]!, v, v);
      }
    }
    const { side } = g.solve();
    let changed = 0;
    for (let i = 0; i < w * h; i++) {
      const t = trimap[i]!;
      if (t === TRIMAP.background || t === TRIMAP.foreground) continue;
      const next = side[i] ? TRIMAP.probablyForeground : TRIMAP.probablyBackground;
      if (next !== t) changed++;
      trimap[i] = next;
    }
    if (changed === 0 && it > 0) break;
  }
  for (let i = 0; i < out.length; i++) out[i] = trimap[i]! >= TRIMAP.probablyForeground ? 255 : 0;
  return out;
}

/** Select Subject's trimap: a border band (a fortieth of the shorter side, at least 2 px) is
 *  background, the rest probably the subject. */
export function subjectTrimap(width: number, height: number): Trimap {
  const t = new Uint8Array(width * height).fill(TRIMAP.probablyForeground);
  const band = Math.max(2, Math.round(Math.min(width, height) / 40));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (x < band || y < band || x >= width - band || y >= height - band)
        t[y * width + x] = TRIMAP.background;
  return t;
}

/** The subject of a picture: GrabCut seeded by subjectTrimap. */
export function selectSubject(r: Raster, iterations = 4): Uint8Array {
  return grabCut(r, subjectTrimap(r.width, r.height), iterations);
}
