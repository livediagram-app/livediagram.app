import { isBoxed, type BoxedElement, type Element, type ElementId } from './element';

export type AlignmentGuide = {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
};

// Derive the alignment guides for an element at `candidate` bounds
// against its neighbours. Decoupled from snapToAlignment /
// snapResizeBounds on purpose: callers pass the ALREADY-SNAPPED bounds,
// and this reports every candidate line (left / centre-x / right on X,
// top / centre-y / bottom on Y) that now coincides with a neighbour's
// line within `epsilon` pixels. Because it keys off the snapped
// position, a guide surfaces exactly when a snap is in effect — there's
// no separate "is the snap active" flag to keep in sync.
//
// `excludeIds` skips the dragged elements (so a group drag never guides
// against itself). Each returned guide spans the union extent of the
// candidate plus every matched neighbour on the perpendicular axis.
// Lines at the same axis + position are merged into one.
export function alignmentGuides(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  epsilon = 0.5,
): AlignmentGuide[] {
  const candidateXs = [
    candidate.x,
    candidate.x + candidate.width / 2,
    candidate.x + candidate.width,
  ];
  const candidateYs = [
    candidate.y,
    candidate.y + candidate.height / 2,
    candidate.y + candidate.height,
  ];
  const candidateTop = candidate.y;
  const candidateBottom = candidate.y + candidate.height;
  const candidateLeft = candidate.x;
  const candidateRight = candidate.x + candidate.width;

  // Keyed by `${axis}:${roundedPosition}` so duplicate lines (e.g. left
  // edge AND centre landing on the same x) collapse and their spans merge.
  const guides = new Map<string, AlignmentGuide>();

  const record = (axis: 'x' | 'y', position: number, start: number, end: number) => {
    const key = `${axis}:${Math.round(position)}`;
    const existing = guides.get(key);
    if (existing) {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    } else {
      guides.set(key, { axis, position, start, end });
    }
  };

  // One pass per axis (was one pass per candidate line, i.e. 3 + 3 =
  // 6 full element scans). For each element we test all three
  // candidate lines at once and accumulate that line's span. The
  // record() order (x lines in candidate order, then y lines) and the
  // min/max span accumulation are unchanged, so the output is
  // identical, two scans instead of six.
  const xStart = [candidateTop, candidateTop, candidateTop];
  const xEnd = [candidateBottom, candidateBottom, candidateBottom];
  const xMatched = [false, false, false];
  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const e0 = el.x;
    const e1 = el.x + el.width / 2;
    const e2 = el.x + el.width;
    const top = el.y;
    const bottom = el.y + el.height;
    for (let i = 0; i < 3; i++) {
      const lineX = candidateXs[i]!;
      if (
        Math.abs(e0 - lineX) <= epsilon ||
        Math.abs(e1 - lineX) <= epsilon ||
        Math.abs(e2 - lineX) <= epsilon
      ) {
        xMatched[i] = true;
        xStart[i] = Math.min(xStart[i]!, top);
        xEnd[i] = Math.max(xEnd[i]!, bottom);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    if (xMatched[i]) record('x', candidateXs[i]!, xStart[i]!, xEnd[i]!);
  }

  const yStart = [candidateLeft, candidateLeft, candidateLeft];
  const yEnd = [candidateRight, candidateRight, candidateRight];
  const yMatched = [false, false, false];
  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const e0 = el.y;
    const e1 = el.y + el.height / 2;
    const e2 = el.y + el.height;
    const left = el.x;
    const right = el.x + el.width;
    for (let i = 0; i < 3; i++) {
      const lineY = candidateYs[i]!;
      if (
        Math.abs(e0 - lineY) <= epsilon ||
        Math.abs(e1 - lineY) <= epsilon ||
        Math.abs(e2 - lineY) <= epsilon
      ) {
        yMatched[i] = true;
        yStart[i] = Math.min(yStart[i]!, left);
        yEnd[i] = Math.max(yEnd[i]!, right);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    if (yMatched[i]) record('y', candidateYs[i]!, yStart[i]!, yEnd[i]!);
  }

  return [...guides.values()];
}

// Equal-spacing ("distribution") guide: the equal gaps the moving element
// shares with its neighbours along one axis — Figma's pink equal-distance
// guides. `gap` is the matched spacing; `spans` are the gap segments to
// draw (each runs `from`->`to` along `axis` at the perpendicular `cross`),
// tick-capped so the equal gaps read at a glance. A span with its own
// `axis` is a cross-axis reference: the neighbour's existing gap on the
// OTHER axis that this axis's gap was matched to (see crossAxisGaps).
export type DistributionGuide = {
  axis: 'x' | 'y';
  gap: number;
  spans: DistributionSpan[];
};

export type DistributionSpan = { from: number; to: number; cross: number; axis?: 'x' | 'y' };

type DistAxisSpan = { from: number; to: number } | (DistributionSpan & { axis: 'x' | 'y' });
type DistAxisResult = { delta: number; gap: number; spans: DistAxisSpan[] };

// The other elements' edges, one array per edge, read along one axis: `low` / `high` on it and `crossLow` /
// `crossHigh` across it. X and Y share the four arrays (X's cross edges are Y's own), so index i is the same element on
// both. Flat arrays rather than an object per element: a snap reads them thousands of times per move.
type Axis = {
  axis: 'x' | 'y';
  low: Float64Array;
  high: Float64Array;
  crossLow: Float64Array;
  crossHigh: Float64Array;
};

// Per-axis equal-spacing search. `cand` is the moving element's interval
// on the primary axis (low + size) plus its span on the cross axis;
// `items` are the other elements' intervals. Only neighbours that overlap
// the candidate on the cross axis count (so X-spacing considers a
// horizontal row, Y-spacing a vertical column). Returns the smallest snap
// within `threshold` that makes a gap equal, or null.
//
// `across` lends each item's gaps on the OTHER axis: the candidate
// sitting one of those gaps beyond item i keeps spacing consistent across
// axes (two boxes side by side, a third dropped under one of them).
function distributeAxis(
  cand: { low: number; size: number; crossLow: number; crossHigh: number },
  items: Axis,
  threshold: number,
  across: NearestNeighbours,
): DistAxisResult | null {
  const { low, high, crossLow, crossHigh } = items;
  const inRow = new Int32Array(low.length);
  let rowLength = 0;
  for (let i = 0; i < low.length; i++)
    if (crossLow[i]! < cand.crossHigh && crossHigh[i]! > cand.crossLow) inRow[rowLength++] = i;
  const row = inRow.subarray(0, rowLength);
  const cHigh = cand.low + cand.size;
  let best: DistAxisResult | null = null;
  // Whether a snap of `delta` making `gap` beats the best so far; the caller builds its spans only when it does.
  const beats = (delta: number, gap: number) =>
    !(gap < 1 || Math.abs(delta) > threshold) && (!best || Math.abs(delta) < Math.abs(best.delta));
  // The row in order of `low`, ties in row order. Sorted once, it serves both searches below.
  const sorted = sortIndices(low, row);
  // Equidistant: a neighbour P to the left and Q to the right; centre the
  // candidate in the gap so the two facing gaps are equal. The centred snap is within the threshold only for a Q whose
  // low lies within twice the threshold of 2 * cand.low + cand.size - P.high, so each P looks up just those Qs in the
  // sorted row (taking them in row order, as a scan of the whole row did) rather than pairing every P with every Q: a
  // tall lane overlaps nearly the whole board, which made each move quadratic.
  const qsStart = firstAtLeast(sorted, low, cHigh - threshold, 0);
  // Widened by a hair so rounding never drops a Q `beats` would take; `beats` still judges each exactly.
  const reach = 2 * threshold + 1e-6;
  const near: number[] = [];
  for (const p of row) {
    if (high[p]! > cand.low + threshold) continue;
    const centre = 2 * cand.low + cand.size - high[p]!;
    near.length = 0;
    for (let k = firstAtLeast(sorted, low, centre - reach, qsStart); k < sorted.length; k++) {
      if (low[sorted[k]!]! > centre + reach) break;
      near.push(sorted[k]!);
    }
    near.sort((a, b) => a - b);
    for (const q of near) {
      if (low[q]! <= high[p]!) continue;
      const gap = (low[q]! - high[p]! - cand.size) / 2;
      const targetLow = high[p]! + gap;
      if (beats(targetLow - cand.low, gap))
        best = {
          delta: targetLow - cand.low,
          gap,
          spans: [
            { from: high[p]!, to: targetLow },
            { from: targetLow + cand.size, to: low[q]! },
          ],
        };
    }
  }
  // Equal extension: an adjacent neighbour pair (P, Q) defines a gap;
  // snap the candidate one gap beyond Q (to the right) or before P (left).
  for (let i = 0; i + 1 < sorted.length; i++) {
    const p = sorted[i]!;
    const q = sorted[i + 1]!;
    if (low[q]! <= high[p]!) continue;
    const gap = low[q]! - high[p]!;
    if (cand.low + cand.size / 2 > high[q]!) {
      const targetLow = high[q]! + gap;
      if (beats(targetLow - cand.low, gap))
        best = {
          delta: targetLow - cand.low,
          gap,
          spans: [
            { from: high[p]!, to: low[q]! },
            { from: high[q]!, to: targetLow },
          ],
        };
    }
    if (cand.low + cand.size / 2 < low[p]!) {
      const targetLow = low[p]! - gap - cand.size;
      if (beats(targetLow - cand.low, gap))
        best = {
          delta: targetLow - cand.low,
          gap,
          spans: [
            { from: targetLow + cand.size, to: low[p]! },
            { from: high[p]!, to: low[q]! },
          ],
        };
    }
  }
  // Cross-axis: the neighbour N the candidate faces in this row already
  // keeps a gap on the other axis (to its nearest neighbour on each side); sit that same gap beyond (or before) N.
  const other = across.items;
  const candMid = cand.low + cand.size / 2;
  // N's gap of `gap` to neighbour M on the other axis, drawn from `from` to `to` there.
  const offer = (n: number, after: boolean, m: number, gap: number, from: number, to: number) => {
    const targetLow = after ? high[n]! + gap : low[n]! - gap - cand.size;
    if (!beats(targetLow - cand.low, gap)) return;
    // The span sits at the middle of the pair's shared extent across the other axis.
    const cross =
      (Math.max(other.crossLow[m]!, other.crossLow[n]!) +
        Math.min(other.crossHigh[m]!, other.crossHigh[n]!)) /
      2;
    best = {
      delta: targetLow - cand.low,
      gap,
      spans: [
        after ? { from: high[n]!, to: targetLow } : { from: targetLow + cand.size, to: low[n]! },
        { axis: other.axis, from, to, cross },
      ],
    };
  };
  for (const n of row) {
    const after = candMid > high[n]!;
    if (!after && !(candMid < low[n]!)) continue;
    const left = across.leftOf(n);
    if (left >= 0)
      offer(n, after, left, other.low[n]! - other.high[left]!, other.high[left]!, other.low[n]!);
    const right = across.rightOf(n);
    if (right >= 0)
      offer(n, after, right, other.low[right]! - other.high[n]!, other.high[n]!, other.low[right]!);
  }
  return best;
}

// The first position from `from` in `order` (indices sorted by `key`) whose key is at least `value`.
function firstAtLeast(order: Int32Array, key: Float64Array, value: number, from: number): number {
  let lo = from;
  let hi = order.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key[order[mid]!]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Each item's nearest neighbour on either side along `items`' axis, among the items overlapping it across (a real row
// or column): the one whose high is the greatest at most its low (left), and whose low is the least at least its high
// (right), ties to the earlier item. -1 when there is none.
type NearestNeighbours = {
  items: Axis;
  leftOf: (i: number) => number;
  rightOf: (i: number) => number;
};

// Indexed once per snap, on the first question: the cross axis cut into buckets about an item wide, each listing the
// items that reach into it sorted by high (and again by low). An item's neighbours share a bucket with it, so it looks
// in just its own buckets, walking each outward from where it stands until an item that shares its row. A walk over the
// whole board sorted by high crossed every other column's items on the way (a tall lane asks for nearly every item).
function nearestNeighbours(items: Axis): NearestNeighbours {
  const { low, high, crossLow, crossHigh } = items;
  const count = low.length;
  const shares = (i: number, j: number) =>
    j !== i && crossLow[j]! < crossHigh[i]! && crossHigh[j]! > crossLow[i]!;
  let index: {
    first: Int32Array;
    last: Int32Array;
    start: Int32Array;
    byHigh: Int32Array;
    byLow: Int32Array;
  } | null = null;
  const build = () => {
    // Buckets as wide as the average item (so each spans one or two), and never more buckets than items. Two items
    // that overlap across share a point, so they share that point's bucket: each item goes into every bucket from its
    // smaller cross edge to its larger.
    let min = Infinity;
    let max = -Infinity;
    let total = 0;
    for (let i = 0; i < count; i++) {
      min = Math.min(min, crossLow[i]!, crossHigh[i]!);
      max = Math.max(max, crossLow[i]!, crossHigh[i]!);
      total += Math.abs(crossHigh[i]! - crossLow[i]!);
    }
    const width = Math.max(total / count, (max - min) / count);
    // NaN (no extent, or edges that are not numbers) falls back to one bucket, which is a walk over every item.
    const buckets = Math.min(count, Math.floor((max - min) / width) + 1) || 1;
    const bucketOf = (c: number) => {
      const b = (c - min) / width;
      return b >= buckets ? buckets - 1 : b > 0 ? Math.floor(b) : 0;
    };
    const first = new Int32Array(count);
    const last = new Int32Array(count);
    const start = new Int32Array(buckets + 1);
    for (let i = 0; i < count; i++) {
      first[i] = bucketOf(Math.min(crossLow[i]!, crossHigh[i]!));
      last[i] = bucketOf(Math.max(crossLow[i]!, crossHigh[i]!));
      for (let b = first[i]!; b <= last[i]!; b++) start[b + 1]!++;
    }
    for (let b = 0; b < buckets; b++) start[b + 1]! += start[b]!;
    // Filled in sorted order, each bucket comes out sorted too.
    const fill = (order: Int32Array) => {
      const out = new Int32Array(start[buckets]!);
      const at = start.slice(0, buckets);
      for (const i of order) for (let b = first[i]!; b <= last[i]!; b++) out[at[b]!++] = i;
      return out;
    };
    const all = new Int32Array(count);
    for (let i = 0; i < count; i++) all[i] = i;
    // By high, ties latest first, so a walk down meets the earliest; by low, ties earliest first.
    const byLow = fill(sortIndices(low, all));
    const byHigh = fill(sortIndices(high, all.reverse()));
    return { first, last, start, byHigh, byLow };
  };
  return {
    items,
    leftOf: (i) => {
      const { first, last, start, byHigh } = (index ??= build());
      let best = -1;
      for (let b = first[i]!; b <= last[i]!; b++) {
        // The last place in this bucket whose high is at most this item's low, walking down.
        let lo = start[b]!;
        let hi = start[b + 1]!;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (high[byHigh[mid]!]! <= low[i]!) lo = mid + 1;
          else hi = mid;
        }
        for (let k = lo - 1; k >= start[b]!; k--) {
          const j = byHigh[k]!;
          // Past the best another bucket found, nothing further down beats it.
          if (best >= 0 && (high[j]! < high[best]! || (high[j] === high[best] && j > best))) break;
          if (shares(i, j)) {
            best = j;
            break;
          }
        }
      }
      return best;
    },
    rightOf: (i) => {
      const { first, last, start, byLow } = (index ??= build());
      let best = -1;
      for (let b = first[i]!; b <= last[i]!; b++) {
        // The first place in this bucket whose low is at least this item's high, walking up.
        let lo = start[b]!;
        let hi = start[b + 1]!;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (low[byLow[mid]!]! < high[i]!) lo = mid + 1;
          else hi = mid;
        }
        for (let k = lo; k < start[b + 1]!; k++) {
          const j = byLow[k]!;
          if (best >= 0 && (low[j]! > low[best]! || (low[j] === low[best] && j > best))) break;
          if (shares(i, j)) {
            best = j;
            break;
          }
        }
      }
      return best;
    },
  };
}

// A double's bits as two unsigned words, for sorting by them. Which word is the high one depends on the machine's
// byte order: 1 is 0x3ff00000 in the high word.
const bits = new Float64Array(1);
const words = new Uint32Array(bits.buffer);
bits[0] = 1;
const HIGH_WORD = +(words[1] === 0x3ff00000);
const LOW_WORD = 1 - HIGH_WORD;

// `indices` sorted by `key[index]`, ties in the order given (stable). A radix sort on the keys' bits: linear, and it
// calls no comparator, which was most of a snap's time when it sorted the board several times per move.
function sortIndices(key: Float64Array, indices: Int32Array): Int32Array {
  const n = indices.length;
  let src = Int32Array.from(indices);
  if (n < 2) return src;
  // Each key's bits, flipped so unsigned order is numeric order: a negative number's all, a positive one's sign. The
  // same pass counts each of the eight bytes' values, one table of 256 per byte.
  const lowBits = new Uint32Array(key.length);
  const highBits = new Uint32Array(key.length);
  const counts = new Int32Array(8 * 256);
  for (const i of indices) {
    bits[0] = key[i]! + 0; // -0 joins 0, as a comparator's a - b ties them
    const flip = -(words[HIGH_WORD]! >>> 31) >>> 0;
    const lowWord = (words[LOW_WORD]! ^ flip) >>> 0;
    const highWord = (words[HIGH_WORD]! ^ (flip | 0x80000000)) >>> 0;
    lowBits[i] = lowWord;
    highBits[i] = highWord;
    for (let b = 0; b < 4; b++) {
      counts[(b << 8) | ((lowWord >>> (b * 8)) & 255)]!++;
      counts[((b + 4) << 8) | ((highWord >>> (b * 8)) & 255)]!++;
    }
  }
  let dst = new Int32Array(n);
  for (let pass = 0; pass < 8; pass++) {
    const word = pass < 4 ? lowBits : highBits;
    const shift = (pass & 3) * 8;
    const base = pass << 8;
    // A byte every key shares leaves the order as it is.
    if (counts[base | ((word[src[0]!]! >>> shift) & 255)] === n) continue;
    for (let d = 0, sum = 0; d < 256; d++) {
      const c = counts[base | d]!;
      counts[base | d] = sum;
      sum += c;
    }
    for (let k = 0; k < n; k++) {
      const i = src[k]!;
      dst[counts[base | ((word[i]! >>> shift) & 255)]!++] = i;
    }
    const sortedSoFar = dst;
    dst = src;
    src = sortedSoFar;
  }
  return src;
}

// Snap a dragged element to EQUAL spacing with its neighbours (so three
// elements end up evenly spread) and report the gap segments to draw.
// Pure; mirrors snapToAlignment's shape (a dx/dy nudge) but for
// inter-element spacing rather than edge/centre alignment. Each axis is
// considered independently.
export function distributionSnap(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
): { dx: number; dy: number; guides: DistributionGuide[] } {
  const boxed = elements.filter((el): el is BoxedElement => isBoxed(el) && !excludeIds.has(el.id));
  const left = new Float64Array(boxed.length);
  const right = new Float64Array(boxed.length);
  const top = new Float64Array(boxed.length);
  const bottom = new Float64Array(boxed.length);
  boxed.forEach((el, i) => {
    left[i] = el.x;
    right[i] = el.x + el.width;
    top[i] = el.y;
    bottom[i] = el.y + el.height;
  });
  const xItems: Axis = { axis: 'x', low: left, high: right, crossLow: top, crossHigh: bottom };
  const yItems: Axis = { axis: 'y', low: top, high: bottom, crossLow: left, crossHigh: right };
  // X-spacing borrows an element's vertical gaps and Y-spacing its horizontal ones.
  const xs = distributeAxis(
    {
      low: candidate.x,
      size: candidate.width,
      crossLow: candidate.y,
      crossHigh: candidate.y + candidate.height,
    },
    xItems,
    threshold,
    nearestNeighbours(yItems),
  );
  const ys = distributeAxis(
    {
      low: candidate.y,
      size: candidate.height,
      crossLow: candidate.x,
      crossHigh: candidate.x + candidate.width,
    },
    yItems,
    threshold,
    nearestNeighbours(xItems),
  );
  const dx = xs?.delta ?? 0;
  const dy = ys?.delta ?? 0;
  const guides: DistributionGuide[] = [];
  if (xs) {
    const cross = candidate.y + dy + candidate.height / 2;
    guides.push({ axis: 'x', gap: xs.gap, spans: xs.spans.map((s) => withCross(s, cross)) });
  }
  if (ys) {
    const cross = candidate.x + dx + candidate.width / 2;
    guides.push({ axis: 'y', gap: ys.gap, spans: ys.spans.map((s) => withCross(s, cross)) });
  }
  return { dx, dy, guides };
}

// A same-axis span is drawn through the candidate's (snapped) middle; a
// cross-axis reference span already knows where its own pair sits.
function withCross(s: DistAxisSpan, cross: number): DistributionSpan {
  return 'axis' in s ? s : { ...s, cross };
}
