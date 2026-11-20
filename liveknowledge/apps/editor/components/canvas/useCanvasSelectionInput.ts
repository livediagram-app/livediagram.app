// The canvas's arrow labels and the selection chrome's input (docs/specs/008-canvas/arrow-labels.md,
// docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved"), with the flashcard stack's
// staging they sit beside, derived once per change. Called by Canvas in the same place its body ran them,
// so the hooks keep their order.
import { useMemo } from 'react';
import { useFontEpoch } from '@liveworkspace/workbench/components/canvas/useFontEpoch';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { useArrowLabelLayouts } from '@/hooks/canvas/useArrowLabelLayouts';
import { flashcardStage } from '@/lib/flashcard-stack';
import { articlePlusBlocked } from '@/lib/article-plus-blocked';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

export function useCanvasSelectionInput({
  elements,
  editingId,
  isPaintMode,
  tabLocked,
  readOnly,
  pagesMode,
  tabFont,
  tabFinish,
  elementMenuOpen,
}: Pick<
  CanvasProps,
  | 'elements'
  | 'editingId'
  | 'tabLocked'
  | 'readOnly'
  | 'pagesMode'
  | 'tabFont'
  | 'tabFinish'
  | 'elementMenuOpen'
> & { isPaintMode: boolean }) {
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
  // An object in an article's writing (a chart, an image, a table) connects to nothing: no
  // quick-connect pluses on it (docs/specs/007-editor/article-pages.md "Zones"). A predicate the
  // selection derivation applies, so the canvas itself still doesn't read the selection.
  const articlePages = pagesMode?.pages;
  // A stack of flashcards draws its card in front alone (docs/specs/007-editor/flashcards.md
  // "The stack"); the chrome, the snap and the Contents keep the whole row.
  const staged = useMemo(() => (pagesMode ? flashcardStage(pagesMode) : undefined), [pagesMode]);
  const plusBlocked = useMemo(
    () => articlePlusBlocked(articlePages, elements),
    [articlePages, elements],
  );
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      elementMenuOpen: elementMenuOpen === true,
      labelRectOf: arrowLabels.labelRectOf,
      plusBlocked,
    }),
    [
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      elementMenuOpen,
      arrowLabels,
      plusBlocked,
    ],
  );
  return { hasArrows, arrowLabels, staged, selectionInput };
}
