'use client';

import type { ReactNode } from 'react';
import type { Element } from '@liveplanner/document';
import {
  usePreviewEntry,
  type LayerPreviewStore,
  type PreviewEntry,
} from '@/hooks/canvas/useLayerDragPreview';

// One element of the layer, drawn from the drag preview while one changes it and from the document
// otherwise (docs/specs/008-canvas/drag-preview.md): a preview frame re-renders this, not the layer.
export function PreviewedElement({
  store,
  element,
  draw,
}: {
  store: LayerPreviewStore;
  element: Element;
  draw: (element: Element, entry: PreviewEntry | undefined) => ReactNode;
}) {
  const entry = usePreviewEntry(store, element.id);
  return draw(entry?.element ?? element, entry);
}
