// The canvas's arrow labels and the selection chrome's input (docs/specs/008-canvas/arrow-labels.md,
// docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved"), derived once per element
// change; under Inspect the selection reads as a Viewer's. Called by Canvas in the same place its body
// ran them, so the hooks keep their order.
import { useCallback, useMemo } from 'react';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { useFontEpoch } from '@liveworkspace/workbench/components/canvas/useFontEpoch';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { useArrowLabelLayouts } from '@/hooks/canvas/useArrowLabelLayouts';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

export function useCanvasSelectionInput({
  elements,
  editingId,
  isPaintMode,
  tabLocked,
  readOnly,
  inspecting,
  tabFont,
  tabFinish,
  elementMenuOpen,
}: Pick<
  CanvasProps,
  'elements' | 'editingId' | 'tabLocked' | 'readOnly' | 'tabFont' | 'tabFinish' | 'elementMenuOpen'
> & { isPaintMode: boolean; inspecting: boolean }) {
  // "Are there any arrows" decides whether to mount the ArrowDefs and lay out
  // labels. `some` short-circuits on the first arrow, so the typical render
  // pays O(1).
  const hasArrows = elements.some((el) => el.type === 'arrow');
  // Every arrow label laid out once per element change, avoiding each other
  // (docs/specs/008-canvas/arrow-labels.md). Laid out here, not in the element
  // layer, because the selection toolbars clear a label as part of its arrow.
  const fontEpoch = useFontEpoch();
  const arrowLabels = useArrowLabelLayouts(
    elements,
    hasArrows,
    tabFont,
    fontEpoch,
    undefined,
    tabFinish,
  );

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because it walks the elements. The chrome that derives it lays a drag in
  // progress over these elements itself (useCanvasSelectionView), so a preview frame renders the
  // chrome and not this canvas (docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved").
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly: readOnly || inspecting,
      elementMenuOpen: elementMenuOpen === true,
      labelRectOf: arrowLabels.labelRectOf,
    }),
    [
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      inspecting,
      elementMenuOpen,
      arrowLabels,
    ],
  );
  // The one selected element when it is a path: the path tool's edit gesture arms on it.
  const soleSelectedPathId = useSelectionOf(
    useCallback(
      (s: Selection) =>
        s.multiSelectedIds.size === 0 &&
        s.selectedId !== null &&
        elements.some((el) => el.id === s.selectedId && el.type === 'path')
          ? s.selectedId
          : null,
      [elements],
    ),
  );

  return { hasArrows, arrowLabels, selectionInput, soleSelectedPathId };
}
