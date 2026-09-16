import {
  dockedBounds,
  ES_DOCK_SEAM_PX,
  eventStormingKindOf,
  isBoxed,
  type Element,
  type ElementId,
  type EsDockSide,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { travellingIdsFrom, type InsertionSlot } from '@/lib/insert-between';

// Where an anchor-added note goes, and what has to stand aside for it
// (spec/139 Phase 7). Pure, so the whole decision is one testable answer
// rather than a pile of conditions inside a commit.
//
// The board OPENS rather than refusing: if the docked footprint lands on
// something, the shipped insertion ripple makes room in the same commit, so
// the author sees the board behave exactly as the Alt gesture taught them.

export type DockAddPlan = {
  kind: EventStormingNoteKind;
  // Where the note lands, AFTER any ripple.
  bounds: { x: number; y: number; width: number; height: number };
  // The room to make first, or null when the spot is already free.
  ripple: InsertionSlot | null;
};

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function planDockAdd(
  elements: Element[],
  hostId: ElementId,
  side: EsDockSide,
  kind: EventStormingNoteKind,
  // Elements on a hidden or locked layer (spec/74): invisible, so they cannot
  // be what the board opens around — but they travel with the ripple, exactly
  // as they do for the Alt insertion.
  inertIds: ReadonlySet<ElementId> = new Set(),
): DockAddPlan | null {
  const host = elements.find((el) => el.id === hostId);
  if (!host || !isBoxed(host) || !eventStormingKindOf(host)) return null;
  const bounds = dockedBounds(host, side, kind);

  const collides = elements.some(
    (el) => isBoxed(el) && el.id !== hostId && !inertIds.has(el.id) && overlaps(bounds, el),
  );
  if (!collides) return { kind, bounds, ripple: null };

  // Where the board splits. For an AFTER face the note's own spot is the
  // point, and the host stays put. For a BEFORE face the point is the HOST's
  // left edge: the host and everything after it travel, vacating exactly the
  // width + seam the new note needs, and whatever sits to the left of the host
  // is left alone rather than pushed into the note's way.
  const atX = side === 'before' ? host.x : bounds.x;
  const shiftDx = bounds.width + ES_DOCK_SEAM_PX;
  const shiftedIds = [...travellingIdsFrom(elements, atX)];
  if (shiftedIds.length === 0) return { kind, bounds, ripple: null };

  return {
    kind,
    // The host moves with the ripple when the face is BEFORE it, so the note's
    // landing spot moves with it.
    bounds: side === 'before' ? { ...bounds, x: bounds.x + shiftDx } : bounds,
    ripple: {
      atX,
      atY: bounds.y + bounds.height / 2,
      shiftDx,
      shiftedIds,
      leftId: null,
      rightId: null,
      spanTop: bounds.y,
      spanBottom: bounds.y + bounds.height,
    },
  };
}
