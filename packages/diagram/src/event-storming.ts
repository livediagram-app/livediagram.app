// The event-storming sticky grammar (spec/139): the note kinds of
// Brandolini's workshop notation, each with its canonical colour.
// Colour IS the notation here — orange means "domain event" to anyone
// who has stood in front of one of these boards — so the fills are
// pinned in this catalogue and every consumer (the palette's Event
// Storming tiles, the template starter, future exports) reads from it
// rather than carrying its own hexes. Stickies are exempt from theme
// recolouring, so a fill set from here survives every theme.

import { type Layer } from './layers';

export type EventStormingNoteKind =
  | 'domain-event'
  | 'command'
  | 'actor'
  | 'policy'
  | 'read-model'
  | 'external-system'
  | 'aggregate'
  | 'hotspot';

export type EventStormingStage = 'big-picture' | 'process' | 'design';

// The physical stationery set's silhouettes: standard squares for events /
// commands / read models / hotspots, WIDE stickies for the prose kinds
// (policy, external system, aggregate — they need a sentence, not a noun),
// and a small square for the actor (just a role name, deliberately tiny).
export type EventStormingNoteSize = 'square' | 'wide' | 'small';

export const ES_NOTE_SIZE_PX: Record<EventStormingNoteSize, { width: number; height: number }> = {
  square: { width: 200, height: 200 },
  wide: { width: 300, height: 180 },
  small: { width: 140, height: 140 },
};

export type EventStormingNote = {
  kind: EventStormingNoteKind;
  label: string;
  // A palette-row clause: what the note IS, not how to use it.
  blurb: string;
  fill: string;
  // The workshop stage the kind belongs to — the palette routes a dropped
  // note onto this stage's layer (spec/139): events, actors and hotspots
  // surface in Big picture, the flow kinds arrive at Process, and the
  // aggregate is design-level.
  stage: EventStormingStage;
  size: EventStormingNoteSize;
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
    stage: 'big-picture',
    size: 'square',
  },
  {
    kind: 'command',
    label: 'Command',
    blurb: 'An intent that triggers an event',
    fill: '#93c5fd',
    stage: 'process',
    size: 'square',
  },
  {
    kind: 'actor',
    label: 'Actor',
    blurb: 'Who issues the command',
    fill: '#fef08a',
    stage: 'big-picture',
    size: 'small',
  },
  {
    kind: 'policy',
    label: 'Policy',
    blurb: 'Whenever X happens, then Y',
    fill: '#d8b4fe',
    stage: 'process',
    size: 'wide',
  },
  {
    kind: 'read-model',
    label: 'Read model',
    blurb: 'Information the actor decides on',
    fill: '#86efac',
    stage: 'process',
    size: 'square',
  },
  {
    kind: 'external-system',
    label: 'External system',
    blurb: 'A third party the flow touches',
    fill: '#f9a8d4',
    stage: 'process',
    size: 'wide',
  },
  {
    kind: 'aggregate',
    label: 'Aggregate',
    blurb: 'The thing commands act on',
    fill: '#fef9c3',
    stage: 'design',
    size: 'wide',
  },
  {
    kind: 'hotspot',
    label: 'Hotspot',
    blurb: 'A conflict, question, or risk',
    fill: '#fca5a5',
    stage: 'big-picture',
    size: 'square',
  },
];

export function eventStormingNote(kind: EventStormingNoteKind): EventStormingNote {
  // The catalogue is a closed set over the union, so the lookup always hits;
  // the non-null assertion keeps callers free of impossible-undefined checks.
  return EVENT_STORMING_NOTES.find((n) => n.kind === kind)!;
}

// ---------------------------------------------------------------------
// Workshop-stage views (spec/139)
// ---------------------------------------------------------------------
//
// ONE board, ONE layer. The board used to ship a layer per workshop stage
// (Big Picture / Process / Software Design) with a chip bar toggling their
// visibility, but stages-as-layers cost more than they paid: layers paint as
// separate BANDS, so two notes on different stages could never be stacked
// against each other — "bring to front" simply did nothing across a band,
// with nothing on screen to explain why. A workshop surface is one wall of
// paper; the notation already says what each note IS, so the stage it
// belongs to doesn't need its own plane. The stage field on each note stays
// (it is real domain vocabulary, and drives nothing structural for now).
export const ES_BOARD_LAYER_ID = 'layer:es:board';

// Legacy stage-layer ids. Boards authored before the collapse still carry
// them, and they keep working: identity accepts them, and they are ordinary
// spec/74 layers the facilitator can merge or delete from the panel.
export const ES_BIG_PICTURE_LAYER_ID = 'layer:es:big-picture';
export const ES_PROCESS_LAYER_ID = 'layer:es:process';
export const ES_DESIGN_LAYER_ID = 'layer:es:design';

// The layer an event-storming template ships: one, named for the board.
// Built fresh per call so a caller mutating its tab can't corrupt it.
export function eventStormingLayers(): Layer[] {
  return [{ id: ES_BOARD_LAYER_ID, name: 'Event Storming' }];
}

// The layer a palette-dropped note belongs on: the board's single layer,
// whatever the note's kind. The commit path stamps it only when the target
// tab actually carries that layer, visible and unlocked — otherwise the note
// falls through to the ordinary active-layer stamping.
export function eventStormingBoardLayerId(): string {
  return ES_BOARD_LAYER_ID;
}

// The pixel footprint of a note kind (its stationery silhouette).
export function eventStormingNoteSize(kind: EventStormingNoteKind): {
  width: number;
  height: number;
} {
  return ES_NOTE_SIZE_PX[eventStormingNote(kind).size];
}

// The notation kind of an element, or null if it isn't a workshop note.
// Prefers the stored `esKind`; falls back to the canonical fill for notes
// authored before the kind was persisted (the fill IS the notation, and a
// fixed-size sticky only exists on an event-storming board). An ordinary
// sticky that merely happens to be blue is not a Command.
export function eventStormingKindOf(el: {
  type: string;
  esKind?: EventStormingNoteKind;
  fillColor?: string;
  fixedSize?: boolean;
}): EventStormingNoteKind | null {
  if (el.type !== 'sticky') return null;
  if (el.esKind) return el.esKind;
  if (!el.fixedSize || !el.fillColor) return null;
  return EVENT_STORMING_NOTES.find((n) => n.fill === el.fillColor)?.kind ?? null;
}

// A workshop note's hand-placement (spec/139). Calibrated by eye: ±1.1°
// reads hand-placed, ±2.5° reads messy. One decimal keeps the stored JSON
// tidy. Lives here rather than in the editor because every surface that
// mints a note needs the same feel — dropping one, and COPYING one: a
// duplicate is a new piece of paper, so it gets its own angle rather than
// photocopying the source's.
export const ES_MAX_TILT_DEG = 1.1;

export function eventStormingTilt(): number {
  return Math.round((Math.random() * 2 - 1) * ES_MAX_TILT_DEG * 10) / 10;
}

// An event-storming board is recognised by its KIND — tab data, so
// the switcher appears wherever the board travels (share links, imports,
// re-opened diagrams) and never for anything else.
//
// ANY of them is enough — the board's own layer, or one of the legacy stage
// layers a pre-collapse board still carries. Layers are ordinary spec/74
// data: a facilitator renames them, adds their own, and deletes ones they
// don't use, all legitimate. Requiring a particular set meant deleting one
// silently stripped the board of its palette and its note routing, with
// nothing on screen to explain why. Board identity must not hinge on a
// checklist the user is free to edit.
export function isEventStormingTab(tab: { kind?: string; layers?: Layer[] } | undefined): boolean {
  if (!tab) return false;
  // The tab says so: the whole point of the field.
  if (tab.kind === 'event-storming') return true;
  // Boards authored before `kind` existed are identified by the layer the
  // template shipped — the board layer, or one of the three stage layers
  // from before they collapsed into one. Legacy only; new boards carry the
  // kind, and a layer the user deletes no longer costs them the board.
  const layers = tab.layers;
  if (!layers) return false;
  return layers.some(
    (l) =>
      l.id === ES_BOARD_LAYER_ID ||
      l.id === ES_BIG_PICTURE_LAYER_ID ||
      l.id === ES_PROCESS_LAYER_ID ||
      l.id === ES_DESIGN_LAYER_ID,
  );
}
