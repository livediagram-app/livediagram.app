// The working state an apply carries (docs/specs/024-agents/blueprints/edit-operations.md "The
// pipeline"): the tab as the operations have left it so far, and what they touched, created,
// resolved and removed. Operations write on this copy; the input tab is never mutated (I1).

import type { EditRejection, EditWarning } from '@liveplanner/api-schema';
import {
  computeRefs,
  isSlugId,
  contentOrigin,
  type Element,
  type ElementId,
  type RefTable,
  type Tab,
} from '@liveplanner/project';
import { lockedIds } from './locks';
import type { Naming } from './element-text';
import { elementLocked, type LockReason } from './rejections';
import type { ApplyOptions, EditLog, EditOperation } from './types';

// The first operation that touched an element, and the fields operations wrote on it in the order
// written: how its ~ line orders them.
export type Touch = { operation: number; written: string[] };

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
  // The same ids as a set, so noting one is O(1) however many a selector resolves.
  readonly targetSet: Set<ElementId>;
  readonly removed: Set<ElementId>;
  readonly warnings: EditWarning[];
  readonly locked: ReadonlyMap<ElementId, LockReason>;
  readonly makeId: () => string;
  readonly log: EditLog;
  // The owner's selection; null when the room was not read.
  readonly selected: readonly ElementId[] | null;
  // The input tab's content origin: what coordinates shown are relative to.
  readonly origin: { x: number; y: number };
  // Refs, recomputed when an element is added or removed; the element list, after any write. Every write goes
  // through the functions below, which clear them.
  readonly memo: { refs: RefTable | null; elements: readonly Element[] | null };
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
    targetSet: new Set(),
    removed: new Set(),
    warnings: [],
    locked: lockedIds(tab),
    makeId: options.makeId ?? (() => crypto.randomUUID()),
    log,
    selected: options.selected === undefined ? [] : options.selected,
    origin: contentOrigin(tab.elements),
    memo: { refs: null, elements: null },
  };
}

// The working elements, in element order.
export function currentElements(state: EditState): readonly Element[] {
  if (state.memo.elements) return state.memo.elements;
  const elements: Element[] = [];
  for (const id of state.order) {
    const el = state.byId.get(id);
    if (el) elements.push(el);
  }
  state.memo.elements = elements;
  return elements;
}

// What a write leaves stale.
function written(state: EditState, { added }: { added: boolean }): void {
  if (added) state.memo.refs = null;
  state.memo.elements = null;
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
  const touched = touch(state, el.id, operation);
  for (const key of keys) if (!touched.written.includes(key)) touched.written.push(key);
}

// Writes an element over its id (or appends a new one) and marks it touched. An id created and
// removed earlier in the changeset keeps its place in the order.
export function putElement(state: EditState, el: Element, operation: number): void {
  const known = state.byId.has(el.id) || state.before.has(el.id) || state.removed.has(el.id);
  if (!known) state.order.push(el.id);
  written(state, { added: !state.byId.has(el.id) });
  state.byId.set(el.id, el);
  touch(state, el.id, operation);
}

// An element rewritten in place by finalising, outside any operation.
export function replaceElement(state: EditState, el: Element): void {
  state.byId.set(el.id, el);
  written(state, { added: false });
}

export function removeElement(state: EditState, id: ElementId, operation: number): void {
  state.byId.delete(id);
  written(state, { added: true });
  state.removed.add(id);
  touch(state, id, operation);
}

// True when an id names an element of the tab or one the changeset has created.
export function isTaken(state: EditState, id: ElementId): boolean {
  return state.byId.has(id) || state.before.has(id);
}

// The working ref table. A slug id present is its own ref (computeRefs' rule), so it is answered from
// `byId`; the id list and the table are built on first need, once per add or remove.
export function refsOf(state: EditState): RefTable {
  if (state.memo.refs) return state.memo.refs;
  let table: RefTable | null = null;
  const built = () => (table ??= computeRefs(currentElements(state).map((el) => el.id)));
  state.memo.refs = {
    get ids() {
      return built().ids;
    },
    refOf: (id) => (state.byId.has(id) && isSlugId(id) ? id : built().refOf(id)),
  };
  return state.memo.refs;
}

// How refusals name working elements: by ref.
export function namingOf(state: EditState): Naming {
  return { refOf: (id) => refsOf(state).refOf(id) };
}

// A pre-existing element joins the targets the first time an operation resolves it (EO46).
export function noteTarget(state: EditState, id: ElementId): void {
  if (!state.before.has(id) || state.targetSet.has(id)) return;
  state.targetSet.add(id);
  state.targets.push(id);
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
