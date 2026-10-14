import {
  elementBounds,
  endpointPosition,
  isBoxed,
  isEventStormingNote,
  isEventStormingTab,
  landArrivals,
  type Element,
  type ElementId,
  type Tab,
} from '@livediagram/document';

// Where a paste lands (docs/specs/021-event-storming/event-storming.md "Always on a lane", docs/specs/008-canvas/canvas-and-palette.md
// Clipboard). Pure, so the rule is one testable answer rather than a pile of
// conditions inside the clipboard hook.
//
// Off an event-storming board, or for a paste with no workshop note in it,
// nothing changes: the copies land 24px down and right of the originals. On a
// board of lanes a paste holding a workshop note lands AT THE POINTER when the
// pointer is over the canvas, and otherwise staggers on the original along
// its lane (24px right, same lane). Either way the copies then land on lanes.
//
// A paste that would land OUT OF VIEW lands in the middle of the view instead:
// copied on one tab (or one slide) and pasted on another, the copies' own spot
// is wherever they sat on the source, which is rarely where the person is looking
// (docs/specs/008-canvas/canvas-and-palette.md Clipboard).

// The existing paste / duplicate offset.
export const PASTE_OFFSET = 24;

type BoardLike = Pick<Tab, 'elements'> & Partial<Pick<Tab, 'kind' | 'layers'>>;

type ViewRect = { x: number; y: number; width: number; height: number };

export function pasteTranslation(
  source: readonly Element[],
  board: BoardLike,
  pointer: { x: number; y: number } | null,
  view: ViewRect | null = null,
): { dx: number; dy: number; atPointer: boolean } {
  if (!isEventStormingTab(board) || !source.some(isEventStormingNote)) {
    return intoView(source, PASTE_OFFSET, PASTE_OFFSET, view);
  }
  if (!pointer) return intoView(source, PASTE_OFFSET, 0, view);
  const boxed = source.filter(isBoxed);
  const left = Math.min(...boxed.map((el) => el.x));
  const top = Math.min(...boxed.map((el) => el.y));
  const right = Math.max(...boxed.map((el) => el.x + el.width));
  const bottom = Math.max(...boxed.map((el) => el.y + el.height));
  return {
    dx: pointer.x - (left + right) / 2,
    dy: pointer.y - (top + bottom) / 2,
    atPointer: true,
  };
}

// Keep the usual offset when the copies' centre lands in view; otherwise move
// them so their centre is the view's, on whole pixels so edges stay crisp.
function intoView(
  source: readonly Element[],
  dx: number,
  dy: number,
  view: ViewRect | null,
): { dx: number; dy: number; atPointer: false } {
  const box = sourceBounds(source);
  if (!view || !box) return { dx, dy, atPointer: false };
  const cx = box.x + box.width / 2 + dx;
  const cy = box.y + box.height / 2 + dy;
  const inView =
    cx >= view.x && cx <= view.x + view.width && cy >= view.y && cy <= view.y + view.height;
  if (inView) return { dx, dy, atPointer: false };
  return {
    dx: Math.round(view.x + view.width / 2 - (box.x + box.width / 2)),
    dy: Math.round(view.y + view.height / 2 - (box.y + box.height / 2)),
    atPointer: false,
  };
}

// The box around what the paste moves: the copied boxes, and each copied arrow's ends that are free
// or held by something in the copy. An end pinned to an element left behind does not move with the
// paste (and would resolve to the origin against the copy alone), so it is not measured.
function sourceBounds(source: readonly Element[]): ViewRect | null {
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
  for (const el of all) {
    if (el.type !== 'arrow') {
      const r = elementBounds(el, all);
      take(r.x, r.y, r.x + r.width, r.y + r.height);
      continue;
    }
    for (const end of [el.from, el.to]) {
      const held =
        end.kind === 'free' ||
        (end.kind === 'pinned' && ids.has(end.elementId)) ||
        (end.kind === 'on-arrow' && ids.has(end.arrowId));
      if (!held) continue;
      const p = endpointPosition(end, all);
      take(p.x, p.y, p.x, p.y);
    }
  }
  const b = box as { x0: number; y0: number; x1: number; y1: number } | null;
  return b && { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 };
}

// Land the copies once they are on the board. One note pasted at the pointer
// is placed exactly as a note dropped there (lane, slot, occupied spot); a
// block, or a staggered copy, keeps its x and takes a lane per row.
export function landPastedCopies(
  elements: Element[],
  copyIds: ReadonlySet<ElementId>,
  atPointer: boolean,
): Element[] {
  const notes = elements.filter((el) => copyIds.has(el.id) && isEventStormingNote(el));
  return landArrivals(elements, copyIds, {
    x: atPointer && notes.length === 1 ? 'capture' : 'keep',
  });
}
