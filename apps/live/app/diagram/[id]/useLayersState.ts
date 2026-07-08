import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addLayerAbove,
  clearLayerElements,
  deleteLayer,
  hideOtherLayers,
  isDefaultLayerName,
  mergeLayerInto,
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
  resolveLayerId,
  setLayerLock,
  setLayerOpacity,
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
  // Non-history tab mutator + checkpoint, for the opacity slider: one
  // undoable step per drag gesture instead of one per tick (the same
  // policy the colour setters follow).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  markCheckpoint: () => number;
  // Surfaces the "adding is paused" notice when the active layer goes
  // hidden / locked — the block itself is silent by design.
  toastInfo: (message: string) => void;
}) {
  const {
    activeId,
    activeTab,
    editsBlocked,
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    toastInfo,
  } = opts;

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

  // Adding while the active layer can't take elements is a silent no-op
  // at the creation gates, so say WHY once, the moment it becomes true
  // (hide/lock the active layer, or activate a hidden one).
  const activeLayerHidden = !isLayerVisible(activeLayer);
  useEffect(() => {
    if (editsBlocked || !activeLayerBlocked) return;
    toastInfo(
      activeLayerHidden
        ? 'The active layer is hidden, so adding elements is paused. Show it or switch layers.'
        : 'The active layer is locked, so adding elements is paused. Unlock it or switch layers.',
    );
    // Fire on the rising edge / cause change only, not on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerBlocked, activeLayerHidden, editsBlocked]);

  // Hover-to-solo (spec/74): while a panel row is hovered the canvas
  // renders ONLY that layer. Pure view state — never persisted, synced,
  // or exported.
  const [previewLayerId, setPreviewLayerId] = useState<string | null>(null);
  useEffect(() => {
    // A layer deleted (or tab switched) mid-hover must not strand the solo.
    if (previewLayerId && !layers.some((l) => l.id === previewLayerId)) setPreviewLayerId(null);
  }, [previewLayerId, layers]);

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
    track('Layer', 'Renamed', 'Manual');
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

  // Merge the ACTIVE layer into its neighbour (spec/74): the neighbour
  // survives (name + state) and becomes active, like Photoshop's Merge
  // Down. No neighbour in that direction = no-op (the panel disables
  // the button).
  const mergeActiveLayer = (direction: 'above' | 'below') => {
    if (editsBlocked) return;
    const at = layers.findIndex((l) => l.id === activeLayerId);
    const target = layers[direction === 'above' ? at + 1 : at - 1];
    if (at < 0 || !target) return;
    commitActiveTab((t) => mergeLayerInto(t, activeLayerId, direction));
    setActiveLayerByTab((m) => ({ ...m, [activeId]: target.id }));
    track('Layer', 'Removed', direction === 'above' ? 'MergedUp' : 'MergedDown');
  };

  // Whole-layer opacity, driven by the row menu's slider. Writes go
  // through tick (no per-tick history snapshot); the FIRST tick of a
  // gesture takes one checkpoint, and 600ms of idle ends the gesture.
  const opacityGestureRef = useRef<number | null>(null);
  const setLayerOpacityLive = (layerId: string, opacity: number) => {
    if (editsBlocked) return;
    if (opacityGestureRef.current === null) {
      markCheckpoint();
      track('Layer', 'Changed', 'Opacity');
    } else {
      window.clearTimeout(opacityGestureRef.current);
    }
    opacityGestureRef.current = window.setTimeout(() => {
      opacityGestureRef.current = null;
    }, 600);
    tickTabs((ts) => ts.map((t) => (t.id === activeId ? setLayerOpacity(t, layerId, opacity) : t)));
  };

  // Empty a layer without removing it (the row menu's Clear, behind its
  // confirm popover).
  const clearLayer = (layerId: string) => {
    if (editsBlocked) return;
    commitActiveTab((t) => clearLayerElements(t, layerId));
    track('Layer', 'Cleared');
  };

  // Make `layerId` the only visible layer (the row menu's Hide Others).
  const hideOthers = (layerId: string) => {
    if (editsBlocked) return;
    commitActiveTab((t) => hideOtherLayers(t, layerId));
    track('Layer', 'Toggled', 'OthersHidden');
  };

  // Restack (the panel's drag-to-reorder). `toIndex` is in the
  // bottom->top layers array the data model stores; the panel converts
  // from its top-first row order before calling.
  const reorderLayer = (layerId: string, toIndex: number) => {
    if (editsBlocked) return;
    commitActiveTab((t) => moveLayer(t, layerId, toIndex));
    track('Layer', 'Reordered');
  };

  // Smart naming (spec/74), called from commitLabel alongside the
  // diagram / tab auto-renames: when a label commit lands on an element
  // whose layer still carries its default "Layer N" name, and no OTHER
  // element on that layer is labelled, the layer adopts the committed
  // text. Deliberately NO check of the edited element's own pre-commit
  // label: the type-to-edit path commits the first keystroke before the
  // user finishes ("Cloudflare" starts as a committed "C"), so a
  // first-label-only guard would always see a non-empty label and never
  // fire. Creation-seeded labels (tech icons, templates, paste, AI)
  // can't reach here anyway — they never pass through commitLabel — and
  // once a layer is named, isDefaultLayerName ends adoption for good.
  // Writes via tick, mirroring the tab auto-rename's no-history policy.
  const adoptLayerNameFromLabel = (elementId: string, label: string) => {
    if (editsBlocked) return;
    const el = activeTab.elements.find((e) => e.id === elementId);
    if (!el) return;
    const labelOf = (candidate: (typeof activeTab.elements)[number]): string =>
      'label' in candidate && typeof candidate.label === 'string' ? candidate.label.trim() : '';
    const layerId = resolveLayerId(el.layerId, layers);
    const layer = layers.find((l) => l.id === layerId);
    if (!layer || !isDefaultLayerName(layer.name)) return;
    const othersLabelled = activeTab.elements.some(
      (other) =>
        other.id !== elementId &&
        labelOf(other) !== '' &&
        resolveLayerId(other.layerId, layers) === layerId,
    );
    if (othersLabelled) return;
    const name = label.split('\n')[0]!.slice(0, 40).trim();
    if (!name) return;
    tickTabs((ts) => ts.map((t) => (t.id === activeId ? renameLayer(t, layerId, name) : t)));
    // Smart naming is a distinct feature from a manual rename (spec/74) —
    // track it separately so its uptake is measurable.
    track('Layer', 'Renamed', 'Adopted');
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
    mergeActiveLayer,
    moveSelectionToLayer,
    setLayerOpacityLive,
    clearLayer,
    hideOthers,
    adoptLayerNameFromLabel,
    previewLayerId,
    setPreviewLayerId,
  };
}
