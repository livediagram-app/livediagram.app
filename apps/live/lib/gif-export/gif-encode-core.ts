// The GIF export's encoder (docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder"): frames in,
// one looping GIF out. A frame identical to the one before it is not written: its time is added to that frame, so a
// stretch where nothing moves costs one frame. Every frame of a page shares one palette, chosen from samples across
// the page's hold, and a colour always takes the same palette entry, so a slow gradient drifts calmly rather than its
// colour bands jumping frame to frame (spec "What a frame shows", "Colours hold still"). Runs in the encoder worker
// (gif-encode.worker.ts), and on the main thread for the estimate's one sample frame.
import { GIFEncoder, quantize, type GifPalette } from 'gifenc';

const FORMAT = 'rgb565';
const COLOURS = 256;
// Every this-many pixels of each sample frame go into a page's palette: plenty to find its colours, a fraction of
// the time.
export const PALETTE_SAMPLE_STRIDE = 4;
export type GifWriter = {
  /** Add a frame (RGBA, width x height) shown for `delayCs` centiseconds, in `palette` (its own when absent). */
  add(rgba: Uint8ClampedArray, delayCs: number, palette?: GifPalette): void;
  /** The frames written so far (a repeat of the frame before counts as none). */
  readonly written: number;
  /** The finished file. */
  finish(): Uint8Array;
};

type Held = { rgba: Uint8ClampedArray; delayCs: number; palette?: GifPalette };

export function createGifWriter(width: number, height: number): GifWriter {
  const gif = GIFEncoder();
  let held: Held | null = null;
  let written = 0;
  const write = (frame: Held) => {
    const palette = frame.palette ?? quantize(frame.rgba, COLOURS, { format: FORMAT });
    const index = indexFrame(frame.rgba, palette);
    // repeat 0: the first frame carries the loop-forever extension.
    gif.writeFrame(index, width, height, { palette, delay: frame.delayCs * 10, repeat: 0 });
    written += 1;
  };
  return {
    add(rgba, delayCs, palette) {
      if (held && sameBytes(held.rgba, rgba)) {
        held.delayCs += delayCs;
        return;
      }
      if (held) write(held);
      held = { rgba, delayCs, palette };
    },
    get written() {
      return written;
    },
    finish() {
      if (held) write(held);
      held = null;
      gif.finish();
      return gif.bytes();
    },
  };
}

/** One palette for a page, from frames across its hold (every PALETTE_SAMPLE_STRIDE-th pixel of each). */
export function pagePalette(samples: readonly Uint8ClampedArray[]): GifPalette {
  const pixels = samples.reduce((n, s) => n + Math.ceil(s.length / 4 / PALETTE_SAMPLE_STRIDE), 0);
  const pool = new Uint8ClampedArray(pixels * 4);
  let at = 0;
  for (const s of samples)
    for (let i = 0; i < s.length; i += 4 * PALETTE_SAMPLE_STRIDE) {
      pool[at] = s[i]!;
      pool[at + 1] = s[i + 1]!;
      pool[at + 2] = s[i + 2]!;
      pool[at + 3] = s[i + 3]!;
      at += 4;
    }
  return quantize(pool, COLOURS, { format: FORMAT });
}

// Each 5-6-5 bit colour bucket's nearest palette colour, by palette, worked out once from the bucket's centre. gifenc's
// own applyPalette takes whichever pixel lands in a bucket first, so one colour could map one way in a frame and
// another way in the next: the very flicker the shared palette is there to stop.
const lookups = new WeakMap<GifPalette, Int16Array>();

/** Each pixel's palette index, the same colour always the same index. */
export function indexFrame(rgba: Uint8ClampedArray, palette: GifPalette): Uint8Array {
  let lut = lookups.get(palette);
  if (!lut) {
    lut = new Int16Array(65536).fill(-1);
    lookups.set(palette, lut);
  }
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const key = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
    let at = lut[key]!;
    if (at < 0) {
      at = nearest(palette, (r & 0xf8) | 4, (g & 0xfc) | 2, (b & 0xf8) | 4);
      lut[key] = at;
    }
    out[p] = at;
  }
  return out;
}

function nearest(palette: GifPalette, r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i += 1) {
    const c = palette[i]!;
    const d = (c[0]! - r) ** 2 + (c[1]! - g) ** 2 + (c[2]! - b) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

// Compared four bytes at a time: a 960 x 540 frame is about 2 MB.
function sameBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  if (a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0 && a.length % 4 === 0) {
    const wa = new Uint32Array(a.buffer, a.byteOffset, a.length / 4);
    const wb = new Uint32Array(b.buffer, b.byteOffset, b.length / 4);
    for (let i = 0; i < wa.length; i += 1) if (wa[i] !== wb[i]) return false;
    return true;
  }
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** The bytes one frame takes in a GIF, for the estimate. */
export function sampleFrameBytes(rgba: Uint8ClampedArray, width: number, height: number): number {
  const palette = quantize(rgba, COLOURS, { format: FORMAT });
  const index = indexFrame(rgba, palette);
  const gif = GIFEncoder({ auto: false });
  // Not the first frame: a local colour table, as every frame after the first has.
  gif.writeFrame(index, width, height, { palette, delay: 70 });
  return gif.bytes().length;
}
