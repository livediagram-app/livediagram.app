// The live stroke's SVG path, built incrementally (blueprint whiteboard-round-one
// "Live stroke pipeline", Path). Changing a path's `d` makes the browser
// re-parse and re-rasterise all of it, so finished ink is sealed into fixed
// chunks that are never rewritten, and each frame rebuilds only the open chunk
// and the wet tail. The chunks and the live path together are exactly
// `catmullRomToBezierPath` of the same points: the path the stroke lands as.

import type { Point } from './geometry-primitives';
import { catmullRomSegment } from './polyline';

// Final segments per sealed chunk: bounds the live path's length, and so the
// per-frame string and rasterising work. docs/research/stroke-smoothing.md,
// safe range 32 to 256.
export const STROKE_CHUNK_SEGMENTS = 64;

export type StrokePathFrame = {
  /** Chunks sealed by this update, each a path (`M` then its segments); never rebuilt. */
  sealed: string[];
  /** The open chunk's final segments and the wet segments, from the open chunk's start. */
  live: string;
};

export type StrokePathBuilder = {
  /** `kept` is final and append-only across calls; `tail` is this frame's provisional rest. */
  update(kept: readonly Point[], tail: readonly Point[]): StrokePathFrame;
};

export function createStrokePathBuilder(
  chunkSegments: number = STROKE_CHUNK_SEGMENTS,
): StrokePathBuilder {
  // Segments already final (and written into a chunk).
  let done = 0;
  let chunkStart: Point | null = null;
  let open: string[] = [];
  const move = (p: Point) => `M ${p.x} ${p.y}`;

  return {
    update(kept, tail) {
      const k = kept.length;
      const count = k + tail.length;
      const at = (i: number): Point | undefined =>
        i < 0 || i >= count ? undefined : i < k ? kept[i] : tail[i - k];
      const sealed: string[] = [];
      if (count === 0) return { sealed, live: '' };
      chunkStart ??= at(0)!;
      // Segment j reads points j - 1 to j + 2 (and the corners at j and j + 1, which read the
      // same): it is final once point j + 2 is kept.
      while (done <= k - 3) {
        open.push(catmullRomSegment(at, done));
        done++;
        if (open.length === chunkSegments) {
          sealed.push(`${move(chunkStart)} ${open.join(' ')}`);
          chunkStart = at(done)!;
          open = [];
        }
      }
      const parts = [move(chunkStart), ...open];
      for (let j = done; j < count - 1; j++) parts.push(catmullRomSegment(at, j));
      return { sealed, live: parts.join(' ') };
    },
  };
}
