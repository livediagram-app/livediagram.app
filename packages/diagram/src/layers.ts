import { type Element, type ElementId, type Tab } from './index';
import { bringManyToFront, freezeDanglingGroupEnds, sendManyToBack } from './groups';
import { arrowReferencesAny } from './arrow-rebind';

// Photoshop-style layers (spec/74). A tab optionally carries an ordered
// `layers` array (BOTTOM -> TOP: index 0 paints lowest) and each element
// points into it via `layerId`. Everything here is pure: helpers take a
// tab (or an element list + the raw layers array) and return a new value,
// so the editor's commit/history/sync machinery applies unchanged.

export type Layer = {
  id: string;
  name: string;
  // Hidden layers don't render, hit-test, or export (spec/74). Absent =
  // visible, so untouched layers stay byte-light in the stored JSON.
  visible?: boolean;
  // Elements on a locked layer behave like `element.locked` (selectable
  // to inspect, but not movable / editable / deletable) and are skipped
  // by marquee + select-all. Absent = unlocked.
  locked?: boolean;
};

// The lazily-materialised base layer. A FIXED sentinel id (not a random
// uuid) so two clients that materialise the array concurrently converge
// on the same base layer, and so elements with a missing `layerId`
// (everything authored before spec/74) resolve to it wherever it moves
// in the stack.
export const DEFAULT_LAYER_ID = 'layer:default';
export const DEFAULT_LAYER_NAME = 'Layer 1';

// Normalised view of a tab's layers: the stored array when it has been
// materialised, else the single implicit default layer. Always non-empty.
export function tabLayers(layers: Layer[] | undefined): Layer[] {
  return layers && layers.length > 0
    ? layers
    : [{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME }];
}

export function isLayerVisible(layer: Layer): boolean {
  return layer.visible !== false;
}

export function isLayerLocked(layer: Layer): boolean {
  return layer.locked === true;
}

// Which layer an element belongs to, against a NORMALISED (non-empty)
// layers array: its own `layerId` when that layer exists, else the
// default layer, else the bottom of the stack (a foreign / stale id can
// appear via concurrent edits — never let it strand an element).
export function resolveLayerId(layerId: string | undefined, layers: Layer[]): string {
  if (layerId !== undefined && layers.some((l) => l.id === layerId)) return layerId;
  return (layers.find((l) => l.id === DEFAULT_LAYER_ID) ?? layers[0]!).id;
}

// Frames are section backdrops that must paint below their band-mates
// (spec/09) — same predicate the svg renderer uses.
const isFrameEl = (el: Element): boolean => el.type === 'shape' && el.shape === 'frame';

const framesFirstIn = (elements: Element[]): Element[] =>
  elements.some(isFrameEl)
    ? [...elements.filter(isFrameEl), ...elements.filter((el) => !isFrameEl(el))]
    : elements;

// Paint order for a tab's elements (spec/74): a stable partition into
// layer bands (bottom layer first), keeping `Tab.elements[]` order within
// each band with frames hoisted to the front OF THEIR BAND. Hidden
// layers' bands are dropped unless `includeHidden` (the export dialog's
// "include hidden layers" option). The canvas, the exporters, and the
// shared svg renderer all route through this so stacking is one rule in
// one place. Cheap no-op-ish fast path when the tab has no layer array.
export function orderByLayer(
  elements: Element[],
  layers: Layer[] | undefined,
  opts?: { includeHidden?: boolean },
): Element[] {
  const ls = tabLayers(layers);
  if (ls.length === 1) {
    if (!opts?.includeHidden && !isLayerVisible(ls[0]!)) return [];
    return framesFirstIn(elements);
  }
  const bands = bandsOf(elements, ls);
  const out: Element[] = [];
  ls.forEach((layer, i) => {
    if (!opts?.includeHidden && !isLayerVisible(layer)) return;
    out.push(...framesFirstIn(bands[i]!));
  });
  return out;
}

// Elements per band, indexed like the normalised layers array.
function bandsOf(elements: Element[], layers: Layer[]): Element[][] {
  const indexOf = new Map(layers.map((l, i) => [l.id, i]));
  const fallback = indexOf.get(resolveLayerId(undefined, layers))!;
  const bands: Element[][] = layers.map(() => []);
  for (const el of elements) {
    const i = el.layerId !== undefined ? (indexOf.get(el.layerId) ?? fallback) : fallback;
    bands[i]!.push(el);
  }
  return bands;
}

// The tab's elements minus hidden layers, in ARRAY order (not band
// order) — for bounds, Mermaid export, and any "what exists" filter
// where paint order doesn't matter. Returns the input array unchanged
// when nothing is hidden.
export function visibleLayerElements(elements: Element[], layers: Layer[] | undefined): Element[] {
  const ls = tabLayers(layers);
  if (ls.every(isLayerVisible)) return elements;
  const hidden = hiddenLayerIds(ls);
  return elements.filter((el) => !hidden.has(resolveLayerId(el.layerId, ls)));
}

// Ids of hidden / locked layers within a NORMALISED layers array.
function hiddenLayerIds(layers: Layer[]): Set<string> {
  return new Set(layers.filter((l) => !isLayerVisible(l)).map((l) => l.id));
}

// Element ids sitting on a hidden layer — the set the canvas drops from
// hit-testing, marquee, select-all, and keyboard traversal (spec/71).
export function hiddenLayerElementIds(
  elements: Element[],
  layers: Layer[] | undefined,
): Set<ElementId> {
  return elementIdsWhere(elements, layers, (l) => !isLayerVisible(l));
}

// Element ids sitting on a locked layer — combined with per-element
// `locked` at every existing lock gate (drag, edit, delete, marquee).
export function lockedLayerElementIds(
  elements: Element[],
  layers: Layer[] | undefined,
): Set<ElementId> {
  return elementIdsWhere(elements, layers, isLayerLocked);
}

function elementIdsWhere(
  elements: Element[],
  layers: Layer[] | undefined,
  predicate: (l: Layer) => boolean,
): Set<ElementId> {
  const ls = tabLayers(layers);
  const matching = new Set(ls.filter(predicate).map((l) => l.id));
  if (matching.size === 0) return new Set();
  return new Set(
    elements.filter((el) => matching.has(resolveLayerId(el.layerId, ls))).map((el) => el.id),
  );
}

// Element count per layer id (resolved membership), for the panel's
// per-row badges + the delete confirm copy.
export function layerElementCounts(tab: Pick<Tab, 'elements' | 'layers'>): Map<string, number> {
  const ls = tabLayers(tab.layers);
  const counts = new Map(ls.map((l) => [l.id, 0]));
  for (const el of tab.elements) {
    const id = resolveLayerId(el.layerId, ls);
    counts.set(id, counts.get(id)! + 1);
  }
  return counts;
}

// The active layer for a tab given the user's remembered choice: the
// remembered layer when it still exists, else the TOP layer (spec/74's
// default). Session-scoped UI state — never persisted.
export function resolveActiveLayerId(
  layers: Layer[] | undefined,
  requested: string | null | undefined,
): string {
  const ls = tabLayers(layers);
  if (requested != null && ls.some((l) => l.id === requested)) return requested;
  return ls[ls.length - 1]!.id;
}

// --- Layer operations (pure Tab -> Tab; unchanged input returns the same
// --- reference so callers can cheaply detect no-ops) -----------------------

// Ensure the layers array exists — the lazy materialisation point. Every
// mutating op below funnels through this, so a tab only grows a `layers`
// field once the user actually touches the feature.
export function materializeLayers(tab: Tab): Tab {
  if (tab.layers && tab.layers.length > 0) return tab;
  return { ...tab, layers: [{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME }] };
}

// First free "Layer N" name (numbering from 1), skipping names already
// taken so a renamed or deleted layer never causes a duplicate.
export function nextLayerName(layers: Layer[]): string {
  const taken = new Set(layers.map((l) => l.name));
  for (let n = 1; ; n++) {
    const name = `Layer ${n}`;
    if (!taken.has(name)) return name;
  }
}

// Insert a new empty layer directly ABOVE the given layer (Photoshop's
// rule), or on top when the anchor is missing / unknown. Returns the new
// layer's id so the caller can activate it.
export function addLayerAbove(
  tab: Tab,
  anchorLayerId?: string | null,
): { tab: Tab; layerId: string } {
  const t = materializeLayers(tab);
  const ls = t.layers!;
  const at = anchorLayerId != null ? ls.findIndex((l) => l.id === anchorLayerId) : -1;
  const idx = at >= 0 ? at + 1 : ls.length;
  const layer: Layer = { id: crypto.randomUUID(), name: nextLayerName(ls) };
  return {
    tab: { ...t, layers: [...ls.slice(0, idx), layer, ...ls.slice(idx)] },
    layerId: layer.id,
  };
}

export function renameLayer(tab: Tab, layerId: string, name: string): Tab {
  const trimmed = name.trim();
  const ls = tab.layers;
  if (!trimmed || !ls?.some((l) => l.id === layerId && l.name !== trimmed)) return tab;
  return {
    ...tab,
    layers: ls.map((l) => (l.id === layerId ? { ...l, name: trimmed } : l)),
  };
}

export function setLayerVisibility(tab: Tab, layerId: string, visible: boolean): Tab {
  return patchLayer(materializeLayers(tab), layerId, (l) => {
    const { visible: _drop, ...rest } = l;
    // Store only the non-default state so an always-visible layer stays
    // key-free in the JSON blob.
    return visible ? rest : { ...rest, visible: false };
  });
}

export function setLayerLock(tab: Tab, layerId: string, locked: boolean): Tab {
  return patchLayer(materializeLayers(tab), layerId, (l) => {
    const { locked: _drop, ...rest } = l;
    return locked ? { ...rest, locked: true } : rest;
  });
}

function patchLayer(tab: Tab, layerId: string, patch: (l: Layer) => Layer): Tab {
  const ls = tab.layers;
  if (!ls?.some((l) => l.id === layerId)) return tab;
  return { ...tab, layers: ls.map((l) => (l.id === layerId ? patch(l) : l)) };
}

// Restack: move a layer to `toIndex` (clamped) in the bottom->top array.
export function moveLayer(tab: Tab, layerId: string, toIndex: number): Tab {
  const ls = tab.layers;
  const from = ls?.findIndex((l) => l.id === layerId) ?? -1;
  if (!ls || from < 0) return tab;
  const to = Math.max(0, Math.min(ls.length - 1, toIndex));
  if (to === from) return tab;
  const next = [...ls];
  const [layer] = next.splice(from, 1);
  next.splice(to, 0, layer!);
  return { ...tab, layers: next };
}

// Delete a layer AND everything on it (spec/74: Photoshop's rule, behind
// the panel's confirm dialog). Arrows on OTHER layers that pin to a
// removed element cascade with it — same rule as delete-selected — and
// group-pinned arrow ends whose group lost its last member freeze at
// their pre-delete position. The last remaining layer can't be deleted.
export function deleteLayer(tab: Tab, layerId: string): Tab {
  const ls = tab.layers;
  if (!ls || ls.length <= 1 || !ls.some((l) => l.id === layerId)) return tab;
  const doomed = new Set(
    tab.elements.filter((el) => resolveLayerId(el.layerId, ls) === layerId).map((el) => el.id),
  );
  const survivors = tab.elements.filter((el) => {
    if (doomed.has(el.id)) return false;
    if (el.type === 'arrow' && arrowReferencesAny(el, doomed)) return false;
    return true;
  });
  return {
    ...tab,
    layers: ls.filter((l) => l.id !== layerId),
    elements: freezeDanglingGroupEnds(tab.elements, survivors),
  };
}

// Move elements onto an EXISTING layer (the context menu's layer picker).
// Keeps their relative order: band position is derived from array order,
// which this doesn't touch.
export function moveElementsToLayer(tab: Tab, ids: ReadonlySet<ElementId>, layerId: string): Tab {
  const ls = tab.layers;
  if (!ls?.some((l) => l.id === layerId)) return tab;
  let changed = false;
  const elements = tab.elements.map((el) => {
    if (!ids.has(el.id) || resolveLayerId(el.layerId, ls) === layerId) return el;
    changed = true;
    return { ...el, layerId };
  });
  return changed ? { ...tab, elements } : tab;
}

// --- Bring to Front / Send to Back as LAYER moves (spec/74) ----------------
//
// These two buttons power the layers rather than an intra-band z-index:
// the selection moves onto the top (resp. bottom) layer, and when that
// layer holds anything OUTSIDE the selection a fresh layer is created
// beyond it. A layer these ops empty out is pruned automatically (only
// these ops prune, so a layer created empty from the panel sticks
// around). Already frontmost / backmost selections are a no-op.

export function bringElementsToFrontLayer(tab: Tab, ids: ReadonlySet<ElementId>): Tab {
  return layerEdgeMove(tab, ids, 'front');
}

export function sendElementsToBackLayer(tab: Tab, ids: ReadonlySet<ElementId>): Tab {
  return layerEdgeMove(tab, ids, 'back');
}

function layerEdgeMove(tab: Tab, ids: ReadonlySet<ElementId>, edge: 'front' | 'back'): Tab {
  const selected = new Set(tab.elements.filter((el) => ids.has(el.id)).map((el) => el.id));
  if (selected.size === 0) return tab;
  const t = materializeLayers(tab);
  let ls = t.layers!;
  const edgeLayer = edge === 'front' ? ls[ls.length - 1]! : ls[0]!;
  const edgeBand = t.elements.filter((el) => resolveLayerId(el.layerId, ls) === edgeLayer.id);
  const edgeIsForeign = edgeBand.some((el) => !selected.has(el.id));
  const allOnEdge = t.elements.every(
    (el) => !selected.has(el.id) || resolveLayerId(el.layerId, ls) === edgeLayer.id,
  );
  // Whole selection already alone on the edge layer -> nothing to do.
  if (!edgeIsForeign && allOnEdge) return tab;

  let targetId: string;
  if (edgeIsForeign) {
    const layer: Layer = { id: crypto.randomUUID(), name: nextLayerName(ls) };
    ls = edge === 'front' ? [...ls, layer] : [layer, ...ls];
    targetId = layer.id;
  } else {
    targetId = edgeLayer.id;
  }

  // Re-stamp the selection, then splice it to the array edge so it also
  // tops (resp. bottoms) its new band.
  const restamped = t.elements.map((el) =>
    selected.has(el.id) && el.layerId !== targetId ? { ...el, layerId: targetId } : el,
  );
  const elements =
    edge === 'front' ? bringManyToFront(restamped, selected) : sendManyToBack(restamped, selected);

  // Prune layers the move just emptied (they only lost members to this
  // move — a layer that was already empty before it is left alone).
  const before = layerElementCounts({ elements: t.elements, layers: t.layers });
  const after = layerElementCounts({ elements, layers: ls });
  ls = ls.filter(
    (l) => l.id === targetId || (after.get(l.id) ?? 0) > 0 || (before.get(l.id) ?? 0) === 0,
  );

  return { ...t, layers: ls, elements };
}

// Stamp the active layer onto elements that appeared in a commit without
// a valid layer (spec/74: "every new element lands on the active layer").
// Called at the editor's single commit choke point so no individual
// creation path (draw, paste, AI, template, Mermaid import) carries layer
// logic. A tab that has never materialised `layers` is left untouched —
// everything there is implicitly on the one default layer. Elements that
// already carry a KNOWN layerId (duplicates, cross-tab paste from a tab
// sharing layer ids) keep it.
export function stampNewElementLayers(
  prev: Element[],
  next: Element[],
  layers: Layer[] | undefined,
  activeLayerId: string,
): Element[] {
  if (!layers || layers.length === 0) return next;
  if (!layers.some((l) => l.id === activeLayerId)) return next;
  const known = new Set(layers.map((l) => l.id));
  const prevIds = new Set(prev.map((el) => el.id));
  let changed = false;
  const out = next.map((el) => {
    if (prevIds.has(el.id)) return el;
    if (el.layerId !== undefined && known.has(el.layerId)) return el;
    changed = true;
    return { ...el, layerId: activeLayerId };
  });
  return changed ? out : next;
}
