// Where a paste lands (docs/specs/008-canvas/canvas-and-palette.md Clipboard), for every product's editor: the copies
// land PASTE_OFFSET down and right of the originals, and a paste that would land OUT OF VIEW lands in the middle of
// the view instead. Copied on one tab (or one slide) and pasted on another, the copies' own spot is wherever they sat
// on the source, which is rarely where the person is looking. Each editor measures with its own model's geometry
// (elementBounds, endpointPosition), so this reads nothing of a product's element union.

type Box = { x: number; y: number; width: number; height: number };
// An arrow end: free, pinned to an element, or hung off another arrow.
type End = { kind: string; elementId?: string; arrowId?: string };

// The existing paste / duplicate offset.
export const PASTE_OFFSET = 24;

// How a product measures its elements: an element's box, and where an arrow end sits, both against the copied set.
export type PasteGeometry<E, P extends End> = {
  elementBounds: (el: E, all: E[]) => Box;
  endpointPosition: (end: P, all: E[]) => { x: number; y: number };
};

// The box around what the paste moves: the copied boxes, and each copied arrow's ends that are free or held by
// something in the copy. An end pinned to an element left behind does not move with the paste (and would resolve to
// the origin against the copy alone), so it is not measured.
export function pasteBounds<E extends { id: string; type: string }, P extends End>(
  source: readonly E[],
  geometry: PasteGeometry<E, P>,
): Box | null {
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
  const endsOf = (el: E | undefined) =>
    el?.type === 'arrow' ? (el as unknown as { from: P; to: P }) : null;
  // An end is held when what it rests on is in the copy, all the way down: an end on an arrow is held only when that
  // arrow's own ends are, or its point would be measured through an element left behind ({0, 0}) and stretch the
  // box towards the origin. `seen` stops a loop of arrows on each other.
  const byId = new Map(all.map((e) => [e.id, e]));
  const held = (end: P, seen: ReadonlySet<string> = new Set()): boolean => {
    if (end.kind === 'free') return true;
    if (end.kind === 'pinned') return end.elementId !== undefined && ids.has(end.elementId);
    if (end.kind !== 'on-arrow' || end.arrowId === undefined) return false;
    if (!ids.has(end.arrowId) || seen.has(end.arrowId)) return false;
    const on = endsOf(byId.get(end.arrowId));
    if (!on) return false;
    const next = new Set(seen).add(end.arrowId);
    return held(on.from, next) && held(on.to, next);
  };
  for (const el of all) {
    const arrow = endsOf(el);
    if (!arrow) {
      const r = geometry.elementBounds(el, all);
      take(r.x, r.y, r.x + r.width, r.y + r.height);
      continue;
    }
    for (const end of [arrow.from, arrow.to]) {
      if (!held(end)) continue;
      const p = geometry.endpointPosition(end, all);
      take(p.x, p.y, p.x, p.y);
    }
  }
  const b = box as { x0: number; y0: number; x1: number; y1: number } | null;
  return b && { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 };
}

// Keep the usual offset when the copies' centre (`box`, from pasteBounds) lands in view; otherwise move them so their
// centre is the view's, on whole pixels so edges stay crisp.
export function landInView(
  box: Box | null,
  dx: number,
  dy: number,
  view: Box | null,
): { dx: number; dy: number } {
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
