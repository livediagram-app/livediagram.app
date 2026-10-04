// How the engine names elements in result lines and refusals (docs/specs/024-agents/blueprints/
// edit-operations.md "Result lines", EO43): by ref, as views print them, with the kind word.

import { kindWordOf, type Element, type ElementId, type Endpoint } from '@livediagram/document';
import { LABEL_CUT_CHARS } from './vocabulary';

// The kind word views print: an event-storming note's notation, a shape's kind, else the type.
export function kindOf(el: Element): string {
  return kindWordOf(el);
}

// How elements are named on a line: their ref, and the ref of the container holding them.
export type Naming = {
  refOf: (id: ElementId) => string;
  containerOf: (id: ElementId) => string | null;
};

// Ids as they are: what a line uses when no tab names its elements.
export const plainNaming: Naming = { refOf: (id) => id, containerOf: () => null };

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
export function endRef(end: Endpoint, refOf: (id: ElementId) => string = (id) => id): string {
  switch (end.kind) {
    case 'pinned':
      return refOf(end.elementId);
    case 'on-arrow':
      return refOf(end.arrowId);
    case 'free':
      return `@${Math.round(end.x)},${Math.round(end.y)}`;
  }
}

// `n7  square "Charge card" in f2`, `a6  arrow n6→n7 "yes"`: one element on a candidate line.
export function describeElement(el: Element, naming: Naming = plainNaming): string {
  const { refOf } = naming;
  const ends = el.type === 'arrow' ? ` ${endRef(el.from, refOf)}→${endRef(el.to, refOf)}` : '';
  const label = labelOf(el);
  const container = el.type === 'arrow' ? null : naming.containerOf(el.id);
  return `${refOf(el.id)}  ${kindOf(el)}${ends}${label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : ''}${container ? ` in ${container}` : ''}`;
}
