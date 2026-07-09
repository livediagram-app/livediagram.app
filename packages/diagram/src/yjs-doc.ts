// Yjs element model for the diagram (spec/75, Level 2).
//
// The CRDT models ONLY element content — the one place last-writer-wins
// actually loses data users notice (two people editing different fields of
// the same element). Everything coarser — which tabs exist, their order,
// names, backgrounds, and the diagram name — stays on the `diagram-meta`
// room op, where it's rarely concurrent and last-writer-wins is fine. So
// the doc is a namespaced bag of per-tab element sets, nothing more.
//
// Shape:
//   ydoc.getMap('tabs')  -> Y.Map<tabId, tabMap>
//     tabMap              -> { 'elements': Y.Map<elementId, elMap>,
//                             'order':    Y.Array<elementId> }
//       elMap             -> one entry per element field (x, y, fill, …)
//
// Element ids are only unique PER TAB in this codebase (older diagrams
// duplicated ids across tabs), so elements are namespaced by tabId. Element
// FIELDS are individual Y.Map entries, so two peers editing different fields
// of the same element both land — the Level 2 win the whole-element `update`
// of Level 0 can't give. Z-order is a Y.Array of ids so moves resolve
// deterministically without rewriting element bodies. Lives on the `./yjs`
// subpath so the core bundle never pulls in Yjs unless the flag path is used.

import * as Y from 'yjs';
import type { Element, Tab } from './index';
import { diffToElementOps, type ElementOp } from './element-ops';

const TABS_KEY = 'tabs';
const ELEMENTS_KEY = 'elements';
const ORDER_KEY = 'order';

function fillElement(elMap: Y.Map<unknown>, el: Element): void {
  for (const [k, v] of Object.entries(el)) elMap.set(k, v);
}

function readElement(elMap: Y.Map<unknown>): Element {
  const el: Record<string, unknown> = {};
  for (const [k, v] of elMap.entries()) el[k] = v;
  return el as unknown as Element;
}

function setElement(elsMap: Y.Map<Y.Map<unknown>>, el: Element): void {
  const elMap = new Y.Map<unknown>();
  elsMap.set(el.id, elMap); // attach before populating
  fillElement(elMap, el);
}

// Diff the element into the Y.Map field by field: set changed/added fields,
// delete fields that vanished. Setting only what changed is what preserves a
// peer's concurrent edit to an untouched field.
function mergeElementFields(elMap: Y.Map<unknown>, el: Element): void {
  const next = new Map(Object.entries(el));
  for (const key of [...elMap.keys()]) {
    if (!next.has(key)) elMap.delete(key);
  }
  for (const [k, v] of next) {
    if (JSON.stringify(elMap.get(k)) !== JSON.stringify(v)) elMap.set(k, v);
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

// The two containers a tab holds, created together and always in step.
type TabContainers = { elsMap: Y.Map<Y.Map<unknown>>; order: Y.Array<string> };

function makeTab(tabsMap: Y.Map<Y.Map<unknown>>, tabId: string): TabContainers {
  const tabMap = new Y.Map<unknown>();
  tabsMap.set(tabId, tabMap); // attach before populating
  const elsMap = new Y.Map<Y.Map<unknown>>();
  tabMap.set(ELEMENTS_KEY, elsMap);
  const order = new Y.Array<string>();
  tabMap.set(ORDER_KEY, order);
  return { elsMap, order };
}

function tabContainers(ydoc: Y.Doc, tabId: string): TabContainers | null {
  const tabMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY).get(tabId);
  if (!tabMap) return null;
  const elsMap = tabMap.get(ELEMENTS_KEY) as Y.Map<Y.Map<unknown>> | undefined;
  const order = tabMap.get(ORDER_KEY) as Y.Array<string> | undefined;
  if (!elsMap || !order) return null;
  return { elsMap, order };
}

// Seed the doc's element sets from a Tab[] (e.g. a fresh D1 hydrate). One
// transaction, so observers see a single atomic change. Meta/order of the
// tabs themselves is ignored — that's the diagram-meta op's job.
export function writeElements(ydoc: Y.Doc, tabs: Tab[]): void {
  const tabsMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY);
  ydoc.transact(() => {
    tabsMap.clear();
    for (const tab of tabs) {
      const { elsMap, order } = makeTab(tabsMap, tab.id);
      for (const el of tab.elements) {
        setElement(elsMap, el);
        order.push([el.id]);
      }
    }
  });
}

// Incrementally reshape the doc's element sets to match a Tab[] — the
// local-commit path. Unlike writeElements (clear + rebuild, which throws away
// CRDT identity and would clobber a concurrent peer edit), this diffs: it
// adds/removes tab element-sets and syncs each tab's elements field by field
// via the shared op core, so the emitted update carries only real changes and
// merges cleanly with a peer.
export function syncElements(ydoc: Y.Doc, tabs: Tab[]): void {
  const tabsMap = ydoc.getMap<Y.Map<unknown>>(TABS_KEY);
  ydoc.transact(() => {
    const nextIds = new Set(tabs.map((t) => t.id));
    for (const id of [...tabsMap.keys()]) {
      if (!nextIds.has(id)) tabsMap.delete(id);
    }
    for (const tab of tabs) {
      const containers = tabContainers(ydoc, tab.id) ?? makeTab(tabsMap, tab.id);
      const current = readElementsFrom(containers.elsMap, containers.order);
      for (const op of diffToElementOps(current, tab.elements)) {
        applyOpToContainers(containers.elsMap, containers.order, op);
      }
    }
  });
}

// Apply a Level 0 ElementOp to a tab inside the doc — the bridge that lets
// Level 0's op vocabulary drive the CRDT field-by-field. Unknown tab / id ops
// are safe no-ops, matching applyElementOp's array semantics.
export function applyElementOpToDoc(ydoc: Y.Doc, tabId: string, op: ElementOp): void {
  const containers = tabContainers(ydoc, tabId);
  if (!containers) return;
  ydoc.transact(() => applyOpToContainers(containers.elsMap, containers.order, op));
}

// The op-application core, containers passed in so both applyElementOpToDoc
// (single op, its own transaction) and syncElements (many ops, one shared
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

// The doc's elements for one tab, or null when the doc has no set for it
// (a tab the diagram-meta op just created but no `ydoc` op has populated).
export function readTabElements(ydoc: Y.Doc, tabId: string): Element[] | null {
  const containers = tabContainers(ydoc, tabId);
  return containers ? readElementsFrom(containers.elsMap, containers.order) : null;
}

// Project the doc onto a Tab[]: each tab keeps its own meta/order (owned by
// diagram-meta) and takes its elements from the doc where present. This is
// what the editor merges into React state on a remote `ydoc` update.
export function mergeElements(ydoc: Y.Doc, tabs: Tab[]): Tab[] {
  return tabs.map((tab) => {
    const els = readTabElements(ydoc, tab.id);
    return els ? { ...tab, elements: els } : tab;
  });
}

// Encode / apply updates: the transport primitives the room relays + holds
// (opaque binary; Level 1's op log generalises to an update log).
export function encodeDiagramUpdate(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

export function applyDiagramUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update);
}

// A fresh, empty diagram doc. Peers must share ONE doc history for field-level
// merge to work (independently seeded docs would resolve whole-key
// last-writer-wins, not per-field) — so the room holds the authoritative doc
// and seeds joiners from it (spec/75, Level 2).
export function newDiagramDoc(): Y.Doc {
  return new Y.Doc();
}

// True when the doc carries no tab element-sets yet — the room uses this to
// tell a joiner "there's no shared doc, seed yourself from your D1 hydrate".
export function isEmptyDiagramDoc(ydoc: Y.Doc): boolean {
  return ydoc.getMap(TABS_KEY).size === 0;
}

// Yjs updates are binary; the room's wire frames are JSON, so updates ride as
// base64. Kept here (with encode/apply) so both the worker DO and the browser
// client share one binary<->text convention.
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
