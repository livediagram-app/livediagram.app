'use client';

import { useMemo } from 'react';
import type { Element } from '@livediagram/document';
import { applyOverlay, useDragPreview, type DragOverlay } from '@/lib/drag-preview';

// Each preview laid over each list once (docs/specs/008-canvas/canvas-performance.md "Selection chrome derives a
// frame once"): every piece of selection chrome reads the same frame, and gets the same array back, so what each
// derives from it (its index, the selection) is built once a frame, not once per reader.
const laidOver = new WeakMap<DragOverlay, WeakMap<readonly Element[], Element[]>>();

export function previewedElements(elements: Element[], overlay: DragOverlay): Element[] {
  let byList = laidOver.get(overlay);
  if (!byList) laidOver.set(overlay, (byList = new WeakMap()));
  let out = byList.get(elements);
  if (!out) byList.set(elements, (out = applyOverlay(elements, overlay)));
  return out;
}

// The tab's elements as a drag in progress shows them (docs/specs/008-canvas/drag-preview.md): the
// document itself when no drag is, so its identity and every memo on it hold.
export function usePreviewedElements(elements: Element[], tabId: string): Element[] {
  const overlay = useDragPreview(tabId, elements);
  return useMemo(
    () => (overlay ? previewedElements(elements, overlay) : elements),
    [elements, overlay],
  );
}
