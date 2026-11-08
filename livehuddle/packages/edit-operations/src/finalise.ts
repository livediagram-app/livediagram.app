// The working state made into the next tab (docs/specs/024-agents/blueprints/edit-operations.md
// "Finalise"): touched elements normalised and their shape kinds coerced, then checked, and the whole tab validated.
// Untouched elements pass through as the same objects (I2). A stored arrow is a retired element (docs/specs/
// 002-project-scope/not-in-livehuddle.md "The element engine", part 4): nothing re-anchors it, and its pinned ends
// follow the boxes they name when it is drawn.

import type { EditRejection } from '@livehuddle/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  coerceShapeKind,
  elementValidationIssue,
  isValidTab,
  normaliseElement,
  type Element,
  type Tab,
} from '@livehuddle/document';
import { kindOf } from './element-text';
import { sameValue } from './equality';
import { invalidResult } from './rejections';
import { currentElements, replaceElement, type EditState } from './state';
import type { EditLog } from './types';
import { ALIAS_FIELDS } from './fields';

type Raw = Record<string, unknown>;

const GEOMETRY: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height']);

function normaliseTouched(state: EditState, log: EditLog): void {
  for (const [id, { operation, written }] of state.touched) {
    const el = state.byId.get(id);
    // Normalising settles what an operation wrote; an element only moved, carried or grown changes
    // nothing but where it is and how big.
    if (!el || (!!state.before.has(id) && written.every((key) => GEOMETRY.has(key)))) continue;
    const normalised = normaliseElement(el) as Raw;
    // A sticky's borderless look comes with the fill it is given: an existing note whose fill this edit
    // left alone keeps the border it had, so a relabelled note looks like its neighbours.
    if (
      normalised.type === 'sticky' &&
      state.before.has(id) &&
      (el as Raw).strokeColor === undefined &&
      // The fill named by its stored key or by an alias that writes it (`fill`).
      !written.some((k) => k === 'fillColor' || ALIAS_FIELDS[k]?.includes('fillColor'))
    )
      delete normalised.strokeColor;
    // A kind the edit did not write stays: a stored lane, a retired kind (docs/specs/002-project-scope/
    // not-in-livehuddle.md "The element engine", part 3), keeps its kind when an agent relabels it.
    const was = state.before.get(id);
    const kept = was?.type === 'shape' && was.shape === normalised.shape;
    if (normalised.type === 'shape' && !kept) {
      const shape = coerceShapeKind(normalised.shape);
      if (shape !== normalised.shape) {
        state.warnings.push({
          code: 'shape_coerced',
          ref: id,
          message: `${id} shape ${JSON.stringify(normalised.shape)} drawn as ${shape}`,
        });
        log('[edit-ops] coerced', { operation, field: 'shape' });
        normalised.shape = shape;
      }
    }
    replaceElement(state, normalised as unknown as Element);
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

export function finalise(state: EditState, log: EditLog): Tab | EditRejection {
  normaliseTouched(state, log);
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
