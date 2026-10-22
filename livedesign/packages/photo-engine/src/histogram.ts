// A picture's histogram (docs/specs/031-photo/photo-pages.md "The Photo panel", photo-adjustments.md
// "Auto Tone"): 256 counts for each of red, green, blue and luma, over pixels with any alpha.
import type { Histogram } from './adjust/levels';
import type { Raster } from './raster/raster';

export type { Histogram } from './adjust/levels';

/** The histogram of `r`, reading every `step`-th pixel (1 reads them all). */
export function histogramOf(r: Raster, step = 1): Histogram {
  const red = new Uint32Array(256);
  const green = new Uint32Array(256);
  const blue = new Uint32Array(256);
  const luma = new Uint32Array(256);
  const d = r.data;
  const stride = Math.max(1, Math.floor(step)) * 4;
  for (let i = 0; i < d.length; i += stride) {
    if (d[i + 3] === 0) continue;
    const cr = d[i]!;
    const cg = d[i + 1]!;
    const cb = d[i + 2]!;
    red[cr]!++;
    green[cg]!++;
    blue[cb]!++;
    luma[Math.round(0.299 * cr + 0.587 * cg + 0.114 * cb)]!++;
  }
  return { red, green, blue, luma };
}
