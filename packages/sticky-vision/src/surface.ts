import { rgbToHsv } from './colour';
import { rgbToLabInto, type Lab } from './lab';

// Measuring one region of a photograph, for `floors.ts` to turn into floors.

// Every channel at or above this is blown out. Tuned on the eight
// hand-labelled walls: 240 to 253 score the same (the night photo's ceiling
// lamp stops dragging its cells' floors, two fewer spurious boxes there), and
// 250 sits in that band; 255 alone misses the lamp's soft edge.
export const BLOWN_OUT = 250;

// What one region of a photograph is made of: the saturation and value
// histograms of its lit pixels, and the mean hue direction of its DULL ones —
// which on a kraft wall is the kraft and on a whiteboard is nothing in
// particular.
export type Surface = {
  saturation: Int32Array;
  value: Int32Array;
  lit: number;
  // The mean hue DIRECTION per saturation bucket, so the wall's hue can be
  // taken from the dull pixels once it is known how dull the wall is here.
  // Summed as unit vectors: hues are angles, and 350° and 10° average to 0°,
  // not to 180°.
  hueX: Float64Array;
  hueY: Float64Array;
  hueCount: Int32Array;
  // CIELAB a*b* summed per saturation bucket, like the hue: the wall's
  // colour is the mean of its dull pixels.
  labA: Float64Array;
  labB: Float64Array;
};

const labScratch: Lab = { l: 0, a: 0, b: 0 };

export function measure(
  image: { data: Uint8ClampedArray; width: number; height: number },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stride: number,
): Surface {
  const surface: Surface = {
    saturation: new Int32Array(101),
    value: new Int32Array(101),
    lit: 0,
    hueX: new Float64Array(101),
    hueY: new Float64Array(101),
    hueCount: new Int32Array(101),
    labA: new Float64Array(101),
    labB: new Float64Array(101),
  };
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i]!;
      const g = image.data[i + 1]!;
      const b = image.data[i + 2]!;
      const max = Math.max(r, g, b);
      // Black is not a surface: it is ink, or a shadow with nothing readable
      // in it, and averaging it into the wall drags every floor down.
      if (max < 24) continue;
      // …and neither is white that the sensor clipped: a lamp, a window, glare.
      // Its colour is unknown, and a lamp filling most of a cell would set the
      // wall there at full brightness and every note under it would be wall.
      if (Math.min(r, g, b) >= BLOWN_OUT) continue;
      const s = (max - Math.min(r, g, b)) / max;
      const bucket = Math.round(s * 100);
      surface.saturation[bucket]! += 1;
      surface.value[Math.round((max / 255) * 100)]! += 1;
      surface.lit += 1;
      const h = (rgbToHsv({ r, g, b }).h * Math.PI) / 180;
      surface.hueX[bucket]! += Math.cos(h);
      surface.hueY[bucket]! += Math.sin(h);
      surface.hueCount[bucket]! += 1;
      rgbToLabInto(r, g, b, labScratch);
      surface.labA[bucket]! += labScratch.a;
      surface.labB[bucket]! += labScratch.b;
    }
  }
  return surface;
}

// The wall's own hue: the mean direction of the pixels too dull to be paper,
// which on a kraft wall is the kraft and on a whiteboard is nothing in
// particular.
//
// "Too dull to be paper" is the floor this same region just measured, not a
// fixed number. A fixed one gets it backwards exactly where it matters: in
// deep shade the paper's saturation drops into any fixed cut, so the note
// starts voting for the wall's hue — and a wall hue pulled onto a red note
// then lets the real wall in as paper everywhere that tile reaches.
export function hueOf(surface: Surface, below: number): number {
  let x = 0;
  let y = 0;
  let n = 0;
  const limit = Math.min(100, Math.round(below * 100));
  for (let i = 0; i < limit; i += 1) {
    x += surface.hueX[i]!;
    y += surface.hueY[i]!;
    n += surface.hueCount[i]!;
  }
  if (n === 0) return -1;
  const deg = (Math.atan2(y / n, x / n) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

// The wall's colour in a*b*: the mean of the same too-dull-to-be-paper pixels
// the hue is taken from. Not the region's commonest colour: a cell mostly
// covered by one note is mostly that note.
export function wallLabOf(surface: Surface, below: number): { wallA?: number; wallB?: number } {
  let a = 0;
  let b = 0;
  let n = 0;
  const limit = Math.min(100, Math.round(below * 100));
  for (let i = 0; i < limit; i += 1) {
    a += surface.labA[i]!;
    b += surface.labB[i]!;
    n += surface.hueCount[i]!;
  }
  return n === 0 ? {} : { wallA: a / n, wallB: b / n };
}
