// How the engine names elements in result lines and refusals (docs/specs/024-agents/blueprints/
// edit-operations.md "Result lines", EO43): by ref, as views print them, with the kind word.

import { kindWordOf, type Element, type ElementId } from '@liveplanner/project';
import { labelOf, quoteCut } from '@liveworkspace/edit-operations/element-text';
import { LABEL_CUT_CHARS } from './vocabulary';

export { labelOf, quoteCut } from '@liveworkspace/edit-operations/element-text';

// The kind word views print: a shape's kind, else the type.
export function kindOf(el: Element): string {
  return kindWordOf(el);
}

// How elements are named on a line: by their ref.
export type Naming = { refOf: (id: ElementId) => string };

// Ids as they are: what a line uses when no tab names its elements.
const plainNaming: Naming = { refOf: (id) => id };

// `76eb  plan-view "Velocity"`: one element on a candidate line.
export function describeElement(el: Element, naming: Naming = plainNaming): string {
  const label = labelOf(el);
  return `${naming.refOf(el.id)}  ${kindOf(el)}${label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : ''}`;
}
