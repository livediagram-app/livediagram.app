// A pointer note's leader and tip in the headless render (docs/specs/009-elements/pointer-note.md): the box and its
// label are the ordinary bordered shape's, drawn by the caller; this adds the line from the box to the tip and the
// tip's dot, from the same `pointerLeader` the canvas face uses.

import type { BoxedElement } from './index';
import { pointerLeader, pointerTipOf } from './pointer-note';
import { r2, xmlEscape } from './svg-render-primitives';

type Shape = BoxedElement & { type: 'shape' };

/** The tip dot's radius (D190: a 7 px dot). */
const POINTER_TIP_DOT_R = 3.5;

export function svgPointerNote(el: Shape, o: { stroke: string }): string {
  const tip = pointerTipOf(el);
  const leader = pointerLeader(el);
  const stroke = xmlEscape(o.stroke);
  const line = leader
    ? `<line x1="${r2(el.x + leader.x1)}" y1="${r2(el.y + leader.y1)}" x2="${r2(el.x + leader.x2)}" y2="${r2(el.y + leader.y2)}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>`
    : '';
  return (
    line +
    `<circle cx="${r2(el.x + tip.x)}" cy="${r2(el.y + tip.y)}" r="${POINTER_TIP_DOT_R}" fill="${stroke}"/>`
  );
}
