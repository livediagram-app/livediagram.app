// What people have locked against change (docs/specs/024-agents/blueprints/edit-operations.md I7):
// a locked element, or an element on a locked layer. The tab lock is checked before any operation.

import {
  isLayerLocked,
  resolveLayerId,
  tabLayers,
  type ElementId,
  type Layer,
  type Tab,
} from '@livediagram/document';
import type { LockReason } from './rejections';

// The lock of the layer an element with this `layerId` sits on, if that layer is locked.
export function layerLockOf(layers: Layer[] | undefined, layerId: unknown): LockReason | null {
  const all = tabLayers(layers);
  const id = resolveLayerId(typeof layerId === 'string' ? layerId : undefined, all);
  const layer = all.find((l) => l.id === id)!;
  return isLayerLocked(layer) ? { scope: 'layer', layer: layer.name } : null;
}

// Every element of the tab that may not change, and why; an element's own lock wins.
export function lockedIds(tab: Tab): Map<ElementId, LockReason> {
  const locked = new Map<ElementId, LockReason>();
  for (const el of tab.elements) {
    const lock: LockReason | null = el.locked
      ? { scope: 'element' }
      : layerLockOf(tab.layers, el.layerId);
    if (lock) locked.set(el.id, lock);
  }
  return locked;
}
