import { useMemo, useState } from 'react';
import {
  addLayerAbove,
  deleteLayer,
  hiddenLayerElementIds,
  isLayerLocked,
  isLayerVisible,
  layerElementCounts,
  lockedLayerElementIds,
  moveElementsToLayer,
  moveLayer,
  nextLayerName,
  renameLayer,
  resolveActiveLayerId,
  setLayerLock,
  setLayerVisibility,
  tabLayers,
  type Layer,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// Layers domain slice (spec/74): the per-tab ACTIVE layer (session-scoped
// UI state — deliberately never persisted or synced) plus every layer
// mutation the panel and context menu fire. All persisted layer data
// lives on the Tab itself, so each op is one `commitActiveTab` call and
// undo / autosave / realtime apply unchanged. Derived hidden / locked
// element-id sets are memoised here once and threaded to every
// interaction gate (render, marquee, drag, delete, traversal).
export function useLayersState(opts: {
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  commitActiveTab: (mapTab: (t: Tab) => Tab) => void;
}) {
  const { activeId, activeTab, editsBlocked, commitActiveTab } = opts;

  // Remembered active layer per tab. Resolution falls back to the TOP
  // layer whenever the remembered one is missing (never chosen, or the
  // layer was deleted — locally or by a peer).
  const [activeLayerByTab, setActiveLayerByTab] = useState<Record<string, string>>({});
  const layers = useMemo(() => tabLayers(activeTab.layers), [activeTab.layers]);
  const activeLayerId = resolveActiveLayerId(activeTab.layers, activeLayerByTab[activeId]);
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[layers.length - 1]!;

  // True while the active layer can't receive new elements (hidden or
  // locked): the palette's creation paths fold this into their blocked
  // guard so you never add an element you can't immediately see / touch.
  const activeLayerBlocked = !isLayerVisible(activeLayer) || isLayerLocked(activeLayer);

  const layerHiddenIds = useMemo(
    () => hiddenLayerElementIds(activeTab.elements, activeTab.layers),
    [activeTab.elements, activeTab.layers],
  );
  const layerLockedIds = useMemo(
    () => lockedLayerElementIds(activeTab.elements, activeTab.layers),
    [activeTab.elements, activeTab.layers],
  );
  // Hidden ∪ locked: the ids every selection surface (click, marquee,
  // select-all, keyboard traversal) treats as not-there.
  const layerInertIds = useMemo(() => {
    if (layerHiddenIds.size === 0) return layerLockedIds;
    if (layerLockedIds.size === 0) return layerHiddenIds;
    return new Set([...layerHiddenIds, ...layerLockedIds]);
  }, [layerHiddenIds, layerLockedIds]);

  const layerCounts = useMemo(
    () => layerElementCounts({ elements: activeTab.elements, layers: activeTab.layers }),
    [activeTab.elements, activeTab.layers],
  );

  const setActiveLayer = (layerId: string) => {
    if (layerId === activeLayerId || !layers.some((l) => l.id === layerId)) return;
    setActiveLayerByTab((m) => ({ ...m, [activeId]: layerId }));
    track('Layer', 'Selected');
  };

  // Mint the Layer up front so the new row can be activated without
  // waiting to learn the id the commit generated.
  const addLayer = () => {
    if (editsBlocked) return;
    const layer: Layer = { id: crypto.randomUUID(), name: nextLayerName(layers) };
    commitActiveTab((t) => addLayerAbove(t, activeLayerId, layer).tab);
    setActiveLayerByTab((m) => ({ ...m, [activeId]: layer.id }));
    track('Layer', 'Added');
  };

  const renameLayerNamed = (layerId: string, name: string) => {
    if (editsBlocked) return;
    commitActiveTab((t) => renameLayer(t, layerId, name));
    track('Layer', 'Renamed');
  };

  // Delete the layer AND its elements (the panel owns the confirm
  // dialog). When the active layer goes, activate its lower neighbour
  // (or the new bottom), Photoshop-style.
  const removeLayer = (layerId: string) => {
    if (editsBlocked || layers.length <= 1) return;
    const at = layers.findIndex((l) => l.id === layerId);
    if (at < 0) return;
    const neighbour = layers[at - 1] ?? layers[at + 1];
    commitActiveTab((t) => deleteLayer(t, layerId));
    if (activeLayerId === layerId && neighbour) {
      setActiveLayerByTab((m) => ({ ...m, [activeId]: neighbour.id }));
    }
    track('Layer', 'Deleted');
  };

  const toggleLayerVisibility = (layerId: string) => {
    if (editsBlocked) return;
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const show = !isLayerVisible(layer);
    commitActiveTab((t) => setLayerVisibility(t, layerId, show));
    track('Layer', 'Toggled', show ? 'Shown' : 'Hidden');
  };

  const toggleLayerLock = (layerId: string) => {
    if (editsBlocked) return;
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const lock = !isLayerLocked(layer);
    commitActiveTab((t) => setLayerLock(t, layerId, lock));
    track('Layer', 'Toggled', lock ? 'Locked' : 'Unlocked');
  };

  // Restack (the panel's drag-to-reorder). `toIndex` is in the
  // bottom->top layers array the data model stores; the panel converts
  // from its top-first row order before calling.
  const reorderLayer = (layerId: string, toIndex: number) => {
    if (editsBlocked) return;
    commitActiveTab((t) => moveLayer(t, layerId, toIndex));
    track('Layer', 'Reordered');
  };

  // The context menu's "move selection to layer" (single + multi).
  const moveSelectionToLayer = (ids: ReadonlySet<string>, layerId: string) => {
    if (editsBlocked || ids.size === 0) return;
    commitActiveTab((t) => moveElementsToLayer(t, ids, layerId));
    track('Layer', 'Moved');
  };

  return {
    layers,
    activeLayerId,
    activeLayerBlocked,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
    layerCounts,
    setActiveLayer,
    addLayer,
    renameLayer: renameLayerNamed,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    moveSelectionToLayer,
  };
}
