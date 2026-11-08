// Everything the checks read, prepared once a run (blueprint "Behaviour and state" step 1): the visible
// elements, the views' refs and the boxes. A stored arrow is a retired element that joins nothing
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4).

import {
  computeRefs,
  isBoxed,
  type BoxedElement,
  type Element,
  type ElementId,
  type RefTable,
  type Tab,
} from '@livehuddle/document';
import { isLintBox } from './boxes';

export type LintContext = {
  theme: string | undefined;
  visible: Element[];
  refs: RefTable;
  boxes: BoxedElement[];
  // Visible elements with a non-finite rect, checked by nothing (N6).
  skipped: number;
};

export function prepareLintContext(tab: Pick<Tab, 'elements' | 'theme'>): LintContext {
  const visible = tab.elements;
  const skipped = visible
    .filter(isBoxed)
    .filter((el) => ![el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v))).length;
  return {
    theme: tab.theme,
    visible,
    refs: computeRefs(tab.elements.map((el) => el.id)),
    boxes: visible.filter(isLintBox),
    skipped,
  };
}

// The ref the views print for an element.
export const refOf = (ctx: LintContext, id: ElementId) => ctx.refs.refOf(id);
