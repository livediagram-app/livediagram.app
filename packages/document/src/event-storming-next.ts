// The next note on an event-storming board (docs/specs/021-event-storming/event-storming.md Phase 7): the note the
// notation most likely puts on each side of a note, so a button can add it.
// The added note is an ordinary note; the board keeps no relation between the
// two.

import { eventStormingNoteSize, type EventStormingNoteKind } from './event-storming';
import { ES_NOTE_GAP } from './event-storming-lanes';

// Which side of a note, along the board's own left-to-right time axis.
export type EsSide = 'before' | 'after';

export type EsNextNote = {
  kind: EventStormingNoteKind;
  side: EsSide;
  next: EventStormingNoteKind;
};

// A CATALOGUE rather than a switch, because the sides are notation rather than
// geometry: a workshop that reads its wall the other way costs one line here.
// Where the notation allows several next notes, only the most likely is held.
export const ES_NEXT_NOTES: EsNextNote[] = [
  { kind: 'domain-event', side: 'before', next: 'command' },
  { kind: 'domain-event', side: 'after', next: 'policy' },
  { kind: 'policy', side: 'after', next: 'command' },
];

export function nextNoteKind(
  kind: EventStormingNoteKind,
  side: EsSide,
): EventStormingNoteKind | null {
  return ES_NEXT_NOTES.find((n) => n.kind === kind && n.side === side)?.next ?? null;
}

export function nextNoteSides(
  kind: EventStormingNoteKind,
): { side: EsSide; next: EventStormingNoteKind }[] {
  return ES_NEXT_NOTES.filter((n) => n.kind === kind).map(({ side, next }) => ({ side, next }));
}

type Bounds = { x: number; y: number; width: number; height: number };

// One gutter beside the note, CENTRED on it vertically, so the 180-tall prose
// kinds sit against a 200-tall square and still read as one row.
export function nextNoteBounds(from: Bounds, side: EsSide, kind: EventStormingNoteKind): Bounds {
  const size = eventStormingNoteSize(kind);
  return {
    x: side === 'before' ? from.x - ES_NOTE_GAP - size.width : from.x + from.width + ES_NOTE_GAP,
    y: from.y + from.height / 2 - size.height / 2,
    width: size.width,
    height: size.height,
  };
}
