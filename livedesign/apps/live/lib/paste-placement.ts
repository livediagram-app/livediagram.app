import {
  elementBounds,
  endpointPosition,
  type Element,
  type Endpoint,
  type Rect,
} from '@livedesign/design';

// Where a paste lands (docs/specs/008-canvas/canvas-and-palette.md Clipboard). Pure, so the rule is one
// testable answer rather than a pile of conditions inside the clipboard hook.
//
// The copies land 24px down and right of the originals. A paste that would land OUT OF VIEW lands in the middle of the view instead:
// copied on one tab (or one slide) and pasted on another, the copies' own spot
// is wherever they sat on the source, which is rarely where the person is looking
// (docs/specs/008-canvas/canvas-and-palette.md Clipboard).

// The existing paste / duplicate offset.
export const PASTE_OFFSET = 24;

// Keep the usual offset when the copies' centre lands in view; otherwise move
// them so their centre is the view's, on whole pixels so edges stay crisp.
export function pasteTranslation(
  source: readonly Element[],
  view: Rect | null = null,
): { dx: number; dy: number } {
  const dx = PASTE_OFFSET;
  const dy = PASTE_OFFSET;
  const box = sourceBounds(source);
  if (!view || !box) return { dx, dy };
  const cx = box.x + box.width / 2 + dx;
  const cy = box.y + box.height / 2 + dy;
  const inView =
    cx >= view.x && cx <= view.x + view.width && cy >= view.y && cy <= view.y + view.height;
  if (inView) return { dx, dy };
  return {
    dx: Math.round(view.x + view.width / 2 - (box.x + box.width / 2)),
    dy: Math.round(view.y + view.height / 2 - (box.y + box.height / 2)),
  };
}

// The box around what the paste moves: the copied boxes, and each copied arrow's ends that are free
// or held by something in the copy. An end pinned to an element left behind does not move with the
// paste (and would resolve to the origin against the copy alone), so it is not measured.
function sourceBounds(source: readonly Element[]): Rect | null {
  const all = [...source];
  const ids = new Set(all.map((el) => el.id));
  let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const take = (x0: number, y0: number, x1: number, y1: number) => {
    box = box
      ? {
          x0: Math.min(box.x0, x0),
          y0: Math.min(box.y0, y0),
          x1: Math.max(box.x1, x1),
          y1: Math.max(box.y1, y1),
        }
      : { x0, y0, x1, y1 };
  };
  // An end is held when what it rests on is in the copy, all the way down: an end on an arrow is held only when that
  // arrow's own ends are, or its point would be measured through an element left behind ({0, 0}) and stretch the
  // box towards the origin. `seen` stops a loop of arrows on each other.
  const byId = new Map(all.map((e) => [e.id, e]));
  const held = (end: Endpoint, seen: ReadonlySet<string> = new Set()): boolean => {
    if (end.kind === 'free') return true;
    if (end.kind === 'pinned') return ids.has(end.elementId);
    if (end.kind !== 'on-arrow' || !ids.has(end.arrowId) || seen.has(end.arrowId)) return false;
    const on = byId.get(end.arrowId);
    if (on?.type !== 'arrow') return false;
    const next = new Set(seen).add(end.arrowId);
    return held(on.from, next) && held(on.to, next);
  };
  for (const el of all) {
    if (el.type !== 'arrow') {
      const r = elementBounds(el, all);
      take(r.x, r.y, r.x + r.width, r.y + r.height);
      continue;
    }
    for (const end of [el.from, el.to]) {
      if (!held(end)) continue;
      const p = endpointPosition(end, all);
      take(p.x, p.y, p.x, p.y);
    }
  }
  const b = box as { x0: number; y0: number; x1: number; y1: number } | null;
  return b && { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 };
}
