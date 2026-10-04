// The working state made into the next tab (docs/specs/024-agents/blueprints/edit-operations.md
// "Finalise"): touched elements normalised and their shape kinds coerced, then checked, workshop
// notes landed on lanes, arrows re-anchored around moved boxes, lanes behind what they hold, and the
// whole tab validated. Untouched elements pass through as the same objects (I2).

import type { EditRejection } from '@livediagram/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  coerceShapeKind,
  elementValidationIssue,
  isValidTab,
  landWorkshopArrivals,
  lanesToFront,
  normaliseElement,
  rebindArrowAnchorsAfterMove,
  type Element,
  type ElementId,
  type Tab,
} from '@livediagram/document';
import { kindOf } from './element-text';
import { sameValue } from './equality';
import { invalidResult } from './rejections';
import { currentElements, type EditState } from './state';
import type { EditLog } from './types';

type Raw = Record<string, unknown>;

// The coercions normalising may make that change what the caller asked for.
function noteCoercions(state: EditState, before: Raw, after: Raw, log: EditLog, op: number) {
  const id = String(after.id);
  const coerced = (field: string, message: string) => {
    state.warnings.push({ code: 'value_coerced', ref: id, message });
    log('[edit-ops] coerced', { operation: op, field });
  };
  if (before.codeLanguage !== after.codeLanguage)
    coerced(
      'codeLanguage',
      `${id} codeLanguage ${JSON.stringify(before.codeLanguage)} drawn as plain`,
    );
  if (before.codeTheme !== after.codeTheme)
    coerced(
      'codeTheme',
      `${id} codeTheme ${JSON.stringify(before.codeTheme)} is not a theme; removed`,
    );
}

function normaliseTouched(state: EditState, log: EditLog): void {
  for (const [id, { operation }] of state.touched) {
    const el = state.byId.get(id);
    if (!el) continue;
    const normalised = normaliseElement(el) as Raw;
    noteCoercions(state, el as unknown as Raw, normalised, log, operation);
    if (normalised.type === 'shape') {
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
    state.byId.set(id, normalised as unknown as Element);
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

const boxOf = (el: Element) => (el.type === 'arrow' ? null : [el.x, el.y, el.width, el.height]);

// Boxes present before and after whose position or size changed.
function movedBoxes(before: ReadonlyMap<ElementId, Element>, next: Element[]): Set<ElementId> {
  const moved = new Set<ElementId>();
  for (const el of next) {
    const was = before.get(el.id);
    const box = boxOf(el);
    if (!was || !box || was === el) continue;
    if (box.some((v, i) => v !== boxOf(was)?.[i])) moved.add(el.id);
  }
  return moved;
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
  const landed = landWorkshopArrivals(state.tab, currentElements(state), 'ops');
  const rebound = rebindArrowAnchorsAfterMove(landed, movedBoxes(state.before, landed));
  // An element that ends as it began is the element it began as (E1, I2).
  const elements = lanesToFront(rebound).map((el) => {
    const was = state.before.get(el.id);
    return was && was !== el && sameValue(was, el) ? was : el;
  });
  const next: Tab = { ...state.tab, elements };
  return isValidTab(next) ? next : tabRejection(next);
}
