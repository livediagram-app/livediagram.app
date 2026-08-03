import { type Element, type ElementId, type Tab } from './index';
import { bringManyToFront, freezeDanglingGroupEnds, sendManyToBack } from './groups';
import { arrowReferencesAny } from './arrow-rebind';
import {
  DEFAULT_LAYER_ID,
  DEFAULT_LAYER_NAME,
  isLayerVisible,
  layerElementCounts,
  resolveLayerId,
  type Layer,
} from './layers';

// EVERY WAY A LAYER CHANGES (spec/74), as pure Tab -> Tab functions.
//
// Split from layers.ts along the seam that file already drew between its
// queries and its operations. The queries answer "what is on this layer, and
// can I see it?" and are read on every render by the canvas, the SVG renderer
// and the Mermaid serialiser; these are the writes, reached only from the
// Layers panel and the editor's commands. Two audiences, two files.
//
// The no-op contract is the reason these are worth reading together: an
// operation that changes nothing returns the SAME Tab reference, so a caller
// can detect "nothing happened" with `===` rather than a deep compare. Every
// function below preserves it, and it is easy to break by rebuilding the tab
// unconditionally.

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
// layer's id so the caller can activate it. `preset` lets a caller mint
// the Layer up front (id known before the commit lands, so the editor
// can activate it optimistically); dropped if its id already exists.
export function addLayerAbove(
  tab: Tab,
  anchorLayerId?: string | null,
  preset?: Layer,
): { tab: Tab; layerId: string } {
  const t = materializeLayers(tab);
  const ls = t.layers!;
  if (preset && ls.some((l) => l.id === preset.id)) return { tab: t, layerId: preset.id };
  const at = anchorLayerId != null ? ls.findIndex((l) => l.id === anchorLayerId) : -1;
  const idx = at >= 0 ? at + 1 : ls.length;
  const layer: Layer = preset ?? { id: crypto.randomUUID(), name: nextLayerName(ls) };
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

// Whole-layer opacity (spec/74), clamped to 0..1; the key is dropped at
// full opacity so untouched layers stay byte-light.
export function setLayerOpacity(tab: Tab, layerId: string, opacity: number): Tab {
  const clamped = Math.max(0, Math.min(1, opacity));
  return patchLayer(materializeLayers(tab), layerId, (l) => {
    const { opacity: _drop, ...rest } = l;
    return clamped >= 1 ? rest : { ...rest, opacity: clamped };
  });
}

// Hide every OTHER layer, making `layerId` the only visible one (the
// row menu's "Hide Other Layers", spec/74).
export function hideOtherLayers(tab: Tab, layerId: string): Tab {
  const t = materializeLayers(tab);
  const ls = t.layers!;
  if (!ls.some((l) => l.id === layerId)) return tab;
  let changed = false;
  const layers = ls.map((l) => {
    const show = l.id === layerId;
    if (isLayerVisible(l) === show) return l;
    changed = true;
    const { visible: _drop, ...rest } = l;
    return show ? rest : { ...rest, visible: false };
  });
  return changed ? { ...t, layers } : t;
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
  return {
    ...tab,
    layers: ls.filter((l) => l.id !== layerId),
    elements: withoutLayerElements(tab, layerId),
  };
}

// Empty a layer without removing it (the row menu's "Clear", spec/74).
export function clearLayerElements(tab: Tab, layerId: string): Tab {
  const ls = tab.layers;
  if (!ls?.some((l) => l.id === layerId)) return tab;
  const elements = withoutLayerElements(tab, layerId);
  return elements === tab.elements ? tab : { ...tab, elements };
}

// The tab's elements minus everything on `layerId`, with the same arrow
// cascade + group-pin freezing as delete-selected.
function withoutLayerElements(tab: Tab, layerId: string): Element[] {
  const ls = tab.layers!;
  const doomed = new Set(
    tab.elements.filter((el) => resolveLayerId(el.layerId, ls) === layerId).map((el) => el.id),
  );
  if (doomed.size === 0) return tab.elements;
  const survivors = tab.elements.filter((el) => {
    if (doomed.has(el.id)) return false;
    if (el.type === 'arrow' && arrowReferencesAny(el, doomed)) return false;
    return true;
  });
  return freezeDanglingGroupEnds(tab.elements, survivors);
}

// Merge a layer into its neighbour (spec/74): every element on `layerId`
// is restamped onto the layer directly above / below it, and the merged
// layer disappears (the neighbour survives, keeping its name + state,
// like Photoshop's Merge Down). The merged-in elements keep their visual
// position relative to the target band: they painted ABOVE a below-
// neighbour (so they join the top of its band) and BELOW an above-
// neighbour (bottom of its band). No neighbour in that direction = no-op.
export function mergeLayerInto(tab: Tab, layerId: string, direction: 'above' | 'below'): Tab {
  const ls = tab.layers;
  const at = ls?.findIndex((l) => l.id === layerId) ?? -1;
  if (!ls || at < 0) return tab;
  const target = ls[direction === 'above' ? at + 1 : at - 1];
  if (!target) return tab;
  const moved = new Set(
    tab.elements.filter((el) => resolveLayerId(el.layerId, ls) === layerId).map((el) => el.id),
  );
  const restamped = tab.elements.map((el) =>
    moved.has(el.id) ? { ...el, layerId: target.id } : el,
  );
  const elements =
    direction === 'below' ? bringManyToFront(restamped, moved) : sendManyToBack(restamped, moved);
  return { ...tab, layers: ls.filter((l) => l.id !== layerId), elements };
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

// A layer name the user never chose ("Layer 1", "Layer 2", ...). The
// smart-naming path in the editor (a default-named layer adopts the
// first label committed onto one of its elements, spec/74) only ever
