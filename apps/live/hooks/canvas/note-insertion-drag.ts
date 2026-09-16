import { isBoxed, type Element } from '@livediagram/diagram';
import { dragClusterIds, isSingleNoteDrag } from './note-dock-drag';
import type { ShapeBounds } from '@/lib/canvas';
import {
  canInsertBetweenOn,
  findInsertionSlot,
  type InsertionGate,
  type InsertionSlot,
} from '@/lib/insert-between';

// Inserting a note that is ALREADY on the board between two others (spec/139)
// — the second entry point of the Alt gesture, beside the palette drag. The
// drag people do most is moving a note they have already placed, so this is
// where the gesture earns its keep.
//
// Pure, so the whole eligibility question is one testable answer rather than a
// pile of conditions inside the pointer-move handler. Nothing here writes: the
// caller decides what to do with the slot, and the ripple stays a render-time
// preview until the drop.

type NoteInsertionInput = {
  // What the board and session allow; the modifier is the other half.
  gate: InsertionGate;
  altHeld: boolean;
  // Shift already means drag-duplicate (spec/80), so it wins outright.
  shiftHeld: boolean;
  elements: Element[];
  primaryId: string;
  // Every dragged element's pre-drag bounds. More than one means a
  // multi-selection drag, which never inserts.
  startBounds: ReadonlyMap<string, ShapeBounds>;
  // Pointer travel so far, in canvas units.
  dx: number;
  dy: number;
  // Elements on a hidden or locked layer (spec/74): they can't define the row
  // but still travel with the ripple.
  inertIds: ReadonlySet<string>;
  // The slot currently on offer, fed back in so it survives a shaky hand.
  active: InsertionSlot | null;
};

export function resolveNoteInsertion({
  gate,
  altHeld,
  shiftHeld,
  elements,
  primaryId,
  startBounds,
  dx,
  dy,
  inertIds,
  active,
}: NoteInsertionInput): InsertionSlot | null {
  if (!canInsertBetweenOn(gate, altHeld)) return null;
  // Drag-duplicate is already holding this gesture; two meanings on one drag
  // would make both unpredictable.
  if (shiftHeld) return null;
  // One note at a time — alone, or carrying what is docked to it. A
  // multi-selection has no single thing to insert, and the gesture is about
  // the note grammar rather than the canvas at large: a shape, an icon or an
  // arrow drags exactly as it always has.
  if (!isSingleNoteDrag(elements, primaryId, startBounds)) return null;
  const dragged = elements.find((el) => el.id === primaryId);
  if (!dragged || !isBoxed(dragged)) return null;
  const start = startBounds.get(primaryId);
  if (!start) return null;

  // Aim with the NOTE, not the grab point: what decides the gap is where the
  // note itself is heading, which is what the author can see. Derived from the
  // raw pointer travel rather than the note's live position, so sitting the
  // note in an open slot can't feed back into resolving the next one.
  return findInsertionSlot({
    cursorX: start.x + dx + start.width / 2,
    cursorY: start.y + dy + start.height / 2,
    incomingWidth: start.width,
    elements,
    inertIds,
    // A host drags its cluster, and a cluster is one thing to insert.
    excludeIds: dragClusterIds(elements, primaryId),
    active,
  });
}

// The dragged note, sitting IN the slot the board has opened rather than under
// the raw cursor — the same promise the palette ghost makes, so what the
// author sees mid-drag is exactly what the drop commits. It can never fight
// the hand: the slot only stays open while the note's centre is within the gap
// (plus the hysteresis margin), so the note is never far from where it snaps.
export function landNoteInSlot(
  elements: Element[],
  noteId: string,
  slot: InsertionSlot,
): Element[] {
  return elements.map((el) => {
    if (el.id !== noteId || !isBoxed(el)) return el;
    return { ...el, x: slot.atX, y: slot.atY - el.height / 2 };
  });
}
