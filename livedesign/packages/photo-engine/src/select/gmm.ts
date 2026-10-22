// A Gaussian mixture colour model (Rother, Kolmogorov and Blake, "GrabCut", 2004): a few full-
// covariance Gaussians in RGB fitted to a set of pixels, for how likely a colour is to belong to it.

export type Gaussian = {
  weight: number;
  mean: [number, number, number];
  inv: number[]; // inverse covariance, 3 x 3 row-major
  logNorm: number; // log(weight) - 0.5 log det - 1.5 log(2 pi)
};

export type Gmm = Gaussian[];

const EPS = 1e-2;

function fit(samples: Float32Array, idx: readonly number[], total: number): Gaussian | null {
  const n = idx.length;
  if (n === 0) return null;
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (const i of idx) {
    mr += samples[i * 3]!;
    mg += samples[i * 3 + 1]!;
    mb += samples[i * 3 + 2]!;
  }
  mr /= n;
  mg /= n;
  mb /= n;
  const c = new Array(9).fill(0) as number[];
  for (const i of idx) {
    const d0 = samples[i * 3]! - mr;
    const d1 = samples[i * 3 + 1]! - mg;
    const d2 = samples[i * 3 + 2]! - mb;
    c[0]! += d0 * d0;
    c[1]! += d0 * d1;
    c[2]! += d0 * d2;
    c[4]! += d1 * d1;
    c[5]! += d1 * d2;
    c[8]! += d2 * d2;
  }
  for (const k of [0, 1, 2, 4, 5, 8]) c[k]! /= n;
  c[3] = c[1]!;
  c[6] = c[2]!;
  c[7] = c[5]!;
  c[0]! += EPS;
  c[4]! += EPS;
  c[8]! += EPS;
  const [a, b, cc, d, e, f, g, h, i] = c as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + cc * C;
  if (det <= 0) return null;
  const k = 1 / det;
  const inv = [
    A * k,
    -(b * i - cc * h) * k,
    (b * f - cc * e) * k,
    B * k,
    (a * i - cc * g) * k,
    -(a * f - cc * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
  const weight = n / total;
  return {
    weight,
    mean: [mr, mg, mb],
    inv,
    logNorm: Math.log(weight) - 0.5 * Math.log(det) - 1.5 * Math.log(2 * Math.PI),
  };
}

/** The log-likelihood of one component for a colour. */
export function componentLog(g: Gaussian, r: number, gg: number, b: number): number {
  const d0 = r - g.mean[0];
  const d1 = gg - g.mean[1];
  const d2 = b - g.mean[2];
  const m = g.inv;
  const q =
    d0 * (m[0]! * d0 + m[1]! * d1 + m[2]! * d2) +
    d1 * (m[3]! * d0 + m[4]! * d1 + m[5]! * d2) +
    d2 * (m[6]! * d0 + m[7]! * d1 + m[8]! * d2);
  return g.logNorm - 0.5 * q;
}

/** -log p(colour) under the mixture (a log-sum-exp). */
export function negLogLikelihood(gmm: Gmm, r: number, g: number, b: number): number {
  let max = -Infinity;
  const logs: number[] = [];
  for (const c of gmm) {
    const l = componentLog(c, r, g, b);
    logs.push(l);
    if (l > max) max = l;
  }
  if (max === -Infinity) return 1e3;
  let s = 0;
  for (const l of logs) s += Math.exp(l - max);
  return -(max + Math.log(s));
}

/** The component that explains a colour best. */
export function bestComponent(gmm: Gmm, r: number, g: number, b: number): number {
  let best = 0;
  let bestL = -Infinity;
  gmm.forEach((c, k) => {
    const l = componentLog(c, r, g, b);
    if (l > bestL) {
      bestL = l;
      best = k;
    }
  });
  return best;
}

/** A mixture of up to `k` components fitted to `samples` (RGB triples, 0..255) by a few rounds of
 *  k-means, deterministic (seeded by spread-out picks). */
export function fitGmm(samples: Float32Array, k = 5, rounds = 6): Gmm {
  const n = samples.length / 3;
  if (n === 0) return [];
  const kk = Math.min(k, n);
  // Seed by the farthest-point rule from the first sample.
  const centres: [number, number, number][] = [[samples[0]!, samples[1]!, samples[2]!]];
  const step = Math.max(1, Math.floor(n / 2000));
  while (centres.length < kk) {
    let far = 0;
    let farD = -1;
    for (let i = 0; i < n; i += step) {
      let dmin = Infinity;
      for (const c of centres) {
        const d =
          (samples[i * 3]! - c[0]) ** 2 +
          (samples[i * 3 + 1]! - c[1]) ** 2 +
          (samples[i * 3 + 2]! - c[2]) ** 2;
        if (d < dmin) dmin = d;
      }
      if (dmin > farD) {
        farD = dmin;
        far = i;
      }
    }
    centres.push([samples[far * 3]!, samples[far * 3 + 1]!, samples[far * 3 + 2]!]);
  }
  const assign = new Int32Array(n);
  for (let round = 0; round < rounds; round++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const ce = centres[c]!;
        const d =
          (samples[i * 3]! - ce[0]) ** 2 +
          (samples[i * 3 + 1]! - ce[1]) ** 2 +
          (samples[i * 3 + 2]! - ce[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
      const s = sums[best]!;
      s[0]! += samples[i * 3]!;
      s[1]! += samples[i * 3 + 1]!;
      s[2]! += samples[i * 3 + 2]!;
      s[3]!++;
    }
    sums.forEach((s, c) => {
      if (s[3]! > 0) centres[c] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    });
  }
  return fitAssigned(samples, assign, centres.length);
}

/** A mixture fitted to samples already assigned to components. */
export function fitAssigned(samples: Float32Array, assign: Int32Array, k: number): Gmm {
  const n = samples.length / 3;
  const groups: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) groups[assign[i]!]!.push(i);
  return groups.map((g) => fit(samples, g, n)).filter((g): g is Gaussian => g !== null);
}
