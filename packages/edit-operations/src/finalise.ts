// The working state made into the next tab (docs/specs/024-agents/blueprints/edit-operations.md
// "Finalise"): touched elements normalised and their shape kinds coerced, then checked, workshop
// notes landed on lanes, arrows re-anchored around moved boxes, lanes behind what they hold, and the
// whole tab validated. Untouched elements pass through as the same objects (I2).

import type { EditRejection } from '@livediagram/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  coerceShapeKind,
  deriveContainers,
  isContainer,
  elementValidationIssue,
  isValidTab,
  landWorkshopArrivals,
  lanesToFront,
  normaliseElement,
  rebindArrowAnchorsAfterMove,
  type BoxedElement,
  type Element,
  type ElementId,
  type Tab,
} from '@livediagram/document';
import { kindOf } from './element-text';
import { sameValue } from './equality';
import { invalidResult } from './rejections';
import { currentElements, replaceElement, type EditState } from './state';
import type { EditLog } from './types';

type Raw = Record<string, unknown>;

const GEOMETRY: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height', 'from', 'to']);

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
  for (const [id, { operation, written }] of state.touched) {
    const el = state.byId.get(id);
    // Normalising settles what an operation wrote; an element only moved, carried or grown changes
    // nothing but where it is and how big.
    if (!el || (!!state.before.has(id) && written.every((key) => GEOMETRY.has(key)))) continue;
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

// Workshop notes a lane took in: a note no operation wrote reports the landing as its move.
function noteLandings(state: EditState, landed: readonly Element[]): void {
  for (const el of landed) {
    if (state.byId.get(el.id) === el) continue;
    replaceElement(state, el);
    // Only notes that moved arrive, and moving one touches it.
    const touched = state.touched.get(el.id)!;
    if (touched.written.length > 0 || !state.before.has(el.id)) continue;
    touched.moved = 'landed on a lane';
    delete touched.shift;
  }
}

// Every container directly before its earliest member when it is after it, innermost first, so an
// outer container ends before the inner ones it holds (I6).
export function containersBehindMembers(elements: readonly Element[]): Element[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const members = new Map<BoxedElement, ElementId[]>();
  for (const [id, holder] of deriveContainers(elements)) {
    const container = holder ? byId.get(holder) : undefined;
    // A mind node holds its children by link, not by drawing behind them.
    if (!container || container.type === 'arrow' || !isContainer(container)) continue;
    const held = members.get(container);
    if (held) held.push(id);
    else members.set(container, [id]);
  }
  const order = elements.map((el) => el.id);
  // Each id's index in `order`, kept true as containers move: a move shifts only the range it crosses, so the
  // pass is linear in the tab plus what actually moves, never a scan of the order per member.
  const at = new Map(order.map((id, i) => [id, i]));
  const innermostFirst = [...members].sort(([a], [b]) => a.width * a.height - b.width * b.height);
  for (const [container, held] of innermostFirst) {
    const from = at.get(container.id)!;
    let earliest = Infinity;
    for (const id of held) earliest = Math.min(earliest, at.get(id)!);
    if (earliest > from) continue;
    order.splice(from, 1);
    order.splice(earliest, 0, container.id);
    for (let i = earliest; i <= from; i++) at.set(order[i]!, i);
  }
  return order.map((id) => byId.get(id)!);
}

export function finalise(state: EditState, log: EditLog): Tab | EditRejection {
  normaliseTouched(state, log);
  const issue = touchedIssue(state);
  if (issue) return issue;
  const landed = landWorkshopArrivals(state.tab, [...currentElements(state)], 'ops');
  noteLandings(state, landed);
  const rebound = rebindArrowAnchorsAfterMove(landed, movedBoxes(state.before, landed));
  // An element that ends as it began is the element it began as (E1, I2).
  const elements = containersBehindMembers(lanesToFront(rebound)).map((el) => {
    const was = state.before.get(el.id);
    return was && was !== el && sameValue(was, el) ? was : el;
  });
  const next: Tab = { ...state.tab, elements };
  return isValidTab(next) ? next : tabRejection(next);
}
