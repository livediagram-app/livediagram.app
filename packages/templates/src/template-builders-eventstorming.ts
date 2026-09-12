// Event storming (spec/139): the sticky-note workshop notation for
// exploring a business domain. The starter is deliberately minimal —
// the method's first instruction is "write domain events, past tense,
// on orange stickies, left to right in rough time order", so the seed
// is exactly that: a short run of orange domain events on a timeline
// hint. The rest of the notation (commands, actors, policies, read
// models, hotspots) arrives incrementally as the diagram type grows.
//
// Colour is load-bearing in event storming (orange MEANS domain
// event), so the stickies carry an explicit fill. Stickies are exempt
// from theme recolouring, so the notation survives any theme.
//
// The builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so the template is
// self-describing.

import { createSticky, createText, eventStormingNote, type Element } from '@livediagram/diagram';

// The canonical event-storming orange (big-picture domain events), from the
// shared note-kind catalogue so the template and the palette tiles can't
// drift apart.
const DOMAIN_EVENT_FILL = eventStormingNote('domain-event').fill;

export function buildEventStorming(cx: number, cy: number): Element[] {
  const stickyW = 200;
  const stickyH = 200;
  const gap = 72;

  const events = ['Order placed', 'Payment received', 'Order shipped'];

  const totalW = events.length * stickyW + (events.length - 1) * gap;
  const x0 = cx - totalW / 2;
  const y0 = cy - stickyH / 2;

  const elements: Element[] = [];

  events.forEach((label, i) => {
    elements.push({
      ...createSticky(x0 + i * (stickyW + gap), y0),
      label,
      fillColor: DOMAIN_EVENT_FILL,
      // Alternate a gentle tilt so the notes read as hand-placed.
      rotation: i % 2 === 0 ? -1.5 : 1.5,
    });
  });

  // A quiet reminder of the method's one rule for this stage.
  elements.push({
    ...createText(x0, y0 + stickyH + 48),
    width: totalW,
    height: 40,
    label: 'Domain events · past tense · left to right in time order',
    textSize: 'sm',
    textAlignX: 'center',
    textColor: '#64748b',
  });

  return elements;
}
