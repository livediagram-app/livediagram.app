import { isBoxed, type BoxedElement, type Element, type ElementId } from './index';

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
// tick-capped so the equal gaps read at a glance.
export type DistributionGuide = {
  axis: 'x' | 'y';
  gap: number;
  spans: { from: number; to: number; cross: number }[];
};

type DistAxisItem = { low: number; high: number; crossLow: number; crossHigh: number };
type DistAxisResult = { delta: number; gap: number; spans: { from: number; to: number }[] };

// Per-axis equal-spacing search. `cand` is the moving element's interval
// on the primary axis (low + size) plus its span on the cross axis;
// `items` are the other elements' intervals. Only neighbours that overlap
// the candidate on the cross axis count (so X-spacing considers a
// horizontal row, Y-spacing a vertical column). Returns the smallest snap
// within `threshold` that makes a gap equal, or null.
function distributeAxis(
  cand: { low: number; size: number; crossLow: number; crossHigh: number },
  items: DistAxisItem[],
  threshold: number,
): DistAxisResult | null {
  const row = items.filter((n) => n.crossLow < cand.crossHigh && n.crossHigh > cand.crossLow);
  const cHigh = cand.low + cand.size;
  let best: DistAxisResult | null = null;
  const consider = (delta: number, gap: number, spans: { from: number; to: number }[]) => {
    if (gap < 1 || Math.abs(delta) > threshold) return;
    if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, gap, spans };
  };
  // Equidistant: a neighbour P to the left and Q to the right; centre the
  // candidate in the gap so the two facing gaps are equal.
  for (const P of row) {
    if (P.high > cand.low + threshold) continue;
    for (const Q of row) {
      if (Q.low < cHigh - threshold || Q.low <= P.high) continue;
      const gap = (Q.low - P.high - cand.size) / 2;
      const targetLow = P.high + gap;
      consider(targetLow - cand.low, gap, [
        { from: P.high, to: targetLow },
        { from: targetLow + cand.size, to: Q.low },
      ]);
    }
  }
  // Equal extension: an adjacent neighbour pair (P, Q) defines a gap;
  // snap the candidate one gap beyond Q (to the right) or before P (left).
  const sorted = [...row].sort((a, b) => a.low - b.low);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const P = sorted[i]!;
    const Q = sorted[i + 1]!;
    if (Q.low <= P.high) continue;
    const gap = Q.low - P.high;
    if (cand.low + cand.size / 2 > Q.high) {
      const targetLow = Q.high + gap;
      consider(targetLow - cand.low, gap, [
        { from: P.high, to: Q.low },
        { from: Q.high, to: targetLow },
      ]);
    }
    if (cand.low + cand.size / 2 < P.low) {
      const targetLow = P.low - gap - cand.size;
      consider(targetLow - cand.low, gap, [
        { from: targetLow + cand.size, to: P.low },
        { from: P.high, to: Q.low },
      ]);
    }
  }
  return best;
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
  const xs = distributeAxis(
    {
      low: candidate.x,
      size: candidate.width,
      crossLow: candidate.y,
      crossHigh: candidate.y + candidate.height,
    },
    boxed.map((el) => ({
      low: el.x,
      high: el.x + el.width,
      crossLow: el.y,
      crossHigh: el.y + el.height,
    })),
    threshold,
  );
  const ys = distributeAxis(
    {
      low: candidate.y,
      size: candidate.height,
      crossLow: candidate.x,
      crossHigh: candidate.x + candidate.width,
    },
    boxed.map((el) => ({
      low: el.y,
      high: el.y + el.height,
      crossLow: el.x,
      crossHigh: el.x + el.width,
    })),
    threshold,
  );
  const dx = xs?.delta ?? 0;
  const dy = ys?.delta ?? 0;
  const guides: DistributionGuide[] = [];
  if (xs) {
    const cross = candidate.y + dy + candidate.height / 2;
    guides.push({ axis: 'x', gap: xs.gap, spans: xs.spans.map((s) => ({ ...s, cross })) });
  }
  if (ys) {
    const cross = candidate.x + dx + candidate.width / 2;
    guides.push({ axis: 'y', gap: ys.gap, spans: ys.spans.map((s) => ({ ...s, cross })) });
  }
  return { dx, dy, guides };
}
