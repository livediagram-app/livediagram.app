'use client';

// The derived selection (primary element, bounds, every "show this chrome?" predicate) for a piece of
// selection chrome that reads the store itself (docs/specs/008-canvas/blueprints/selection-store.md):
// the chrome re-renders on a selection change; the canvas that hosts it does not.

import { useMemo } from 'react';
import { deriveCanvasSelection } from '@/lib/canvas-selection';
import { useSelectionOf } from './useSelectionStore';
import { useCanvasCovered } from '@/hooks/plan/plan-cover-store';

export type CanvasSelectionInput = Omit<
  Parameters<typeof deriveCanvasSelection>[0],
  'selectedId' | 'multiSelectedIds' | 'canvasCovered'
>;

export type CanvasSelectionView = ReturnType<typeof deriveCanvasSelection>;

const whole = <T>(s: T) => s;

export function useCanvasSelectionView(input: CanvasSelectionInput): CanvasSelectionView {
  const { selectedId, multiSelectedIds } = useSelectionOf(whole);
  // A Plan board or view drawn over the canvas (maximised, or filling its tab: docs/specs/026-plan/plan-board.md)
  // covers it, so no selection chrome floats there, whatever is selected.
  const canvasCovered = useCanvasCovered();
  return useMemo(
    () => deriveCanvasSelection({ ...input, selectedId, multiSelectedIds, canvasCovered }),
    [input, selectedId, multiSelectedIds, canvasCovered],
  );
}
