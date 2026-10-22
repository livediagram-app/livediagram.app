// Everything the checks read, prepared once a run (blueprint "Behaviour and state" step 1): the visible elements,
// the refs the views print, and the boxes.

import {
  computeRefs,
  isBoxed,
  visibleLayerElements,
  type BoxedElement,
  type Element,
  type ElementId,
  type RefTable,
  type Tab,
} from '@livedesign/document';
import { finiteRect, isLintBox } from './boxes';

export type LintContext = {
  visible: Element[];
  refs: RefTable;
  boxes: BoxedElement[];
  // Visible boxed elements with a non-finite rect, checked by nothing (N6).
  skipped: number;
};

export function prepareLintContext(tab: Pick<Tab, 'elements' | 'layers'>): LintContext {
  const visible = visibleLayerElements(tab.elements, tab.layers);
  return {
    visible,
    refs: computeRefs(tab.elements.map((el) => el.id)),
    boxes: visible.filter(isLintBox),
    skipped: visible.filter(isBoxed).filter((el) => !finiteRect(el)).length,
  };
}

// The ref the views print for an element.
export const refOf = (ctx: LintContext, id: ElementId) => ctx.refs.refOf(id);
