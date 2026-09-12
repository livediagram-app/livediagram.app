// The event-storming sticky grammar (spec/139): the note kinds of
// Brandolini's workshop notation, each with its canonical colour.
// Colour IS the notation here — orange means "domain event" to anyone
// who has stood in front of one of these boards — so the fills are
// pinned in this catalogue and every consumer (the palette's Event
// Storming tiles, the template starter, future exports) reads from it
// rather than carrying its own hexes. Stickies are exempt from theme
// recolouring, so a fill set from here survives every theme.

import type { Tab } from './index';
import { isLayerVisible, type Layer } from './layers';

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

// ---------------------------------------------------------------------
// Workshop-stage views (spec/139)
// ---------------------------------------------------------------------
//
// One event-storming board, viewed at three depths — Big Picture (events
// on a timeline), Process Modelling (adds commands / policies / read
// models / external systems), Software Design (adds aggregates) — plus an
// independent Timeline-rail toggle that shows the board against a spec/51
// rail. The mechanism is spec/74 layers: the template ships one layer per
// stage (fixed sentinel ids, the `layer:default` pattern, so re-applying
// converges and peers materialise identically), and a view switch is one
// ordinary tab commit that sets layer visibility. Shared and synced by
// design: the facilitator walks the whole room through the stages.

// Bottom -> top, matching Tab.layers order: the rail is scaffold UNDER the
// stickies; deeper stages stack above shallower ones so design-level notes
// paint over the big-picture band they annotate.
export const ES_RAIL_LAYER_ID = 'layer:es:rail';
export const ES_BIG_PICTURE_LAYER_ID = 'layer:es:big-picture';
export const ES_PROCESS_LAYER_ID = 'layer:es:process';
export const ES_DESIGN_LAYER_ID = 'layer:es:design';

export type EventStormingStage = 'big-picture' | 'process' | 'design';

// Chip order (shallow -> deep) + the layer each stage reveals last. The
// switcher also ACTIVATES that layer, so notes added while in a stage land
// on the band that stage owns.
export const EVENT_STORMING_STAGES: {
  stage: EventStormingStage;
  label: string;
  layerId: string;
}[] = [
  { stage: 'big-picture', label: 'Big picture', layerId: ES_BIG_PICTURE_LAYER_ID },
  { stage: 'process', label: 'Process', layerId: ES_PROCESS_LAYER_ID },
  { stage: 'design', label: 'Design', layerId: ES_DESIGN_LAYER_ID },
];

// The layers an event-storming template ships. Rail hidden (Q4: the seed
// has no timeline — the rail is a view); all three stage layers visible so
// a fresh board hides nothing whatever chip is pressed later. Built fresh
// per call so a caller mutating its tab can't corrupt the constant.
export function eventStormingLayers(): Layer[] {
  return [
    { id: ES_RAIL_LAYER_ID, name: 'Timeline rail', visible: false },
    { id: ES_BIG_PICTURE_LAYER_ID, name: 'Big picture' },
    { id: ES_PROCESS_LAYER_ID, name: 'Process' },
    { id: ES_DESIGN_LAYER_ID, name: 'Design' },
  ];
}

// An event-storming board is recognised by its stage layers — tab data, so
// the switcher appears wherever the board travels (share links, imports,
// re-opened diagrams) and never for anything else.
export function isEventStormingTab(layers: Layer[] | undefined): boolean {
  if (!layers) return false;
  const ids = new Set(layers.map((l) => l.id));
  return (
    ids.has(ES_BIG_PICTURE_LAYER_ID) && ids.has(ES_PROCESS_LAYER_ID) && ids.has(ES_DESIGN_LAYER_ID)
  );
}

// Store only the non-default state (visible layers carry no flag), the
// setLayerVisibility storage rule, kept local so this module stays a leaf.
const withVisibility = (layer: Layer, visible: boolean): Layer => {
  const { visible: _drop, ...rest } = layer;
  return visible ? rest : { ...rest, visible: false };
};

// Stages reveal cumulatively (big-picture ⊆ process ⊆ design): switching
// sets each stage layer's visibility in one pass. The rail layer is left
// alone — it is an independent toggle, not a stage.
export function applyEventStormingStage(tab: Tab, stage: EventStormingStage): Tab {
  const depth = EVENT_STORMING_STAGES.findIndex((s) => s.stage === stage);
  const layers = (tab.layers ?? []).map((l) => {
    const at = EVENT_STORMING_STAGES.findIndex((s) => s.layerId === l.id);
    return at === -1 ? l : withVisibility(l, at <= depth);
  });
  return { ...tab, layers };
}

// The deepest visible stage decides where the board currently is — so a
// fresh board (everything visible) reads as design, and boards whose
// layers were toggled by hand in the panel still resolve somewhere sane.
export function eventStormingStageOf(layers: Layer[] | undefined): EventStormingStage {
  for (let i = EVENT_STORMING_STAGES.length - 1; i >= 0; i--) {
    const s = EVENT_STORMING_STAGES[i]!;
    const layer = layers?.find((l) => l.id === s.layerId);
    if (layer && isLayerVisible(layer)) return s.stage;
  }
  return 'big-picture';
}

export function eventStormingRailVisible(layers: Layer[] | undefined): boolean {
  const rail = layers?.find((l) => l.id === ES_RAIL_LAYER_ID);
  return rail != null && isLayerVisible(rail);
}

export function toggleEventStormingRail(tab: Tab): Tab {
  const show = !eventStormingRailVisible(tab.layers);
  const layers = (tab.layers ?? []).map((l) =>
    l.id === ES_RAIL_LAYER_ID ? withVisibility(l, show) : l,
  );
  return { ...tab, layers };
}
