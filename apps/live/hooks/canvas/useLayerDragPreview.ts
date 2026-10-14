'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Element, ElementGrid, ElementIndex } from '@livediagram/document';
import { dragPreviewFor, subscribeDragPreview, type DragOverlay } from '@/lib/drag-preview';
import type { ArrowLabelRender, ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
import type { ArrowViewFrame } from '@/components/canvas/arrow-view-frame';
import {
  affectedArrows,
  previewArrowGeometry,
  type ArrowLinks,
} from '@/components/canvas/drag-affected-arrows';
import type { Rect } from '@livediagram/document';

// The element layer's drag preview (docs/specs/008-canvas/drag-preview.md "The preview",
// docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved"): what each element looks
// like while a gesture lasts, derived once per preview change outside React and read per element, so a
// preview frame re-renders the elements it changes and never the layer that holds all of them. The
// layer itself re-renders only when the preview adds or removes elements (a Shift-duplicate), which
// changes what it lists.

export type LayerDrawn = { element: Element; layerOpacity: number };

// What one element draws from while a preview lasts: the element as the gesture has it, and for an
// affected arrow its frame, holes and label.
export type PreviewEntry = {
  element: Element;
  geometry?: { frame: ArrowViewFrame; holes: Rect[] };
  label?: ArrowLabelRender;
};

// The ids the preview adds and removes: what the layer lists, as one value that holds while the set does.
// `added` carries each element as it was when the set last changed, for listing; what it draws comes
// from its entry.
export type PreviewStructure = Pick<DragOverlay, 'removed' | 'added'>;

export type LayerPreviewInputs = {
  tabId: string;
  ordered: readonly LayerDrawn[];
  drawnElements: readonly Element[];
  elementIndex: ElementIndex | null;
  arrowLinks: ArrowLinks | null;
  gridFor: (elements: readonly Element[]) => ElementGrid;
  arrowLabels: ArrowLabels;
  tabFinish: unknown;
};

export type LayerPreviewStore = {
  subscribe(id: string, cb: () => void): () => void;
  entryOf(id: string): PreviewEntry | undefined;
  subscribeStructure(cb: () => void): () => void;
  structure(): PreviewStructure | null;
  // Re-derives from the latest preview and inputs, notifying only the elements whose entry changed.
  update(inputs: LayerPreviewInputs): void;
};

// `ordered` with the preview laid over it: changed elements swapped in, removed ones dropped, added
// ones after their neighbour (at the end when it is not drawn). Linear in the board.
export function shownWithOverlay(
  ordered: readonly LayerDrawn[],
  overlay: Pick<DragOverlay, 'removed' | 'added'> & { changed?: DragOverlay['changed'] },
): LayerDrawn[] {
  const after = new Map<string, Element[]>();
  for (const { el, after: id } of overlay.added)
    if (id !== null) after.set(id, [...(after.get(id) ?? []), el]);
  const shown: LayerDrawn[] = [];
  const placed = new Set<string>();
  for (const o of ordered) {
    if (overlay.removed.has(o.element.id)) continue;
    shown.push({
      element: overlay.changed?.get(o.element.id) ?? o.element,
      layerOpacity: o.layerOpacity,
    });
    for (const el of after.get(o.element.id) ?? []) {
      shown.push({ element: el, layerOpacity: o.layerOpacity });
      placed.add(el.id);
    }
  }
  for (const { el } of overlay.added)
    if (!placed.has(el.id)) shown.push({ element: el, layerOpacity: 1 });
  return shown;
}

const structureKey = (s: PreviewStructure | null) =>
  s === null
    ? ''
    : `${[...s.removed].join(',')}|${s.added.map((a) => `${a.el.id}<${a.after ?? ''}`).join(',')}`;

export function createLayerPreviewStore(): LayerPreviewStore {
  let entries = new Map<string, PreviewEntry>();
  let structure: PreviewStructure | null = null;
  let lastOverlay: DragOverlay | null = null;
  let lastInputs: LayerPreviewInputs | null = null;
  const byId = new Map<string, Set<() => void>>();
  const structureListeners = new Set<() => void>();

  function derive(overlay: DragOverlay, inputs: LayerPreviewInputs): Map<string, PreviewEntry> {
    const out = new Map<string, PreviewEntry>();
    for (const [id, element] of overlay.changed) out.set(id, { element });
    for (const { el } of overlay.added) out.set(el.id, { element: el });
    const { elementIndex, arrowLinks, drawnElements } = inputs;
    if (!elementIndex || !arrowLinks) return out;
    const index = new Map(elementIndex);
    for (const [id, el] of overlay.changed) index.set(id, el);
    for (const { el } of overlay.added) index.set(el.id, el);
    const grid = inputs.gridFor(drawnElements);
    const ids = affectedArrows(overlay, drawnElements, arrowLinks);
    for (const { el } of overlay.added) if (el.type === 'arrow') ids.add(el.id);
    // The board as the preview shows it, which a moved label is laid out against; only built when
    // an affected arrow has a label.
    let virtual: Element[] | null = null;
    for (const id of ids) {
      const arrow = index.get(id);
      if (!arrow || arrow.type !== 'arrow') continue;
      const entry: PreviewEntry = {
        element: arrow,
        geometry: previewArrowGeometry(arrow, index, grid, overlay, inputs.tabFinish),
      };
      if (arrow.label) {
        virtual ??= shownWithOverlay(inputs.ordered, overlay).map((o) => o.element);
        const base = inputs.arrowLabels.renderOf(id);
        const layout = inputs.arrowLabels.draftLayout(arrow, arrow.label, virtual);
        entry.label = {
          layout,
          knockouts: [
            ...base.knockouts.filter((k) => k !== base.layout?.knockout),
            ...(layout?.knockout ? [layout.knockout] : []),
          ],
        };
      }
      out.set(id, entry);
    }
    return out;
  }

  return {
    subscribe(id, cb) {
      let set = byId.get(id);
      if (!set) byId.set(id, (set = new Set()));
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) byId.delete(id);
      };
    },
    entryOf: (id) => entries.get(id),
    subscribeStructure(cb) {
      structureListeners.add(cb);
      return () => {
        structureListeners.delete(cb);
      };
    },
    structure: () => structure,
    update(inputs) {
      const overlay = dragPreviewFor(inputs.tabId, inputs.drawnElements);
      // Nothing to do: no preview before or now, or the same preview over the same inputs.
      if (overlay === lastOverlay && (overlay === null || inputs === lastInputs)) return;
      lastOverlay = overlay;
      lastInputs = inputs;
      const prev = entries;
      entries = overlay ? derive(overlay, inputs) : new Map();
      const nextStructure: PreviewStructure | null =
        overlay && (overlay.removed.size > 0 || overlay.added.length > 0)
          ? { removed: overlay.removed, added: overlay.added }
          : null;
      const structureChanged = structureKey(nextStructure) !== structureKey(structure);
      if (structureChanged) structure = nextStructure;
      // Only the elements whose entry changed (an entry is new on every change, so an element the
      // preview still holds redraws; one it no longer holds redraws from the document).
      const touched = new Set([...prev.keys(), ...entries.keys()]);
      for (const id of touched) {
        if (prev.get(id) === entries.get(id)) continue;
        for (const cb of byId.get(id) ?? []) cb();
      }
      if (structureChanged) for (const cb of structureListeners) cb();
    },
  };
}

// The store for one element layer, kept in step with the drag preview and with the layer's inputs. The
// layer reads `structure` (rendering only when the preview adds or removes elements); each element reads
// its own entry through `usePreviewEntry`.
export function useLayerDragPreview(inputs: LayerPreviewInputs): {
  store: LayerPreviewStore;
  structure: PreviewStructure | null;
} {
  const [store] = useState(createLayerPreviewStore);
  const inputsRef = useRef(inputs);
  // The layer rendered with new inputs mid-gesture (a collaborator's change, a new label pass):
  // re-derive against them before paint.
  useLayoutEffect(() => {
    inputsRef.current = inputs;
    store.update(inputs);
  });
  useEffect(() => subscribeDragPreview(() => store.update(inputsRef.current)), [store]);
  const structure = useSyncExternalStore(store.subscribeStructure, store.structure, () => null);
  return { store, structure };
}

// One element's preview entry: undefined while no preview changes it.
export function usePreviewEntry(store: LayerPreviewStore, id: string): PreviewEntry | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribe(id, cb), [store, id]);
  const read = useCallback(() => store.entryOf(id), [store, id]);
  return useSyncExternalStore(subscribe, read, read);
}
