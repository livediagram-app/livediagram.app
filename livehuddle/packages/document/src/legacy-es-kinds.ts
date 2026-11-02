// Loading a workshop note saved before its kind was stored (docs/specs/021-event-storming/event-storming.md "The kind
// is stored"). Such a note is a fixed-size sticky (one only exists on an event-storming board) in its kind's
// canonical fill, and it gets that kind stamped as `esKind` on the way in. After that only the stored kind counts, so
// a plain sticky recoloured later (Lemon, say) stays a plain sticky rather than turning into an Actor. Runs where
// stored elements enter (./stored-elements).
import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from './event-storming';
import type { Element } from './index';

function legacyKindOf(el: Element): EventStormingNoteKind | null {
  if (el.type !== 'sticky' || el.esKind || !el.fixedSize || !el.fillColor) return null;
  return EVENT_STORMING_NOTES.find((n) => n.fill === el.fillColor)?.kind ?? null;
}

export function stampLegacyEsKinds(elements: Element[]): Element[] {
  if (!elements.some((el) => legacyKindOf(el) !== null)) return elements;
  return elements.map((el) => {
    const kind = legacyKindOf(el);
    return kind ? { ...el, esKind: kind } : el;
  });
}
