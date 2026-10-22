// The Heal tools' blend (Pérez, Gangnet and Blake, "Poisson Image Editing", 2003): copied texture
// whose colour and tone are corrected to the destination's surroundings. The correction is the
// smooth (harmonic) function inside the healed area that meets the difference between destination
// and copy on its edge, solved coarse to fine so a large area converges quickly.
import type { Raster } from '../raster/raster';

/** Solves Laplace's equation inside `inside` for each of `planes` (fixed outside), in place. */
function relax(
  planes: Float32Array[],
  inside: Uint8Array,
  w: number,
  h: number,
  iterations: number,
): void {
  const omega = 1.9;
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!inside[i]) continue;
        for (const p of planes) {
          let sum = 0;
          let n = 0;
          if (x > 0) {
            sum += p[i - 1]!;
            n++;
          }
          if (x < w - 1) {
            sum += p[i + 1]!;
            n++;
          }
          if (y > 0) {
            sum += p[i - w]!;
            n++;
          }
          if (y < h - 1) {
            sum += p[i + w]!;
            n++;
          }
          p[i] = p[i]! + omega * (sum / n - p[i]!);
        }
      }
  }
}

/** Half size, each coarse value the mean of the known (fixed) pixels under it: the unknown ones
 *  hold no answer yet. */
function downsample(p: Float32Array, inside: Uint8Array, w: number, h: number): Float32Array {
  const cw = Math.ceil(w / 2);
  const ch = Math.ceil(h / 2);
  const out = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      let s = 0;
      let n = 0;
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const xx = x * 2 + i;
          const yy = y * 2 + j;
          if (xx < w && yy < h && !inside[yy * w + xx]) {
            s += p[yy * w + xx]!;
            n++;
          }
        }
      out[y * cw + x] = n ? s / n : 0;
    }
  return out;
}

/** The harmonic fill of each plane inside `inside`, coarse to fine. */
function harmonic(planes: Float32Array[], inside: Uint8Array, w: number, h: number): void {
  if (w > 32 && h > 32) {
    const cw = Math.ceil(w / 2);
    const ch = Math.ceil(h / 2);
    const coarse = planes.map((p) => downsample(p, inside, w, h));
    const cin = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        // A coarse pixel is inside only when all it covers is.
        let all = true;
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const xx = x * 2 + i;
            const yy = y * 2 + j;
            if (xx < w && yy < h && !inside[yy * w + xx]) all = false;
          }
        cin[y * cw + x] = all ? 1 : 0;
      }
    harmonic(coarse, cin, cw, ch);
    // Start the fine solve from the coarse answer.
    planes.forEach((p, k) => {
      const c = coarse[k]!;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (inside[i]) p[i] = c[Math.floor(y / 2) * cw + Math.floor(x / 2)]!;
        }
    });
    relax(planes, inside, w, h, 30);
    return;
  }
  relax(planes, inside, w, h, 200);
}

/** `copy` blended into `dest` where `mask` (0..255, the size of both) is set: the copy's texture
 *  with the destination's colour and tone at the area's edge. Answers the healed raster. */
export function poissonBlend(dest: Raster, copy: Raster, mask: Uint8Array): Raster {
  const w = dest.width;
  const h = dest.height;
  const n = w * h;
  const inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) inside[i] = mask[i]! > 0 ? 1 : 0;
  // Pixels on the image's own edge cannot be solved for: treat them as fixed.
  for (let x = 0; x < w; x++) {
    inside[x] = 0;
    inside[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    inside[y * w] = 0;
    inside[y * w + w - 1] = 0;
  }
  const planes = [0, 1, 2].map((c) => {
    const p = new Float32Array(n);
    for (let i = 0; i < n; i++)
      p[i] = inside[i] ? 0 : dest.data[i * 4 + c]! - copy.data[i * 4 + c]!;
    return p;
  });
  harmonic(planes, inside, w, h);
  const out: Raster = { width: w, height: h, data: new Uint8ClampedArray(dest.data) };
  for (let i = 0; i < n; i++) {
    const m = mask[i]! / 255;
    if (m <= 0) continue;
    for (let c = 0; c < 3; c++) {
      const healed = copy.data[i * 4 + c]! + planes[c]![i]!;
      out.data[i * 4 + c] = dest.data[i * 4 + c]! + (healed - dest.data[i * 4 + c]!) * m;
    }
  }
  return out;
}
