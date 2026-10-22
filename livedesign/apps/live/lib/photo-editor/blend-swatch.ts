// A blend mode drawn as itself for its tile in the options popovers (docs/specs/031-photo/photo-pages.md "The options
// flyout"): a spectrum underneath (hue across, light to dark down) with a teal-to-orange disc blended onto it by the
// engine's own maths, so the tile shows what the mode really does. Each mode's picture is made once, on first ask.
import { blendRgb, hslToRgb, type BlendMode, type Rgb } from '@livedesign/photo-engine';

export const SWATCH_W = 56;
export const SWATCH_H = 36;

const cache = new Map<string, string | null>();

// Colours are 0 to 1 here, as the blend maths has them.
// The picture under the disc at (x, y): hue across, lightness down.
function base(x: number, y: number): Rgb {
  return hslToRgb(x / SWATCH_W, 0.75, 0.82 - (y / SWATCH_H) * 0.64);
}

// The disc's paint at (x, y): teal at its left edge to orange at its right.
function paint(x: number): Rgb {
  const t = x / SWATCH_W;
  return [0.16 + t * 0.84, 0.67 - t * 0.16, 0.75 - t * 0.63];
}

// Whether (x, y) is in the disc, and how far through its edge (0 to 1), for a smooth rim.
function cover(x: number, y: number): number {
  const r = SWATCH_H * 0.42;
  const d = Math.hypot(x + 0.5 - SWATCH_W / 2, y + 0.5 - SWATCH_H / 2);
  return Math.min(1, Math.max(0, r - d + 0.5));
}

// A dissolve's scatter, the same every time.
const scatter = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) % 100 < 55;

/** The mode's tile picture as a data URL; null where the page cannot draw (no 2D canvas). */
export function blendSwatch(mode: BlendMode | 'behind' | 'clear'): string | null {
  const hit = cache.get(mode);
  if (hit !== undefined) return hit;
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const g = canvas?.getContext('2d') ?? null;
  if (!canvas || !g) {
    cache.set(mode, null);
    return null;
  }
  canvas.width = SWATCH_W;
  canvas.height = SWATCH_H;
  const img = g.createImageData(SWATCH_W, SWATCH_H);
  for (let y = 0; y < SWATCH_H; y++)
    for (let x = 0; x < SWATCH_W; x++) {
      const o = (y * SWATCH_W + x) * 4;
      let b = base(x, y);
      let alpha = 255;
      // Behind and Clear need somewhere see-through: the right third of the picture is empty.
      const empty = (mode === 'behind' || mode === 'clear') && x >= (SWATCH_W * 2) / 3;
      if (empty) alpha = 0;
      const c = cover(x, y);
      if (c > 0) {
        const s = paint(x);
        let out: Rgb;
        let a = c;
        if (mode === 'behind') {
          out = empty ? s : b;
          if (empty) alpha = Math.round(255 * c);
          a = empty ? 1 : 0;
        } else if (mode === 'clear') {
          out = b;
          alpha = empty ? 0 : Math.round(255 * (1 - c));
          a = 0;
        } else if (mode === 'dissolve') {
          out = scatter(x, y) ? s : b;
        } else out = blendRgb(mode, b, s);
        b = [b[0] + (out[0] - b[0]) * a, b[1] + (out[1] - b[1]) * a, b[2] + (out[2] - b[2]) * a];
      }
      img.data[o] = Math.round(b[0] * 255);
      img.data[o + 1] = Math.round(b[1] * 255);
      img.data[o + 2] = Math.round(b[2] * 255);
      img.data[o + 3] = alpha;
    }
  g.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  cache.set(mode, url);
  return url;
}
