'use client';

import {
  eventStormingKindOf,
  eventStormingNote,
  nextNoteBounds,
  nextNoteSides,
  type Element,
  type EsSide,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { useHoveredNoteId } from '@/lib/note-hover';

// The next-note buttons (spec/139 Phase 7): on each side of a note that has a
// next note in the notation, a button that adds it one gutter beside, open for
// typing.
//
// Spec/139 retired the four quick-connect pluses on this board as chrome that
// the capture loop never asks for. These are a different animal, and the
// difference is what earns them their place: at most TWO per note, only on the
// note you are pointing at or have selected, and each one is a sentence of the
// notation ("add a command before this domain event") rather than a generic
// "connect something here".

const DOT_PX = 8;
// A comfortable target around a small mark (WCAG 2.2 target size): the mark
// is the picture, this is the button.
const HIT_PX = 24;

function label(next: EventStormingNoteKind, side: EsSide, fromKind: EventStormingNoteKind) {
  const noteLabel = (k: EventStormingNoteKind) => eventStormingNote(k).label.toLowerCase();
  return `Add a ${noteLabel(next)} ${side} this ${noteLabel(fromKind)}`;
}

export function NextNoteButtons({
  elements,
  selectedId,
  blocked,
  zoom,
  onAdd,
}: {
  elements: Element[];
  selectedId: string | null;
  // No buttons where the add would be refused anyway: a view-only session, a
  // locked tab, a hidden or locked active layer — or any drag in hand, which
  // owns the board while it lasts.
  blocked: boolean;
  zoom: number;
  onAdd: (fromId: string, side: EsSide) => void;
}) {
  const hoveredId = useHoveredNoteId();
  if (blocked) return null;

  // Selection and hover both count, and they are the same note often enough
  // that the set matters more than the order.
  const noteIds = [...new Set([selectedId, hoveredId])].filter((id): id is string => id !== null);

  const buttons: {
    key: string;
    fromId: string;
    side: EsSide;
    x: number;
    y: number;
    name: string;
  }[] = [];

  for (const id of noteIds) {
    const from = elements.find((el) => el.id === id);
    if (!from || from.type === 'arrow' || from.locked === true) continue;
    const fromKind = eventStormingKindOf(from);
    if (!fromKind) continue;
    for (const { side, next } of nextNoteSides(fromKind)) {
      const spot = nextNoteBounds(from, side, next);
      // Centred in the gutter, on the note's centre line.
      const x =
        side === 'before'
          ? spot.x + spot.width + (from.x - spot.x - spot.width) / 2
          : from.x + from.width + (spot.x - from.x - from.width) / 2;
      buttons.push({
        key: `${from.id}:${side}`,
        fromId: from.id,
        side,
        x,
        y: from.y + from.height / 2,
        name: label(next, side, fromKind),
      });
    }
  }

  if (buttons.length === 0) return null;

  return (
    <>
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          title={b.name}
          aria-label={b.name}
          data-next-note={b.side}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(b.fromId, b.side);
          }}
          className="absolute flex items-center justify-center rounded-full text-slate-500 transition hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:text-brand-300"
          style={{
            // Canvas units: the wrapper is already scaled, so the hit target
            // is divided by zoom to stay a constant 24 SCREEN px.
            left: b.x - HIT_PX / zoom / 2,
            top: b.y - HIT_PX / zoom / 2,
            width: HIT_PX / zoom,
            height: HIT_PX / zoom,
          }}
        >
          <span
            aria-hidden
            className="block rounded-full border-2 border-current bg-transparent"
            style={{ width: (DOT_PX * 2) / zoom, height: (DOT_PX * 2) / zoom }}
          />
        </button>
      ))}
    </>
  );
}
