// The working state made into the next tab (docs/specs/024-agents/blueprints/edit-operations.md
// "Finalise"): touched elements normalised, then checked, and the whole tab validated. Untouched elements pass
// through as the same objects (I2).

import type { EditRejection } from '@liveplanner/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  elementValidationIssue,
  isValidTab,
  normaliseElement,
  type Element,
  type Tab,
} from '@liveplanner/project';
import { kindOf } from './element-text';
import { sameValue } from './equality';
import { invalidResult } from './rejections';
import { currentElements, replaceElement, type EditState } from './state';

const GEOMETRY: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height']);

function normaliseTouched(state: EditState): void {
  for (const [id, { written }] of state.touched) {
    const el = state.byId.get(id);
    // Normalising settles what an operation wrote; an element only moved or resized changes nothing but where it is
    // and how big.
    if (!el || (state.before.has(id) && written.every((key) => GEOMETRY.has(key)))) continue;
    replaceElement(state, normaliseElement(el) as Element);
  }
}

function touchedIssue(state: EditState): EditRejection | null {
  for (const id of state.touched.keys()) {
    const el = state.byId.get(id);
    const issue = el && elementValidationIssue(el);
    if (issue) return invalidResult(id, kindOf(el), issue);
  }
  return null;
}

// Why a whole tab fails validation: the first invalid element, the element cap, a repeated id, or
// the tab's own id and name.
export function tabRejection(tab: Tab): EditRejection {
  for (const el of tab.elements) {
    const issue = elementValidationIssue(el);
    if (issue) return invalidResult(el.id, kindOf(el), issue);
  }
  if (tab.elements.length > MAX_ELEMENTS_PER_TAB)
    return invalidResult('the tab', undefined, {
      field: 'elements',
      rule: `at most ${MAX_ELEMENTS_PER_TAB} elements`,
    });
  const ids = new Set(tab.elements.map((el) => el.id));
  if (ids.size < tab.elements.length)
    return invalidResult('the tab', undefined, { field: 'elements', rule: 'every id once' });
  return invalidResult('the tab', undefined, { field: 'id', rule: 'an id and a name' });
}

export function finalise(state: EditState): Tab | EditRejection {
  normaliseTouched(state);
  const issue = touchedIssue(state);
  if (issue) return issue;
  // An element that ends as it began is the element it began as (E1, I2).
  const elements = currentElements(state).map((el) => {
    const was = state.before.get(el.id);
    return was && was !== el && sameValue(was, el) ? was : el;
  });
  const next: Tab = { ...state.tab, elements };
  return isValidTab(next) ? next : tabRejection(next);
}
