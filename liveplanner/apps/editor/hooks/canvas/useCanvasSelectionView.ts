'use client';

// The derived selection (primary element, bounds, every "show this chrome?" predicate) for a piece of
// selection chrome that reads the store itself (docs/specs/008-canvas/blueprints/selection-store.md):
// the chrome re-renders on a selection change; the canvas that hosts it does not.

import { useMemo } from 'react';
import { deriveCanvasSelection } from '@/lib/canvas-selection';
import { useSelectionOf } from './useSelectionStore';
import { useCanvasCovered } from '@/hooks/plan/plan-cover-store';
import { usePreviewedElements } from './usePreviewedElements';

export type CanvasSelectionInput = Omit<
  Parameters<typeof deriveCanvasSelection>[0],
  'selectedId' | 'multiSelectedIds' | 'canvasCovered'
>;

type CanvasSelectionView = ReturnType<typeof deriveCanvasSelection>;

const whole = <T>(s: T) => s;

// The selection reads the elements as a drag in progress on `tabId` shows them
// (docs/specs/008-canvas/drag-preview.md), so the union handles follow a resize. Read here, by the chrome,
// not by the canvas, which a preview frame does not render (docs/specs/008-canvas/canvas-performance.md).
export function useCanvasSelectionView(
  input: CanvasSelectionInput,
  tabId: string,
): CanvasSelectionView {
  const { selectedId, multiSelectedIds } = useSelectionOf(whole);
  const elements = usePreviewedElements(input.elements, tabId);
  // A Plan board or view drawn over the canvas (maximised, or filling its tab: docs/specs/026-plan/plan-board.md)
  // covers it, so no selection chrome floats there, whatever is selected.
  const canvasCovered = useCanvasCovered();
  return useMemo(
    () =>
      deriveCanvasSelection({ ...input, elements, selectedId, multiSelectedIds, canvasCovered }),
    [input, elements, selectedId, multiSelectedIds, canvasCovered],
  );
}
