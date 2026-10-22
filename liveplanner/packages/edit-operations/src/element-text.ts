// How the engine names elements in result lines and refusals (docs/specs/024-agents/blueprints/
// edit-operations.md "Result lines", EO43): by ref, as views print them, with the kind word.

import { kindWordOf, type Element, type ElementId } from '@liveplanner/project';
import { LABEL_CUT_CHARS } from './vocabulary';

// The kind word views print: a shape's kind, else the type.
export function kindOf(el: Element): string {
  return kindWordOf(el);
}

// How elements are named on a line: by their ref.
export type Naming = { refOf: (id: ElementId) => string };

// Ids as they are: what a line uses when no tab names its elements.
const plainNaming: Naming = { refOf: (id) => id };

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

// `76eb  plan-view "Velocity"`: one element on a candidate line.
export function describeElement(el: Element, naming: Naming = plainNaming): string {
  const label = labelOf(el);
  return `${naming.refOf(el.id)}  ${kindOf(el)}${label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : ''}`;
}
