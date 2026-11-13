'use client';

import { memo, type ReactNode } from 'react';
import type { Element } from '@livedocuments/document';
import {
  usePreviewEntry,
  type LayerPreviewStore,
  type PreviewEntry,
} from '@/hooks/canvas/useLayerDragPreview';

type Props<R extends object, S> = {
  store: LayerPreviewStore;
  element: Element;
  // What the row draws from beyond its element (CanvasElementList's ElementRow), compared field by field.
  row: R;
  // What every row reads alike, one object while none of it changes.
  shared: S;
  draw: (element: Element, entry: PreviewEntry | undefined, row: R, shared: S) => ReactNode;
};

// One element of the layer, drawn from the drag preview while one changes it and from the document
// otherwise (docs/specs/008-canvas/drag-preview.md): a preview frame re-renders this, not the layer. Memoised on
// its element, its row's fields and the shared props, so a commit draws the rows it changed
// (docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached").
export function PreviewedElementRow<R extends object, S>({
  store,
  element,
  row,
  shared,
  draw,
}: Props<R, S>) {
  const entry = usePreviewEntry(store, element.id);
  return draw(entry?.element ?? element, entry, row, shared);
}

// The memo's test: the same store, element, shared props and draw, and a row equal field by field.
export function samePreviewedRow<R extends object, S>(a: Props<R, S>, b: Props<R, S>): boolean {
  if (a.store !== b.store || a.element !== b.element || a.shared !== b.shared || a.draw !== b.draw)
    return false;
  const x = a.row as Record<string, unknown>;
  const y = b.row as Record<string, unknown>;
  for (const k in y) if (!Object.is(x[k], y[k])) return false;
  return true;
}

export const PreviewedElement = memo(
  PreviewedElementRow,
  samePreviewedRow,
) as typeof PreviewedElementRow;
