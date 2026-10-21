// Which drags on an event-storming board meet its timeline lanes (docs/specs/021-event-storming/event-storming.md
// "Always on a lane"), and which dragged note they snap by. Pure, so the drag hook asks once per gesture.
import { isEventStormingNote, type Element } from '@livediagram/document';

// The dragged elements, in one pass over the board (a selection may be large).
function draggedOf(elements: readonly Element[], ids: ReadonlySet<string>): Element[] {
  return elements.filter((el) => ids.has(el.id));
}

// The lanes apply when the drag holds a workshop note (so it stays on a lane, and a label, a frame or anything else
// moved with it travels by the same delta), or when every dragged element is a sticky (a plain sticky keeps the
// lanes as an aid).
export function lanesHoldDrag(elements: readonly Element[], ids: ReadonlySet<string>): boolean {
  const dragged = draggedOf(elements, ids);
  if (dragged.length === 0) return false;
  return (
    dragged.some((el) => isEventStormingNote(el)) || dragged.every((el) => el.type === 'sticky')
  );
}

// The note the move snaps by: the one in hand when it is a workshop note, else the first workshop note in the
// selection, so every workshop note in it stays on a lane; null when there is none.
export function laneAnchorOf(
  elements: readonly Element[],
  primaryId: string,
  ids: ReadonlySet<string>,
): string | null {
  const workshop = new Set(
    draggedOf(elements, ids)
      .filter((el) => isEventStormingNote(el))
      .map((el) => el.id),
  );
  if (workshop.has(primaryId)) return primaryId;
  for (const id of ids) if (workshop.has(id)) return id;
  return null;
}
