// The GIF panel's estimate (docs/specs/020-import-export/animated-gif-export.md "The options", DEFAULTS D47, D48):
// one encoded frame's bytes times the frames the timeline writes, plus the file's header.
import type { GifFrame } from './gif-timeline';

// The header, the loop extension and the trailer, near enough.
const GIF_HEADER_BYTES = 800;
// How long the options rest before the estimate is worked out again.
export const GIF_ESTIMATE_DELAY_MS = 250;

/** The GIF's likely size in bytes. */
export function estimateGifBytes(sampleFrameBytes: number, frames: readonly GifFrame[]): number {
  return sampleFrameBytes * frames.length + GIF_HEADER_BYTES;
}

/** "3 s", "2.5 s": the hold slider's reading. */
export const holdLabel = (seconds: number) => `${seconds} s`;
/** The slider's accessible value: "3 seconds", "1 second". */
export const holdValueText = (seconds: number) =>
  `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
