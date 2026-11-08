import { useEffect, useMemo, useEffectEvent } from 'react';
import {
  isDefaultLayerName,
  hiddenLayerElementIds,
  isLayerLocked,
  isLayerVisible,
  lockedLayerElementIds,
  renameLayer,
  resolveActiveLayerId,
  resolveLayerId,
  tabLayers,
  type Tab,
} from '@livedocuments/document';
import { track } from '@/lib/telemetry';

// Layers domain slice (docs/specs/006-document/layers.md): the tab's ACTIVE layer (the topmost usable one; with the
// Layers panel retired there is no way to choose another, so nothing is remembered) and smart naming, the one layer
// mutation the editor still fires. All persisted layer data lives on the Tab itself, so undo / autosave / realtime
// apply unchanged. Derived hidden / locked element-id sets are memoised here once and threaded to every
// interaction gate (render, marquee, drag, delete, traversal).
export function useLayersState(opts: {
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  // Non-history tab mutator, for smart naming (the tab auto-rename's no-history policy).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Surfaces the "adding is paused" notice when the active layer goes
  // hidden / locked — the block itself is silent by design.
  toastInfo: (message: string) => void;
  // Elements inert for another reason than their layer: those on a locked page
  // (docs/specs/007-editor/pages-mode.md "Locking a page").
  extraInertIds?: ReadonlySet<string>;
}) {
  const { activeId, activeTab, editsBlocked, tickTabs, toastInfo } = opts;

  // The active layer: the topmost usable one (resolveActiveLayerId's fallback), as no one can choose another.
  const layers = useMemo(() => tabLayers(activeTab.layers), [activeTab.layers]);
  const activeLayerId = resolveActiveLayerId(activeTab.layers, undefined);
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
  // Plus what a locked page holds.
  const extraInertIds = opts.extraInertIds;
  const layerInertIds = useMemo(() => {
    const extra = extraInertIds?.size ? extraInertIds : null;
    if (layerHiddenIds.size === 0 && !extra) return layerLockedIds;
    if (layerLockedIds.size === 0 && !extra) return layerHiddenIds;
    return new Set([...layerHiddenIds, ...layerLockedIds, ...(extra ?? [])]);
  }, [layerHiddenIds, layerLockedIds, extraInertIds]);

  // Adding while the active layer can't take elements is a silent no-op
  // at the creation gates, so say WHY once, the moment it becomes true
  // (a peer hides or locks it).
  const activeLayerHidden = !isLayerVisible(activeLayer);
  // Fired on the rising edge / cause change only, not on unrelated renders: the toast function is read
  // at that moment (an effect event), not depended on.
  const explainBlockedLayer = useEffectEvent((hidden: boolean) =>
    toastInfo(blockedLayerMessage(hidden)),
  );
  useEffect(() => {
    if (editsBlocked || !activeLayerBlocked) return;
    explainBlockedLayer(activeLayerHidden);
  }, [activeLayerBlocked, activeLayerHidden, editsBlocked]);
  // The same notice on demand, for a creation the user asked for outright (a
  // paste) that the layer refused. Silent when the layer is not the reason.
  const explainCreateBlocked = () => {
    if (editsBlocked || !activeLayerBlocked) return;
    toastInfo(blockedLayerMessage(activeLayerHidden));
  };

  // Smart naming (docs/specs/006-document/layers.md), called from commitLabel alongside the
  // document / tab auto-renames: when a label commit lands on an element
  // whose layer still carries its default "Layer N" name, and no OTHER
  // element on that layer is labelled, the layer adopts the committed
  // text. Deliberately NO check of the edited element's own pre-commit
  // label: the type-to-edit path commits the first keystroke before the
  // user finishes ("Cloudflare" starts as a committed "C"), so a
  // first-label-only guard would always see a non-empty label and never
  // fire. Creation-seeded labels (tech icons, templates, paste)
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
    // Smart naming is a distinct feature from a manual rename (docs/specs/006-document/layers.md) —
    // track it separately so its uptake is measurable.
    track('Layer', 'Renamed', 'Adopted');
  };

  return {
    layers,
    activeLayerId,
    activeLayerBlocked,
    explainCreateBlocked,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
    adoptLayerNameFromLabel,
  };
}

// Why adding is paused on the active layer (docs/specs/006-document/layers.md
// "Blocked-creation notice").
export function blockedLayerMessage(hidden: boolean): string {
  return hidden
    ? 'The layer new elements land on is hidden, so adding is paused.'
    : 'The layer new elements land on is locked, so adding is paused.';
}
