// The working state an apply carries (docs/specs/024-agents/blueprints/edit-operations.md "The
// pipeline"): the tab as the operations have left it so far, and what they touched, created,
// resolved and removed. Operations write on this copy; the input tab is never mutated (I1).

import type { EditRejection, EditWarning } from '@livediagram/api-schema';
import {
  computeRefs,
  isSlugId,
  contentOrigin,
  DEFAULT_SCHEME_ID,
  deriveContainers,
  getBuiltInTheme,
  THEMES,
  type ThemeDefinition,
  type Element,
  type BoxedElement,
  type ElementId,
  type RefTable,
  type Tab,
} from '@livediagram/document';
import { lockedIds } from './locks';
import type { Naming } from './element-text';
import type { Fit } from './labels';
import { elementLocked, type LockReason } from './rejections';
import type { ApplyOptions, EditLog, EditOperation } from './types';
import { RESERVED_WORDS } from './vocabulary';

// The first operation that touched an element, and the fields operations wrote on it in the order
// written: how its ~ line orders them.
// Why an element moved without an operation naming it.
export type MoveReason = 'make room' | 'carried' | 'laid out' | 'landed on a lane';

// `moved` marks an element only moved along, which prints as a » line and is not normalised.
// How `layout` laid elements out, as its `»` line says.
export type LaidOut = { style: 'flow' | 'tree' | 'mindmap'; direction?: 'down' | 'right' };

export type Touch = {
  operation: number;
  written: string[];
  fit?: Fit;
  moved?: MoveReason;
  // The summed shift of an element moved along, when the move had one.
  shift?: [number, number];
  // How `layout` laid it out.
  layout?: LaidOut;
  // The arrow a new arrow copied its style from (insert).
  styleOf?: ElementId;
  // Where `order` put it: front, back, or above or below a ref.
  ordered?: string;
};

// Why an element left: named by an operation, or pinned to one that was.
export type Removal = { pinnedTo?: ElementId; unwrapped?: true };

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
  // The owner's selection; null when the room was not read.
  readonly selected: readonly ElementId[] | null;
  // The tab's theme, which theme colour names and new elements' paint come from.
  readonly theme: ThemeDefinition;
  // The input tab's content origin: what coordinates shown and taken are relative to.
  readonly origin: { x: number; y: number };
  // Every id the tab holds or the changeset used, and every keyword: what a new id may not be.
  readonly taken: Set<string>;
  // Refs, recomputed when an element is added or removed; holders and the element list, after any
  // write. Every write goes through the functions below, which clear them.
  readonly memo: {
    refs: RefTable | null;
    holders: Map<ElementId, ElementId | null> | null;
    elements: readonly Element[] | null;
  };
};

// The tab's built-in theme; a custom one the caller did not resolve paints as the default (E11).
function themeOf(tab: Tab, log: EditLog): ThemeDefinition {
  if (
    tab.theme !== undefined &&
    tab.theme !== DEFAULT_SCHEME_ID &&
    !THEMES.some((t) => t.id === tab.theme)
  )
    log('[edit-ops] theme-fallback', {});
  return getBuiltInTheme(tab.theme);
}

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
    selected: options.selected === undefined ? [] : options.selected,
    theme: options.theme ?? themeOf(tab, log),
    origin: contentOrigin(tab.elements),
    taken: new Set([...before.keys(), ...RESERVED_WORDS]),
    memo: { refs: null, holders: null, elements: null },
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
  state.memo.holders = null;
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
  delete touched.moved;
}

// Writes an element over its id (or appends a new one) and marks it touched. An id created and
// removed earlier in the changeset keeps its place in the order.
export function putElement(state: EditState, el: Element, operation: number): void {
  const known = state.byId.has(el.id) || state.before.has(el.id) || state.removed.has(el.id);
  if (!known) state.order.push(el.id);
  written(state, { added: !state.byId.has(el.id) });
  state.taken.add(el.id);
  state.byId.set(el.id, el);
  touch(state, el.id, operation);
}

// Writes an element an operation moved without naming it (carried, made room for, laid out, landed).
export function moveElement(
  state: EditState,
  el: Element,
  operation: number,
  reason: MoveReason,
  how: { shift?: [number, number]; layout?: LaidOut } = {},
): void {
  putElement(state, el, operation);
  const touched = touch(state, el.id, operation);
  if (touched.written.length > 0 || !state.before.has(el.id)) return;
  touched.moved ??= reason;
  if (how.layout) touched.layout = how.layout;
  const { shift } = how;
  if (shift)
    touched.shift = [(touched.shift?.[0] ?? 0) + shift[0], (touched.shift?.[1] ?? 0) + shift[1]];
}

// Adds a new element at a place in the element order: directly after `after`, or before `before`.
export function insertElement(
  state: EditState,
  el: Element,
  operation: number,
  at: { after: ElementId } | { before: ElementId },
): void {
  putElement(state, el, operation);
  state.order.splice(state.order.lastIndexOf(el.id), 1);
  const anchor = state.order.indexOf('after' in at ? at.after : at.before);
  state.order.splice('after' in at ? anchor + 1 : anchor, 0, el.id);
  written(state, { added: false });
}

// The element order replaced, as `order` rearranges it.
export function reorder(state: EditState, ids: readonly ElementId[]): void {
  state.order.splice(0, state.order.length, ...ids);
  written(state, { added: false });
}

// An element rewritten in place by finalising, outside any operation.
export function replaceElement(state: EditState, el: Element): void {
  state.byId.set(el.id, el);
  written(state, { added: false });
}

export function removeElement(
  state: EditState,
  id: ElementId,
  operation: number,
  removal: Removal,
): void {
  state.byId.delete(id);
  written(state, { added: true });
  state.removed.set(id, removal);
  touch(state, id, operation);
}

// True when an id names an element of the tab or one the changeset has created.
export function isTaken(state: EditState, id: ElementId): boolean {
  return state.byId.has(id) || state.before.has(id);
}

// The working elements' refs: an element's short name, as views print it.
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

// Each working element's container (the smallest frame or lane holding its centre), or null.
export function holdersOf(state: EditState): ReadonlyMap<ElementId, ElementId | null> {
  state.memo.holders ??= deriveContainers(currentElements(state));
  return state.memo.holders;
}

// How refusals name working elements: by ref, with their container.
export function namingOf(state: EditState): Naming {
  return {
    refOf: (id) => refsOf(state).refOf(id),
    containerOf: (id) => {
      const holder = holdersOf(state).get(id);
      return holder ? refsOf(state).refOf(holder) : null;
    },
  };
}

// A working element with a box, or undefined for an arrow or an id no element holds.
export function boxedOf(state: EditState, id: ElementId): BoxedElement | undefined {
  const el = state.byId.get(id);
  return el?.type === 'arrow' ? undefined : el;
}

// A pre-existing element joins the targets the first time an operation resolves it (EO46).
export function noteTarget(state: EditState, id: ElementId): void {
  if (state.before.has(id) && !state.targets.includes(id)) state.targets.push(id);
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
