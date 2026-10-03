'use client';

import { useMemo } from 'react';
import type { Element } from '@livediagram/document';
import { applyOverlay, useDragPreview } from '@/lib/drag-preview';

// The tab's elements as a drag in progress shows them (docs/specs/008-canvas/drag-preview.md): the
// document itself when no drag is, so its identity and every memo on it hold.
export function usePreviewedElements(elements: Element[], tabId: string): Element[] {
  const overlay = useDragPreview(tabId);
  return useMemo(() => (overlay ? applyOverlay(elements, overlay) : elements), [elements, overlay]);
}
