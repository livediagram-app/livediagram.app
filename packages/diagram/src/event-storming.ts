// The event-storming sticky grammar (spec/139): the note kinds of
// Brandolini's workshop notation, each with its canonical colour.
// Colour IS the notation here — orange means "domain event" to anyone
// who has stood in front of one of these boards — so the fills are
// pinned in this catalogue and every consumer (the palette's Event
// Storming tiles, the template starter, future exports) reads from it
// rather than carrying its own hexes. Stickies are exempt from theme
// recolouring, so a fill set from here survives every theme.

export type EventStormingNoteKind =
  | 'domain-event'
  | 'command'
  | 'actor'
  | 'policy'
  | 'read-model'
  | 'external-system'
  | 'aggregate'
  | 'hotspot';

export type EventStormingNote = {
  kind: EventStormingNoteKind;
  label: string;
  // A palette-row clause: what the note IS, not how to use it.
  blurb: string;
  fill: string;
};

// Workshop order: events first (the big-picture stage), then the
// process-modelling kinds, then the design-level aggregate, with the
// hotspot last (it can land at any stage).
export const EVENT_STORMING_NOTES: EventStormingNote[] = [
  {
    kind: 'domain-event',
    label: 'Domain event',
    blurb: 'Something that happened, past tense',
    fill: '#fdba74',
  },
  {
    kind: 'command',
    label: 'Command',
    blurb: 'An intent that triggers an event',
    fill: '#93c5fd',
  },
  {
    kind: 'actor',
    label: 'Actor',
    blurb: 'Who issues the command',
    fill: '#fef08a',
  },
  {
    kind: 'policy',
    label: 'Policy',
    blurb: 'Whenever X happens, then Y',
    fill: '#d8b4fe',
  },
  {
    kind: 'read-model',
    label: 'Read model',
    blurb: 'Information the actor decides on',
    fill: '#86efac',
  },
  {
    kind: 'external-system',
    label: 'External system',
    blurb: 'A third party the flow touches',
    fill: '#f9a8d4',
  },
  {
    kind: 'aggregate',
    label: 'Aggregate',
    blurb: 'The thing commands act on',
    fill: '#fef9c3',
  },
  {
    kind: 'hotspot',
    label: 'Hotspot',
    blurb: 'A conflict, question, or risk',
    fill: '#fca5a5',
  },
];

export function eventStormingNote(kind: EventStormingNoteKind): EventStormingNote {
  // The catalogue is a closed set over the union, so the lookup always hits;
  // the non-null assertion keeps callers free of impossible-undefined checks.
  return EVENT_STORMING_NOTES.find((n) => n.kind === kind)!;
}
