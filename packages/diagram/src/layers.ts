import { type Element, type ElementId, type Tab } from './index';

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
  // Whole-layer opacity (0..1), multiplied over each member element's own
  // opacity at render time by every renderer (canvas, exports, panel
  // previews). Absent = 1.
  opacity?: number;
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

export function layerOpacityOf(layer: Layer): number {
  return layer.opacity ?? 1;
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

// The same paint order, kept grouped per layer — for renderers that wrap
// each band (e.g. in a <g opacity> for per-layer opacity). Bands are
// bottom -> top, each band's elements in paint order (frames first).
// Hidden layers' bands are dropped unless `includeHidden`.
export function layerBands(
  elements: Element[],
  layers: Layer[] | undefined,
  opts?: { includeHidden?: boolean },
): { layer: Layer; elements: Element[] }[] {
  const ls = tabLayers(layers);
  if (ls.length === 1) {
    if (!opts?.includeHidden && !isLayerVisible(ls[0]!)) return [];
    return [{ layer: ls[0]!, elements: framesFirstIn(elements) }];
  }
  const bands = bandsOf(elements, ls);
  const out: { layer: Layer; elements: Element[] }[] = [];
  ls.forEach((layer, i) => {
    if (!opts?.includeHidden && !isLayerVisible(layer)) return;
    out.push({ layer, elements: framesFirstIn(bands[i]!) });
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

// replaces names matching this.
export function isDefaultLayerName(name: string): boolean {
  return /^Layer \d+$/.test(name);
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
