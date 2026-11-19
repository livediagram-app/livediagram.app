// Where an update puts the boxes its files add (docs/specs/020-import-export/infrastructure-import.md "Updating a tab
// from its files", blueprint "mergeSourceGraph" step 5): beside the first neighbour already on the tab, at the offset
// the fresh layout gives the two; joining none, in one block to the right of the drawing that keeps the fresh layout;
// then down until it overlaps nothing. Frames that gain members grow to hold them.

import type { BoxedElement } from '../element-union';
import { FRAME_GROW_PAD, PLACE_GAP } from './limits';

export type Rect = { x: number; y: number; width: number; height: number };

const overlaps = (a: Rect, b: Rect, margin: number) =>
  a.x < b.x + b.width + margin &&
  b.x < a.x + a.width + margin &&
  a.y < b.y + b.height + margin &&
  b.y < a.y + a.height + margin;

export function unionOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width);
    y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Positions for the added boxes, by key. `onTab(key)` is a kept box's rect; `fresh(key)` any box's rect in the fresh
 * layout; `neighbours` each key's neighbours by a fresh edge, then its group's members; `obstacles` every box on the
 * result that a placed box must clear (frames excluded).
 */
export function placeAdded(opts: {
  added: readonly string[];
  fresh: (key: string) => Rect | undefined;
  onTab: (key: string) => Rect | undefined;
  neighbours: ReadonlyMap<string, readonly string[]>;
  obstacles: readonly Rect[];
}): Map<string, Rect> {
  const placed = new Map<string, Rect>();
  const rectOf = (key: string) => opts.onTab(key) ?? placed.get(key);
  const blocked: Rect[] = [...opts.obstacles];
  // Down past every box it overlaps, until it overlaps none: at most one step per obstacle.
  const clear = (r: Rect): Rect => {
    let rect = r;
    for (let step = 0; step <= blocked.length; step++) {
      let bottom = -Infinity;
      for (const b of blocked)
        if (overlaps(rect, b, PLACE_GAP / 2)) bottom = Math.max(bottom, b.y + b.height);
      if (bottom === -Infinity) break;
      rect = { ...rect, y: bottom + PLACE_GAP / 2 };
    }
    return rect;
  };
  const settle = (key: string, r: Rect) => {
    const rect = clear(r);
    placed.set(key, rect);
    blocked.push(rect);
  };

  // Anchored boxes, pass after pass while one more finds a neighbour already placed.
  let waiting = opts.added.filter((k) => opts.fresh(k) !== undefined);
  for (let progress = true; progress && waiting.length > 0;) {
    progress = false;
    const still: string[] = [];
    for (const key of waiting) {
      const anchor = (opts.neighbours.get(key) ?? []).find((n) => rectOf(n) && opts.fresh(n));
      if (anchor === undefined) {
        still.push(key);
        continue;
      }
      const own = opts.fresh(key)!;
      const at = rectOf(anchor)!;
      const was = opts.fresh(anchor)!;
      settle(key, { ...own, x: at.x + own.x - was.x, y: at.y + own.y - was.y });
      progress = true;
    }
    waiting = still;
  }

  // The rest, one block right of the drawing, top-aligned with it, keeping its fresh layout (I8).
  if (waiting.length > 0) {
    const drawing = unionOf(blocked);
    const block = unionOf(waiting.map((k) => opts.fresh(k)!))!;
    const left = drawing ? drawing.x + drawing.width + PLACE_GAP : block.x;
    const top = drawing ? drawing.y : block.y;
    for (const key of waiting) {
      const own = opts.fresh(key)!;
      settle(key, { ...own, x: left + own.x - block.x, y: top + own.y - block.y });
    }
  }
  return placed;
}

/** A new frame's rect: its members' bounds on the result, with the insets its fresh frame had round its members. */
export function frameRect(fresh: Rect, freshMembers: readonly Rect[], members: readonly Rect[]) {
  const was = unionOf(freshMembers);
  const now = unionOf(members);
  if (!was || !now) return null;
  const left = was.x - fresh.x;
  const top = was.y - fresh.y;
  const right = fresh.x + fresh.width - (was.x + was.width);
  const bottom = fresh.y + fresh.height - (was.y + was.height);
  return {
    x: now.x - left,
    y: now.y - top,
    width: now.width + left + right,
    height: now.height + top + bottom,
  };
}

/** A kept frame grown to hold boxes added to its group, each with FRAME_GROW_PAD round it. */
export function grownFrame<F extends BoxedElement>(frame: F, members: readonly Rect[]): F {
  const grown = unionOf([
    frame,
    ...members.map((m) => ({
      x: m.x - FRAME_GROW_PAD,
      y: m.y - FRAME_GROW_PAD,
      width: m.width + 2 * FRAME_GROW_PAD,
      height: m.height + 2 * FRAME_GROW_PAD,
    })),
  ])!;
  if (
    grown.x === frame.x &&
    grown.y === frame.y &&
    grown.width === frame.width &&
    grown.height === frame.height
  )
    return frame;
  return { ...frame, ...grown };
}
