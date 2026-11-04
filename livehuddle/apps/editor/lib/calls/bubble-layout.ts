// Camera and screen bubbles of people standing close (docs/specs/012-collaboration/video-and-screen-bubbles.md
// "Close together", blueprint "Presentation and UX"): the pure half. Bubbles at about the same height share a row,
// keep their people's left-to-right order (with a little stickiness, so two people walking past each other do not
// make their bubbles flicker sides), and are packed apart as little as they can be. No React, no DOM.

/** Canvas px between two bubbles: a person's camera and screen, and two people's. */
export const BUBBLE_GAP_PX = 8;
/** How far two people must cross, in canvas px, before their bubbles swap sides. */
export const BUBBLE_SWAP_PX = 24;
/** How long a nudge or a swap slides for. */
export const BUBBLE_NUDGE_MS = 220;
/** The tail keeps this far from a row's ends, so it never rides onto a rounded corner. */
export const BUBBLE_TAIL_INSET_PX = 14;

/** One person's bubbles as a box, in canvas px: centred on `x` (their head), its bottom edge at `bottom`. */
export type BubbleBox = { id: string; x: number; bottom: number; width: number; height: number };
/** A laid-out row of one person's bubbles, in canvas px. */
export type BubbleRect = { left: number; top: number; right: number; bottom: number };

export type BubbleLayout = {
  // How far each person's bubbles moved sideways from above their head.
  dx: ReadonlyMap<string, number>;
  // Where each one ended up, for whatever must keep clear of them (speech bubbles).
  rects: BubbleRect[];
  // The left-to-right order used, row by row: the next layout's `prevOrder`.
  order: string[];
};

/** The width of a row of `count` bubbles each `width` wide. */
export function groupWidth(count: number, width: number): number {
  return count * width + Math.max(0, count - 1) * BUBBLE_GAP_PX;
}

/** Where the tail sits off a row's centre: back over the head, held inside the row's ends. */
export function tailShift(dx: number, width: number): number {
  const reach = Math.max(0, width / 2 - BUBBLE_TAIL_INSET_PX);
  // `+ 0` turns a negative zero into a plain one.
  return Math.min(reach, Math.max(-reach, -dx)) + 0;
}

// Boxes whose tops and bottoms come within BUBBLE_GAP_PX of each other, chained, share a row.
function rowsOf(boxes: readonly BubbleBox[]): BubbleBox[][] {
  const byTop = [...boxes].sort((a, b) => a.bottom - a.height - (b.bottom - b.height));
  const rows: BubbleBox[][] = [];
  let lowest = -Infinity;
  for (const box of byTop) {
    const top = box.bottom - box.height;
    if (rows.length === 0 || top >= lowest + BUBBLE_GAP_PX) {
      rows.push([box]);
      lowest = box.bottom;
    } else {
      rows[rows.length - 1]!.push(box);
      lowest = Math.max(lowest, box.bottom);
    }
  }
  return rows;
}

// The row's left-to-right order: the previous one kept, a newcomer put in by x, and a pair swapped only once the
// left one is BUBBLE_SWAP_PX past the other (any inversion, for a newcomer). At most n² adjacent swaps; n is capped
// by the bubbles received (6 cameras, 2 screens and your own).
function orderOf(row: readonly BubbleBox[], rank: ReadonlyMap<string, number>): BubbleBox[] {
  const known = row.filter((b) => rank.has(b.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const order = [...known];
  for (const box of row.filter((b) => !rank.has(b.id)).sort((a, b) => a.x - b.x)) {
    const at = order.findIndex((o) => o.x > box.x);
    order.splice(at === -1 ? order.length : at, 0, box);
  }
  for (let swapped = true; swapped;) {
    swapped = false;
    for (let i = 1; i < order.length; i++) {
      const left = order[i - 1]!;
      const right = order[i]!;
      const margin = rank.has(left.id) && rank.has(right.id) ? BUBBLE_SWAP_PX : 0;
      if (left.x - right.x > margin) {
        order[i - 1] = right;
        order[i] = left;
        swapped = true;
      }
    }
  }
  return order;
}

// Packs an ordered row BUBBLE_GAP_PX apart, moving each box as little as the others: clusters of touching boxes,
// each placed where the sum of its members' squared moves is least (the mean of their wanted lefts less their
// offsets in it), merged with the one before while they come within the gap. Answers each box's left edge.
function pack(order: readonly BubbleBox[]): number[] {
  type Cluster = { first: number; count: number; width: number; sum: number };
  const clusters: Cluster[] = [];
  order.forEach((box, i) => {
    let next: Cluster = { first: i, count: 1, width: box.width, sum: box.x - box.width / 2 };
    for (;;) {
      const prev = clusters.at(-1);
      if (!prev || prev.sum / prev.count + prev.width + BUBBLE_GAP_PX <= next.sum / next.count)
        break;
      clusters.pop();
      const offset = prev.width + BUBBLE_GAP_PX;
      next = {
        first: prev.first,
        count: prev.count + next.count,
        width: offset + next.width,
        sum: prev.sum + next.sum - next.count * offset,
      };
    }
    clusters.push(next);
  });
  const lefts: number[] = [];
  for (const c of clusters) {
    let left = c.sum / c.count;
    for (let i = c.first; i < c.first + c.count; i++) {
      lefts.push(left);
      left += order[i]!.width + BUBBLE_GAP_PX;
    }
  }
  return lefts;
}

/** Lays out every person's bubbles so none covers another; `prevOrder` is the last layout's `order`. */
export function layoutBubbles(
  boxes: readonly BubbleBox[],
  prevOrder: readonly string[],
): BubbleLayout {
  const rank = new Map(prevOrder.map((id, i) => [id, i]));
  const dx = new Map<string, number>();
  const rects: BubbleRect[] = [];
  const order: string[] = [];
  for (const row of rowsOf(boxes)) {
    const ordered = orderOf(row, rank);
    const lefts = pack(ordered);
    ordered.forEach((box, i) => {
      const left = lefts[i]!;
      dx.set(box.id, left + box.width / 2 - box.x);
      rects.push({
        left,
        top: box.bottom - box.height,
        right: left + box.width,
        bottom: box.bottom,
      });
      order.push(box.id);
    });
  }
  return { dx, rects, order };
}
