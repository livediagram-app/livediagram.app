// How big a note is HERE (spec/139 Phase 9).
//
// One median note size serves a photograph taken square-on to a short wall.
// A wide or angled photograph is not like that: the notes at the near end
// are bigger than those at the far end, and a corner of the wall may be a
// pad of smaller notes stuck in a lattice. The field answers, for a point,
// the median short side of the plausible notes around it, each weighed by
// how near it is (a Gaussian a few notes wide), so the answer slides from
// one region to the next instead of flipping as a count of neighbours
// crosses from one pad into the other.

export type NoteSizeField = { sizeAt(x: number, y: number): number };

// How wide the neighbourhood is: the Gaussian's spread, in wall notes.
// Measured on the eight labelled walls with the seam cut reading the field
// (and `SEAM_MIN_SPAN` 1.4): 1 to 1.75 all score TOTAL 94.1 with 19–21
// merged boxes; at 2 the panorama's pad of small actors is read at the size
// of the big notes around it (93.5, 22), and at 3 the whiteboard loses a note.
const SIZE_FIELD_SPREAD = 1.5;
// Below this much weight (about this many notes within a spread) the notes
// near a point are too few to say anything, and the wall's size stands.
// 2 to 3 score alike; at 1 a pair of scraps sets the size, at 4 the pad of
// small actors is too sparse to count (measured with `SEAM_MIN_SPAN` 1.3).
const SIZE_FIELD_MIN_WEIGHT = 2.5;
// The local size is kept within these multiples of the wall's size, so no
// patch of scraps or run of fused notes can take it anywhere a note is not.
// Nothing on the eight walls reaches them: 0.3–0.5 and 1–2 score alike.
const SIZE_FIELD_MIN_RATIO = 0.5;
const SIZE_FIELD_MAX_RATIO = 2;

type Sample = { x: number; y: number; w: number; h: number };

export function noteSizeField(samples: readonly Sample[], wallSize: number): NoteSizeField {
  const notes = samples
    .map((s) => ({ cx: s.x + s.w / 2, cy: s.y + s.h / 2, size: Math.min(s.w, s.h) }))
    .sort((a, b) => a.size - b.size);
  const spread = 2 * (SIZE_FIELD_SPREAD * wallSize) ** 2;
  const lo = wallSize * SIZE_FIELD_MIN_RATIO;
  const hi = wallSize * SIZE_FIELD_MAX_RATIO;
  return {
    sizeAt(x, y) {
      if (wallSize <= 0) return wallSize;
      const weights = notes.map((n) => Math.exp(-((n.cx - x) ** 2 + (n.cy - y) ** 2) / spread));
      const total = weights.reduce((a, w) => a + w, 0);
      if (total < SIZE_FIELD_MIN_WEIGHT) return wallSize;
      // The weighted median: the size at which half the weight is reached,
      // walking up from the smallest note.
      let seen = 0;
      for (let i = 0; i < notes.length; i += 1) {
        seen += weights[i]!;
        if (seen >= total / 2) return Math.min(hi, Math.max(lo, notes[i]!.size));
      }
      return wallSize;
    },
  };
}

export const SIZE_FIELD_CALIBRATION = {
  SIZE_FIELD_SPREAD,
  SIZE_FIELD_MIN_WEIGHT,
  SIZE_FIELD_MIN_RATIO,
  SIZE_FIELD_MAX_RATIO,
} as const;
