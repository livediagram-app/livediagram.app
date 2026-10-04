// How the engine names elements in result lines and refusals (docs/specs/024-agents/blueprints/
// edit-operations.md "Result lines", EO43). In this build an element's ref is its id.

import type { Element, Endpoint } from '@livediagram/document';
import { LABEL_CUT_CHARS } from './vocabulary';

// The shape kind for shapes, else the element type: what results print.
export function kindOf(el: Element): string {
  return el.type === 'shape' ? el.shape : el.type;
}

export function labelOf(el: Element): string | undefined {
  return 'label' in el && typeof el.label === 'string' && el.label !== '' ? el.label : undefined;
}

// A JSON string cut at `max` code points on a word boundary: whole when the slice ends a word, else
// at its last whitespace, else hard; `…` after the closing quote (VW16).
export function quoteCut(text: string, max: number): string {
  const points = [...text];
  if (points.length <= max) return JSON.stringify(text);
  const slice = points.slice(0, max).join('');
  const space = /\s/.test(points[max]!) ? slice.length : slice.search(/\s\S*$/);
  return `${JSON.stringify((space > 0 ? slice.slice(0, space) : slice).trimEnd())}…`;
}

// An arrow end as results print it: the element or arrow it is attached to, or `@x,y` when free.
export function endRef(end: Endpoint): string {
  switch (end.kind) {
    case 'pinned':
      return end.elementId;
    case 'on-arrow':
      return end.arrowId;
    case 'free':
      return `@${Math.round(end.x)},${Math.round(end.y)}`;
  }
}

// `n7  square "Charge card"`, `a6  arrow n6→n7 "yes"`: one element on a candidate line.
export function describeElement(el: Element): string {
  const ends = el.type === 'arrow' ? ` ${endRef(el.from)}→${endRef(el.to)}` : '';
  const label = labelOf(el);
  return `${el.id}  ${kindOf(el)}${ends}${label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : ''}`;
}
