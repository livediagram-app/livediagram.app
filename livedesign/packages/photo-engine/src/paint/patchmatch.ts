// Content-aware fill (docs/specs/031-photo/photo-tools.md "Retouching": Spot Heal, Content-Aware
// Fill): the hole filled from the rest of the picture by patch search (Barnes et al., "PatchMatch",
// 2009) and patch voting (Wexler et al., "Space-Time Completion of Video", 2007), coarse to fine, so
// the fill continues the texture and structure around it.
import { createRaster, type Raster } from '../raster/raster';

// The patch's half-width (a 7 x 7 patch).
const R = 3;

type Level = { w: number; h: number; img: Float32Array; hole: Uint8Array };

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function toLevel(r: Raster, hole: Uint8Array): Level {
  const img = new Float32Array(r.width * r.height * 3);
  for (let i = 0; i < r.width * r.height; i++) {
    img[i * 3] = r.data[i * 4]!;
    img[i * 3 + 1] = r.data[i * 4 + 1]!;
    img[i * 3 + 2] = r.data[i * 4 + 2]!;
  }
  return { w: r.width, h: r.height, img, hole: Uint8Array.from(hole, (v) => (v > 0 ? 1 : 0)) };
}

function shrink(l: Level): Level {
  const w = Math.max(1, Math.ceil(l.w / 2));
  const h = Math.max(1, Math.ceil(l.h / 2));
  const img = new Float32Array(w * h * 3);
  const hole = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let n = 0;
      let anyHole = 0;
      const acc = [0, 0, 0];
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const xx = x * 2 + i;
          const yy = y * 2 + j;
          if (xx >= l.w || yy >= l.h) continue;
          const k = yy * l.w + xx;
          if (l.hole[k]) anyHole = 1;
          else {
            acc[0]! += l.img[k * 3]!;
            acc[1]! += l.img[k * 3 + 1]!;
            acc[2]! += l.img[k * 3 + 2]!;
            n++;
          }
        }
      const o = y * w + x;
      hole[o] = anyHole;
      if (n) {
        img[o * 3] = acc[0]! / n;
        img[o * 3 + 1] = acc[1]! / n;
        img[o * 3 + 2] = acc[2]! / n;
      }
    }
  return { w, h, img, hole };
}

/** Whether a patch centred at (x, y) lies wholly in the picture and wholly outside the hole: a
 *  valid source. */
function validSource(l: Level, x: number, y: number, holeNear: Uint8Array): boolean {
  return x >= R && y >= R && x < l.w - R && y < l.h - R && !holeNear[y * l.w + x];
}

/** Marks every pixel within R of the hole (patches centred there touch it). */
function dilateHole(l: Level): Uint8Array {
  const out = new Uint8Array(l.w * l.h);
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      if (!l.hole[y * l.w + x]) continue;
      for (let j = -R; j <= R; j++)
        for (let i = -R; i <= R; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx >= 0 && yy >= 0 && xx < l.w && yy < l.h) out[yy * l.w + xx] = 1;
        }
    }
  return out;
}

/** The squared colour distance between the patches at a and b, stopping past `cap`. */
function patchDistance(
  l: Level,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cap: number,
): number {
  let d = 0;
  let n = 0;
  for (let j = -R; j <= R; j++) {
    const ya = ay + j;
    const yb = by + j;
    if (ya < 0 || ya >= l.h) continue;
    for (let i = -R; i <= R; i++) {
      const xa = ax + i;
      if (xa < 0 || xa >= l.w) continue;
      const ka = (ya * l.w + xa) * 3;
      const kb = (yb * l.w + bx + i) * 3;
      const d0 = l.img[ka]! - l.img[kb]!;
      const d1 = l.img[ka + 1]! - l.img[kb + 1]!;
      const d2 = l.img[ka + 2]! - l.img[kb + 2]!;
      d += d0 * d0 + d1 * d1 + d2 * d2;
      n++;
      if (d > cap * n) return Infinity;
    }
  }
  return n ? d / n : Infinity;
}

type Nnf = { x: Int32Array; y: Int32Array; d: Float32Array };

function patchMatch(
  l: Level,
  nnf: Nnf,
  targets: number[],
  holeNear: Uint8Array,
  rand: () => number,
  iterations: number,
): void {
  const improve = (t: number, cx: number, cy: number) => {
    const tx = t % l.w;
    const ty = (t - tx) / l.w;
    if (!validSource(l, cx, cy, holeNear)) return;
    const d = patchDistance(l, tx, ty, cx, cy, nnf.d[t]!);
    if (d < nnf.d[t]!) {
      nnf.x[t] = cx;
      nnf.y[t] = cy;
      nnf.d[t] = d;
    }
  };
  for (let it = 0; it < iterations; it++) {
    const forward = it % 2 === 0;
    const order = forward ? targets : [...targets].reverse();
    const s = forward ? -1 : 1;
    for (const t of order) {
      const tx = t % l.w;
      const ty = (t - tx) / l.w;
      // Propagation from the neighbours already visited this pass.
      for (const [nx, ny] of [
        [tx + s, ty],
        [tx, ty + s],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h) continue;
        const nt = ny * l.w + nx;
        if (nnf.x[nt]! < 0) continue;
        // The neighbour's match, shifted as we are from it.
        improve(t, nnf.x[nt]! + (tx - nx), nnf.y[nt]! + (ty - ny));
      }
      // Random search, halving the radius.
      for (let rad = Math.max(l.w, l.h); rad >= 1; rad = Math.floor(rad / 2)) {
        const cx = nnf.x[t]! + Math.round((rand() * 2 - 1) * rad);
        const cy = nnf.y[t]! + Math.round((rand() * 2 - 1) * rad);
        improve(t, cx, cy);
      }
    }
  }
}

/** Each hole pixel's colour from the patches overlapping it, weighted by how well they match. */
function vote(l: Level, nnf: Nnf, holeNear: Uint8Array): void {
  const acc = new Float32Array(l.w * l.h * 4);
  for (let t = 0; t < l.w * l.h; t++) {
    if (!holeNear[t] || nnf.x[t]! < 0) continue;
    const tx = t % l.w;
    const ty = (t - tx) / l.w;
    const sx = nnf.x[t]!;
    const sy = nnf.y[t]!;
    const wgt = Math.exp(-nnf.d[t]! / (2 * 40 * 40));
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        const px = tx + i;
        const py = ty + j;
        if (px < 0 || py < 0 || px >= l.w || py >= l.h) continue;
        const p = py * l.w + px;
        if (!l.hole[p]) continue;
        const k = ((sy + j) * l.w + sx + i) * 3;
        acc[p * 4]! += l.img[k]! * wgt;
        acc[p * 4 + 1]! += l.img[k + 1]! * wgt;
        acc[p * 4 + 2]! += l.img[k + 2]! * wgt;
        acc[p * 4 + 3]! += wgt;
      }
  }
  for (let p = 0; p < l.w * l.h; p++) {
    if (!l.hole[p] || acc[p * 4 + 3]! <= 0) continue;
    const s = acc[p * 4 + 3]!;
    l.img[p * 3] = acc[p * 4]! / s;
    l.img[p * 3 + 1] = acc[p * 4 + 1]! / s;
    l.img[p * 3 + 2] = acc[p * 4 + 2]! / s;
  }
}

/** A first guess at the coarsest level: each hole pixel the mean of the known pixels around it,
 *  growing inward ring by ring. */
function diffuseFill(l: Level): void {
  const known = Uint8Array.from(l.hole, (v) => (v ? 0 : 1));
  let left = l.hole.reduce((a, b) => a + b, 0);
  let guard = l.w + l.h;
  while (left > 0 && guard-- > 0) {
    const next = known.slice();
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const p = y * l.w + x;
        if (known[p]) continue;
        const acc = [0, 0, 0];
        let n = 0;
        for (const [i, j] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= l.w || yy >= l.h || !known[yy * l.w + xx]) continue;
          const k = (yy * l.w + xx) * 3;
          acc[0]! += l.img[k]!;
          acc[1]! += l.img[k + 1]!;
          acc[2]! += l.img[k + 2]!;
          n++;
        }
        if (n) {
          l.img[p * 3] = acc[0]! / n;
          l.img[p * 3 + 1] = acc[1]! / n;
          l.img[p * 3 + 2] = acc[2]! / n;
          next[p] = 1;
          left--;
        }
      }
    known.set(next);
  }
}

/** `r` with the pixels where `hole` is set filled from the rest of it. Alpha is kept as it was
 *  outside the hole and made opaque in it. `seed` makes it repeatable. */
export function contentAwareFill(
  r: Raster,
  hole: Uint8Array,
  { seed = 1, iterations = 5 } = {},
): Raster {
  const levels: Level[] = [toLevel(r, hole)];
  while (levels[levels.length - 1]!.w > 48 && levels[levels.length - 1]!.h > 48)
    levels.push(shrink(levels[levels.length - 1]!));
  const rand = seeded(seed);
  let prev: { nnf: Nnf; level: Level } | null = null;
  for (let li = levels.length - 1; li >= 0; li--) {
    const l = levels[li]!;
    const holeNear = dilateHole(l);
    const n = l.w * l.h;
    const nnf: Nnf = {
      x: new Int32Array(n).fill(-1),
      y: new Int32Array(n).fill(-1),
      d: new Float32Array(n).fill(Infinity),
    };
    const targets: number[] = [];
    for (let p = 0; p < n; p++) if (holeNear[p]) targets.push(p);
    // Valid sources to start from.
    const sources: number[] = [];
    for (let y = R; y < l.h - R; y++)
      for (let x = R; x < l.w - R; x++) if (!holeNear[y * l.w + x]) sources.push(y * l.w + x);
    if (sources.length === 0) continue;
    if (!prev) diffuseFill(l);
    else {
      // Upsample the coarser match and the coarser fill as the start.
      const pl = prev.level;
      for (let y = 0; y < l.h; y++)
        for (let x = 0; x < l.w; x++) {
          const p = y * l.w + x;
          const q =
            Math.min(pl.h - 1, Math.floor(y / 2)) * pl.w + Math.min(pl.w - 1, Math.floor(x / 2));
          if (l.hole[p]) {
            l.img[p * 3] = pl.img[q * 3]!;
            l.img[p * 3 + 1] = pl.img[q * 3 + 1]!;
            l.img[p * 3 + 2] = pl.img[q * 3 + 2]!;
          }
          if (holeNear[p] && prev.nnf.x[q]! >= 0) {
            nnf.x[p] = Math.min(l.w - R - 1, Math.max(R, prev.nnf.x[q]! * 2 + (x % 2)));
            nnf.y[p] = Math.min(l.h - R - 1, Math.max(R, prev.nnf.y[q]! * 2 + (y % 2)));
          }
        }
    }
    for (const t of targets) {
      if (nnf.x[t]! < 0 || !validSource(l, nnf.x[t]!, nnf.y[t]!, holeNear)) {
        const s = sources[Math.floor(rand() * sources.length)]!;
        nnf.x[t] = s % l.w;
        nnf.y[t] = Math.floor(s / l.w);
      }
      const tx = t % l.w;
      nnf.d[t] = patchDistance(l, tx, (t - tx) / l.w, nnf.x[t]!, nnf.y[t]!, Infinity);
    }
    const rounds = li === 0 ? Math.max(2, iterations - 2) : iterations;
    for (let em = 0; em < rounds; em++) {
      patchMatch(l, nnf, targets, holeNear, rand, 2);
      vote(l, nnf, holeNear);
      for (const t of targets) {
        const tx = t % l.w;
        nnf.d[t] = patchDistance(l, tx, (t - tx) / l.w, nnf.x[t]!, nnf.y[t]!, Infinity);
      }
    }
    prev = { nnf, level: l };
  }
  const top = levels[0]!;
  const out = createRaster(r.width, r.height);
  out.data.set(r.data);
  for (let p = 0; p < r.width * r.height; p++) {
    if (!top.hole[p]) continue;
    out.data[p * 4] = top.img[p * 3]!;
    out.data[p * 4 + 1] = top.img[p * 3 + 1]!;
    out.data[p * 4 + 2] = top.img[p * 3 + 2]!;
    out.data[p * 4 + 3] = 255;
  }
  return out;
}
