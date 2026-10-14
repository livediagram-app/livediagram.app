// The GIF export's encoder (docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder"): frames in,
// one looping GIF out. A frame identical to the one before it is not written: its time is added to that frame, so a
// stretch where nothing moves costs one frame. Runs in the encoder worker (gif-encode.worker.ts), and on the main
// thread for the estimate's one sample frame.
import { applyPalette, GIFEncoder, quantize } from 'gifenc';

const FORMAT = 'rgb565';
const COLOURS = 256;

export type GifWriter = {
  /** Add a frame (RGBA, width x height) shown for `delayCs` centiseconds. */
  add(rgba: Uint8ClampedArray, delayCs: number): void;
  /** The frames written so far (a repeat of the frame before counts as none). */
  readonly written: number;
  /** The finished file. */
  finish(): Uint8Array;
};

export function createGifWriter(width: number, height: number): GifWriter {
  const gif = GIFEncoder();
  let held: { rgba: Uint8ClampedArray; delayCs: number } | null = null;
  let written = 0;
  const write = (frame: { rgba: Uint8ClampedArray; delayCs: number }) => {
    const palette = quantize(frame.rgba, COLOURS, { format: FORMAT });
    const index = applyPalette(frame.rgba, palette, FORMAT);
    // repeat 0: the first frame carries the loop-forever extension.
    gif.writeFrame(index, width, height, { palette, delay: frame.delayCs * 10, repeat: 0 });
    written += 1;
  };
  return {
    add(rgba, delayCs) {
      if (held && sameBytes(held.rgba, rgba)) {
        held.delayCs += delayCs;
        return;
      }
      if (held) write(held);
      held = { rgba, delayCs };
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
  const index = applyPalette(rgba, palette, FORMAT);
  const gif = GIFEncoder({ auto: false });
  // Not the first frame: a local colour table, as every frame after the first has.
  gif.writeFrame(index, width, height, { palette, delay: 70 });
  return gif.bytes().length;
}
