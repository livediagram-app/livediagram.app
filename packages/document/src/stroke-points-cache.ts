// Lazy, memoised decoding of packed stroke points (docs/specs/006-document/stroke-points.md
// "Reading and writing"): whatever draws or measures a stroke asks here, the block is decoded
// once into typed arrays and kept in a cache bounded by its total point count, least recently
// used out first. A stroke that is never drawn is never decoded.
import { EMPTY_STROKE_POINTS, parseStrokePoints, type StrokePoints } from './stroke-points';

/** Decoded points the shared cache holds at most: 7x the largest real board measured, 12 MB. */
export const STROKE_DECODE_CACHE_POINTS = 500_000;
// Distinct undecodable blocks remembered, so each is logged once.
const LOGGED_LIMIT = 64;

export type StrokePointsDecoder = {
  decode(packed: string): StrokePoints;
  has(packed: string): boolean;
  size(): { entries: number; points: number };
  clear(): void;
};

export function createStrokePointsDecoder(budgetPoints: number): StrokePointsDecoder {
  // Map iteration order is insertion order: the first key is the least recently used.
  const cache = new Map<string, StrokePoints>();
  const logged = new Set<string>();
  let points = 0;

  const remember = (packed: string, decoded: StrokePoints) => {
    if (decoded.count > budgetPoints) return;
    cache.set(packed, decoded);
    points += decoded.count;
    for (const [key, value] of cache) {
      if (points <= budgetPoints) break;
      cache.delete(key);
      points -= value.count;
    }
  };

  return {
    decode(packed) {
      const hit = cache.get(packed);
      if (hit) {
        cache.delete(packed);
        cache.set(packed, hit);
        return hit;
      }
      const parsed = parseStrokePoints(packed);
      if (!parsed.ok) {
        if (!logged.has(packed)) {
          if (logged.size >= LOGGED_LIMIT) logged.clear();
          logged.add(packed);
          console.warn('[stroke-points] undecodable', {
            rejection: parsed.rejection,
            length: packed.length,
          });
        }
        return EMPTY_STROKE_POINTS;
      }
      remember(packed, parsed.points);
      return parsed.points;
    },
    has: (packed) => cache.has(packed),
    size: () => ({ entries: cache.size, points }),
    clear() {
      cache.clear();
      points = 0;
    },
  };
}

const shared = createStrokePointsDecoder(STROKE_DECODE_CACHE_POINTS);

/** A block's points, decoded once and shared: callers never write into the arrays. */
export function decodeStrokePoints(packed: string): StrokePoints {
  return shared.decode(packed);
}

/** Empties the shared cache: a freshly opened document, or the bench's cold first draw. */
export function clearStrokePointsCache(): void {
  shared.clear();
}
