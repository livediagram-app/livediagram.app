// Yjs document model for the diagram (spec/75, Level 2).
//
// This is the FOUNDATION of Level 2, not the cut-over: it defines how a
// diagram maps to a Yjs CRDT and the pure read/write/apply helpers, so the
// merge behaviour can be unit-tested off-editor. Wiring the editor's state
// to project from this doc (behind a flag) is the separate, later step the
// spec stages last — nothing here is imported by the live editor yet, and
// it lives on the `./yjs` subpath so the core bundle never pulls in Yjs.
//
// Shape:
//   ydoc.getArray('tabOrder')  -> Y.Array<tabId>        (diagram tab order)
//   ydoc.getMap('tabs')        -> Y.Map<tabId, tabMap>
//     tabMap                    -> meta fields (name, background…) as plain
//                                  values + 'elements' + 'order'
//       'elements'              -> Y.Map<elementId, elMap>
//         elMap                 -> one entry per element field (x, y, …)
//       'order'                 -> Y.Array<elementId>    (z-order on the tab)
//
// Why this shape: element FIELDS are individual Y.Map entries, so two peers
// editing DIFFERENT fields of the same element both land (the Level 2 win
// the whole-element `update` of Level 0 can't give). Z-order is a Y.Array of
// ids so moves resolve deterministically without rewriting element bodies.

import * as Y from 'yjs';
import type { Element, Tab } from './index';
import { diffToElementOps, type ElementOp } from './element-ops';

const TAB_ORDER_KEY = 'tabOrder';
const TABS_KEY = 'tabs';
const ELEMENTS_KEY = 'elements';
const ORDER_KEY = 'order';
// Tab keys that are NOT plain meta: they have their own Y containers.
const TAB_STRUCTURAL_KEYS = new Set<string>([ELEMENTS_KEY, ORDER_KEY]);

function elementFields(el: Element): [string, unknown][] {
  return Object.entries(el);
}

// Populate an (already-attached) element Y.Map from a plain element. Attach
// first, then set fields, so every child is integrated exactly once.
function fillElement(elMap: Y.Map<unknown>, el: Element): void {
  for (const [k, v] of elementFields(el)) elMap.set(k, v);
}

function readElement(elMap: Y.Map<unknown>): Element {
  const el: Record<string, unknown> = {};
  for (const [k, v] of elMap.entries()) el[k] = v;
  return el as unknown as Element;
}

// Overwrite the whole doc from a Tab[] (e.g. seeding from a D1 hydrate).
// Runs in one transaction so observers see a single atomic change.
export function writeDiagram(ydoc: Y.Doc, tabs: Tab[]): void {
  const tabsMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY);
  const tabOrder = ydoc.getArray<string>(TAB_ORDER_KEY);
  ydoc.transact(() => {
    tabsMap.clear();
    tabOrder.delete(0, tabOrder.length);
    for (const tab of tabs) {
      const tabMap = new Y.Map<unknown>();
      tabsMap.set(tab.id, tabMap); // attach before populating
      for (const [k, v] of Object.entries(tab)) {
        if (k === 'elements') continue;
        tabMap.set(k, v);
      }
      const elsMap = new Y.Map<Y.Map<unknown>>();
      tabMap.set(ELEMENTS_KEY, elsMap);
      const order = new Y.Array<string>();
      tabMap.set(ORDER_KEY, order);
      for (const el of tab.elements) {
        const elMap = new Y.Map<unknown>();
        elsMap.set(el.id, elMap);
        fillElement(elMap, el);
        order.push([el.id]);
      }
      tabOrder.push([tab.id]);
    }
  });
}

// Project the doc back to the editor's Tab[] shape. This is what a doc
// observer feeds into React state at cut-over.
export function readDiagram(ydoc: Y.Doc): Tab[] {
  const tabsMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY);
  const tabOrder = ydoc.getArray<string>(TAB_ORDER_KEY);
  // Fall back to the map's own key order if tabOrder wasn't populated.
  const ids = tabOrder.length ? tabOrder.toArray() : [...tabsMap.keys()];
  const tabs: Tab[] = [];
  for (const tabId of ids) {
    const tabMap = tabsMap.get(tabId);
    if (!tabMap) continue;
    tabs.push(readTab(tabId, tabMap));
  }
  return tabs;
}

function readTab(tabId: string, tabMap: Y.Map<unknown>): Tab {
  const meta: Record<string, unknown> = {};
  for (const [k, v] of tabMap.entries()) {
    if (!TAB_STRUCTURAL_KEYS.has(k)) meta[k] = v;
  }
  const elsMap = tabMap.get(ELEMENTS_KEY) as Y.Map<Y.Map<unknown>> | undefined;
  const order = tabMap.get(ORDER_KEY) as Y.Array<string> | undefined;
  const elements = elsMap ? readElementsFrom(elsMap, order ?? new Y.Array<string>()) : [];
  return { ...meta, id: tabId, elements } as unknown as Tab;
}

// Apply a Level 0 ElementOp to a tab inside the doc. This is the bridge that
// lets Level 0's op vocabulary drive the CRDT: the same ops already flowing
// over the wire mutate the Yjs doc field-by-field. Unknown tab/id ops are
// safe no-ops, matching applyElementOp's array semantics.
export function applyElementOpToDoc(ydoc: Y.Doc, tabId: string, op: ElementOp): void {
  const tabMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY).get(tabId);
  if (!tabMap) return;
  const elsMap = tabMap.get(ELEMENTS_KEY) as Y.Map<Y.Map<unknown>> | undefined;
  const order = tabMap.get(ORDER_KEY) as Y.Array<string> | undefined;
  if (!elsMap || !order) return;
  ydoc.transact(() => applyOpToContainers(elsMap, order, op));
}

// The op-application core, containers passed in so both applyElementOpToDoc
// (single op, its own transaction) and syncDiagram (many ops, one shared
// transaction) reuse it.
function applyOpToContainers(
  elsMap: Y.Map<Y.Map<unknown>>,
  order: Y.Array<string>,
  op: ElementOp,
): void {
  switch (op.kind) {
    case 'add': {
      setElement(elsMap, op.element);
      if (!order.toArray().includes(op.element.id)) {
        order.insert(Math.max(0, Math.min(op.at, order.length)), [op.element.id]);
      }
      break;
    }
    case 'update': {
      // Field-level: only touch the fields that actually changed, so a
      // concurrent edit to a DIFFERENT field of this element survives.
      const elMap = elsMap.get(op.element.id);
      if (elMap) mergeElementFields(elMap, op.element);
      else setElement(elsMap, op.element); // lost the race to a remove -> re-add
      break;
    }
    case 'remove': {
      elsMap.delete(op.id);
      const i = order.toArray().indexOf(op.id);
      if (i !== -1) order.delete(i, 1);
      break;
    }
    case 'reorder': {
      order.delete(0, order.length);
      order.push(op.ids.slice());
      break;
    }
  }
}

// Incrementally reshape the whole doc to match a `Tab[]` — the local-commit
// path of the Level 2 cut-over. Unlike writeDiagram (clear + rebuild, which
// throws away CRDT identity and would clobber a concurrent peer edit), this
// diffs: it adds/removes tabs, syncs each tab's meta and elements field by
// field via the same op core, and fixes tab order — so the emitted Yjs
// update carries only what actually changed and merges cleanly with a peer.
export function syncDiagram(ydoc: Y.Doc, tabs: Tab[]): void {
  const tabsMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY);
  const tabOrder = ydoc.getArray<string>(TAB_ORDER_KEY);
  ydoc.transact(() => {
    const nextIds = new Set(tabs.map((t) => t.id));
    for (const id of [...tabsMap.keys()]) {
      if (!nextIds.has(id)) tabsMap.delete(id);
    }
    for (const tab of tabs) {
      let tabMap = tabsMap.get(tab.id);
      if (!tabMap) {
        tabMap = new Y.Map<unknown>();
        tabsMap.set(tab.id, tabMap);
        tabMap.set(ELEMENTS_KEY, new Y.Map<Y.Map<unknown>>());
        tabMap.set(ORDER_KEY, new Y.Array<string>());
      }
      syncTabMeta(tabMap, tab);
      syncTabElements(tabMap, tab);
    }
    const desired = tabs.map((t) => t.id);
    if (!sameStringOrder(tabOrder.toArray(), desired)) {
      tabOrder.delete(0, tabOrder.length);
      tabOrder.push(desired);
    }
  });
}

function sameStringOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Diff a tab's non-structural meta into its Y.Map: set changed/added fields,
// delete fields that vanished. `id` never changes; structural containers are
// left alone.
function syncTabMeta(tabMap: Y.Map<unknown>, tab: Tab): void {
  const next = new Map<string, unknown>();
  for (const [k, v] of Object.entries(tab)) {
    if (k === 'elements' || k === 'id' || TAB_STRUCTURAL_KEYS.has(k)) continue;
    next.set(k, v);
  }
  for (const key of [...tabMap.keys()]) {
    if (key === 'id' || TAB_STRUCTURAL_KEYS.has(key)) continue;
    if (!next.has(key)) tabMap.delete(key);
  }
  for (const [k, v] of next) {
    if (JSON.stringify(tabMap.get(k)) !== JSON.stringify(v)) tabMap.set(k, v);
  }
}

function syncTabElements(tabMap: Y.Map<unknown>, tab: Tab): void {
  const elsMap = tabMap.get(ELEMENTS_KEY) as Y.Map<Y.Map<unknown>>;
  const order = tabMap.get(ORDER_KEY) as Y.Array<string>;
  const current = readElementsFrom(elsMap, order);
  for (const op of diffToElementOps(current, tab.elements)) {
    applyOpToContainers(elsMap, order, op);
  }
}

function readElementsFrom(elsMap: Y.Map<Y.Map<unknown>>, order: Y.Array<string>): Element[] {
  const ids = order.length ? order.toArray() : [...elsMap.keys()];
  const out: Element[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const elMap = elsMap.get(id);
    if (elMap) out.push(readElement(elMap));
  }
  return out;
}

function setElement(elsMap: Y.Map<Y.Map<unknown>>, el: Element): void {
  const elMap = new Y.Map<unknown>();
  elsMap.set(el.id, elMap);
  fillElement(elMap, el);
}

// Diff the element into the Y.Map field by field: set changed/added fields,
// delete fields that vanished. Setting only what changed is what preserves a
// peer's concurrent edit to an untouched field.
function mergeElementFields(elMap: Y.Map<unknown>, el: Element): void {
  const next = new Map(elementFields(el));
  for (const key of [...elMap.keys()]) {
    if (!next.has(key)) elMap.delete(key);
  }
  for (const [k, v] of next) {
    if (JSON.stringify(elMap.get(k)) !== JSON.stringify(v)) elMap.set(k, v);
  }
}

// Encode / apply updates: the transport primitives the DO relays + persists
// at Level 2 (opaque binary; Level 1's op log generalises to an update log).
export function encodeDiagramUpdate(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

export function applyDiagramUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update);
}

// A fresh, empty diagram doc. Peers must share ONE doc history for
// field-level merge to work (independently seeded docs would resolve
// whole-key last-writer-wins, not per-field) — so the room holds the
// authoritative doc and seeds joiners from it (spec/75, Level 2).
export function newDiagramDoc(): Y.Doc {
  return new Y.Doc();
}

// True when the doc carries no tabs yet — the room uses this to tell a
// joiner "there's no shared doc, seed yourself from your D1 hydrate".
export function isEmptyDiagramDoc(ydoc: Y.Doc): boolean {
  return ydoc.getMap(TABS_KEY).size === 0;
}

// Yjs updates are binary; the room's wire frames are JSON, so updates ride
// as base64. Kept here (with encode/apply) so both the worker DO and the
// browser client share one binary<->text convention.
export function updateToBase64(update: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < update.length; i++) binary += String.fromCharCode(update[i]!);
  return btoa(binary);
}

export function base64ToUpdate(b64: string): Uint8Array {
  const binary = atob(b64);
  const update = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) update[i] = binary.charCodeAt(i);
  return update;
}
