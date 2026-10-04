// The working state an apply carries (docs/specs/024-agents/blueprints/edit-operations.md "The
// pipeline"): the tab as the operations have left it so far, and what they touched, created,
// resolved and removed. Operations write on this copy; the input tab is never mutated (I1).

import type { EditRejection, EditWarning } from '@livediagram/api-schema';
import type { Element, ElementId, Tab } from '@livediagram/document';
import { lockedIds } from './locks';
import { elementLocked, targetNotFound, type LockReason } from './rejections';
import type { ApplyOptions, EditLog, EditOperation } from './types';

// The first operation that touched an element, and the fields operations wrote on it in the order
// written: how its ~ line orders them.
export type Touch = { operation: number; written: string[] };

// Why an element left: named by an operation, or pinned to one that was.
export type Removal = { pinnedTo?: ElementId };

export type EditState = {
  readonly tab: Tab;
  readonly before: ReadonlyMap<ElementId, Element>;
  readonly byId: Map<ElementId, Element>;
  // Element order; ids no longer in `byId` are skipped when the next tab is built.
  readonly order: ElementId[];
  // Each id an operation created, changed or removed, in the order first touched.
  readonly touched: Map<ElementId, Touch>;
  readonly created: ElementId[];
  // Pre-existing ids the operations resolved, first resolution first (EO46).
  readonly targets: ElementId[];
  readonly removed: Map<ElementId, Removal>;
  readonly warnings: EditWarning[];
  readonly locked: ReadonlyMap<ElementId, LockReason>;
  readonly makeId: () => string;
  readonly log: EditLog;
};

export function createState(tab: Tab, options: ApplyOptions, log: EditLog): EditState {
  const before = new Map(tab.elements.map((el) => [el.id, el]));
  return {
    tab,
    before,
    byId: new Map(before),
    order: tab.elements.map((el) => el.id),
    touched: new Map(),
    created: [],
    targets: [],
    removed: new Map(),
    warnings: [],
    locked: lockedIds(tab),
    makeId: options.makeId ?? (() => crypto.randomUUID()),
    log,
  };
}

// The working elements, in element order.
export function currentElements(state: EditState): Element[] {
  const elements: Element[] = [];
  for (const id of state.order) {
    const el = state.byId.get(id);
    if (el) elements.push(el);
  }
  return elements;
}

export function touch(state: EditState, id: ElementId, operation: number): Touch {
  const existing = state.touched.get(id);
  if (existing) return existing;
  const touched: Touch = { operation, written: [] };
  state.touched.set(id, touched);
  return touched;
}

// Writes an element over its id, noting the fields the operation wrote.
export function writeFields(
  state: EditState,
  el: Element,
  operation: number,
  keys: readonly string[],
): void {
  putElement(state, el, operation);
  const { written } = touch(state, el.id, operation);
  for (const key of keys) if (!written.includes(key)) written.push(key);
}

// Writes an element over its id (or appends a new one) and marks it touched. An id created and
// removed earlier in the changeset keeps its place in the order.
export function putElement(state: EditState, el: Element, operation: number): void {
  const known = state.byId.has(el.id) || state.before.has(el.id) || state.removed.has(el.id);
  if (!known) state.order.push(el.id);
  state.byId.set(el.id, el);
  touch(state, el.id, operation);
}

export function removeElement(
  state: EditState,
  id: ElementId,
  operation: number,
  removal: Removal,
): void {
  state.byId.delete(id);
  state.removed.set(id, removal);
  touch(state, id, operation);
}

// True when an id names an element of the tab or one the changeset has created.
export function isTaken(state: EditState, id: ElementId): boolean {
  return state.byId.has(id) || state.before.has(id);
}

// The element a selector names, against the working state: in this build, the exact id. A
// pre-existing element joins the targets the first time it resolves.
export function resolveTarget(
  state: EditState,
  selector: string,
  operation: number,
): { el: Element } | { rejection: EditRejection } {
  const el = state.byId.get(selector);
  if (!el) return { rejection: targetNotFound(selector, operation, currentElements(state)) };
  if (state.before.has(el.id) && !state.targets.includes(el.id)) state.targets.push(el.id);
  return { el };
}

// The refusal of an operation that would change a locked element, logged with its scope.
export function refuseLocked(
  state: EditState,
  op: EditOperation['op'],
  operation: number,
  el: Element,
  lock: LockReason,
): EditRejection {
  state.log('[edit-ops] locked', { operation, op, scope: lock.scope });
  return elementLocked(operation, el, lock);
}
