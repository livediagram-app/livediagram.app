// Event storming (spec/139): the sticky-note workshop notation for
// exploring a business domain. The starter is deliberately minimal —
// the method's first instruction is "write domain events, past tense,
// on orange stickies, left to right in rough time order", so the seed
// is exactly that: one orange domain event, "Board Created". The rest of
// the notation lives in the Event Storming palette category.
//
// Colour is load-bearing in event storming (orange MEANS domain
// event), so the sticky carries an explicit fill. Stickies are exempt
// from theme recolouring, so the notation survives any theme.
//
// The builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so the template is
// self-describing.

import {
  createSticky,
  ES_LANES,
  laneCentre,
  laneIndexAt,
  ES_BOARD_LAYER_ID,
  eventStormingNote,
  type Element,
} from '@livediagram/diagram';

// The canonical event-storming orange (big-picture domain events), from the
// shared note-kind catalogue so the template and the palette tiles can't
// drift apart.
const DOMAIN_EVENT_FILL = eventStormingNote('domain-event').fill;

// The method's opening move and nothing else (spec/139 Phase 1): one domain
// event, and it is also the first thing that happened. No text element: the
// board is paper only.
export function buildEventStorming(cx: number, cy: number): Element[] {
  const stickyW = 200;
  const stickyH = 200;
  // Centred on the lane nearest the centre it was asked for, so a fresh board
  // starts on the lanes every drag will snap to (spec/139 Phase 6).
  const y = laneCentre(laneIndexAt(cy, ES_LANES), ES_LANES) - stickyH / 2;
  return [
    {
      ...createSticky(cx - stickyW / 2, y),
      label: 'Board Created',
      fillColor: DOMAIN_EVENT_FILL,
      esKind: 'domain-event',
      // A gentle tilt so the note reads as hand-placed.
      rotation: -1.1,
      // Workshop stationery is one size for life, and its text auto-fits
      // centred on the paper (spec/139).
      fixedSize: true,
      textSize: 'scale',
      textAlignX: 'center',
      textAlignY: 'middle',
      // One board, one layer (spec/139).
      layerId: ES_BOARD_LAYER_ID,
    },
  ];
}
