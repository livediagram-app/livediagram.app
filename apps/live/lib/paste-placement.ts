import {
  isBoxed,
  isEventStormingNote,
  isEventStormingTab,
  landArrivals,
  type Element,
  type ElementId,
  type Tab,
} from '@livediagram/diagram';

// Where a paste lands (docs/specs/021-event-storming/event-storming.md "Always on a lane", docs/specs/008-canvas/canvas-and-palette.md
// Clipboard). Pure, so the rule is one testable answer rather than a pile of
// conditions inside the clipboard hook.
//
// Off an event-storming board, or for a paste with no workshop note in it,
// nothing changes: the copies land 24px down and right of the originals. On a
// board of lanes a paste holding a workshop note lands AT THE POINTER when the
// pointer is over the canvas, and otherwise staggers on the original along
// its lane (24px right, same lane). Either way the copies then land on lanes.

// The existing paste / duplicate offset.
export const PASTE_OFFSET = 24;

type BoardLike = Pick<Tab, 'elements'> & Partial<Pick<Tab, 'kind' | 'layers'>>;

export function pasteTranslation(
  source: readonly Element[],
  board: BoardLike,
  pointer: { x: number; y: number } | null,
): { dx: number; dy: number; atPointer: boolean } {
  if (!isEventStormingTab(board) || !source.some(isEventStormingNote)) {
    return { dx: PASTE_OFFSET, dy: PASTE_OFFSET, atPointer: false };
  }
  if (!pointer) return { dx: PASTE_OFFSET, dy: 0, atPointer: false };
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
