import {
  ES_NOTE_GAP,
  eventStormingKindOf,
  isBoxed,
  nextNoteBounds,
  rectsIntersect,
  type Element,
  type ElementId,
  type EsSide,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { travellingIdsFrom, type InsertionSlot } from '@/lib/insert-between';

// Where a next note goes, and what has to stand aside for it (docs/specs/021-event-storming/event-storming.md
// Phase 7). Pure, so the whole decision is one testable answer
// rather than a pile of conditions inside a commit.
//
// The board OPENS rather than refusing: if the note's footprint lands on
// something, the shipped insertion ripple makes room in the same commit, so
// the author sees the board behave exactly as the Alt gesture taught them.

export type NextNotePlan = {
  kind: EventStormingNoteKind;
  // Where the note lands, AFTER any ripple.
  bounds: { x: number; y: number; width: number; height: number };
  // The room to make first, or null when the spot is already free.
  ripple: InsertionSlot | null;
};

export function planNextNote(
  elements: Element[],
  fromId: ElementId,
  side: EsSide,
  kind: EventStormingNoteKind,
  // Elements on a hidden or locked layer (docs/specs/006-diagram/layers.md): invisible, so they cannot
  // be what the board opens around — but they travel with the ripple, exactly
  // as they do for the Alt insertion.
  inertIds: ReadonlySet<ElementId> = new Set(),
): NextNotePlan | null {
  const from = elements.find((el) => el.id === fromId);
  if (!from || !isBoxed(from) || !eventStormingKindOf(from)) return null;
  const bounds = nextNoteBounds(from, side, kind);

  const collides = elements.some(
    (el) => isBoxed(el) && el.id !== fromId && !inertIds.has(el.id) && rectsIntersect(bounds, el),
  );
  if (!collides) return { kind, bounds, ripple: null };

  // Where the board splits. AFTER, the new note's own spot is the point, and
  // the note it is added from stays put. BEFORE, the point is that note's left
  // edge: it and everything after it travel, vacating exactly the width +
  // gutter the new note needs, and whatever sits to its left is left alone.
  const atX = side === 'before' ? from.x : bounds.x;
  const shiftDx = bounds.width + ES_NOTE_GAP;
  const shiftedIds = [...travellingIdsFrom(elements, atX)];
  if (shiftedIds.length === 0) return { kind, bounds, ripple: null };

  return {
    kind,
    // The note added from travels with the ripple when the new one goes
    // BEFORE it, so the landing spot moves with it.
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
