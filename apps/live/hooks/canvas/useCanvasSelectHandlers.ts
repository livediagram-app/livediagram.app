import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { armPlainClick, isOnlySelected, plainClickOutcome } from '@/lib/selection-click';
import { debugLog } from '@/lib/debug-log';

// The element / arrow selection-routing callbacks, lifted out of
// Canvas: stable wrappers for the memo'd children (BoxedElementView /
// ArrowView), so a Canvas re-render doesn't hand every element a fresh
// closure and defeat the memo.
export function useCanvasSelectHandlers({
  inertIds,
  isPaintMode,
  selectedId,
  multiSelectedIds,
  onSelect,
  onDeselect,
  onShiftSelect,
  onElementContextMenu,
  onMultiContextMenu,
}: {
  // Elements on a hidden or locked layer (docs/specs/006-document/layers.md): right-click and
  // arrow-click route nowhere for them.
  inertIds: Set<string>;
  // The format painter is armed: every press paints, so none settles a click.
  isPaintMode: boolean;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onShiftSelect: (id: string) => void;
  onElementContextMenu?: (id: string, screenX: number, screenY: number) => void;
  onMultiContextMenu?: (screenX: number, screenY: number) => void;
}) {
  // Stable wrapper for the element-right-click flow. BoxedElementView
  // is memoed; passing inline arrows for `onContextSelect` would
  // recreate them per element per render and invalidate the memo.
  // useCallback gives it one identity across renders, so the memoed
  // child sees the same function reference until `onSelect` or
  // `onElementContextMenu` itself changes upstream.
  const handleElementContextSelect = useCallback(
    (id: string, sx: number, sy: number) => {
      if (inertIds.has(id)) return;
      // Right-clicking a member of an active multi-selection keeps the whole
      // selection and opens a selection-wide menu. Otherwise it's a single
      // element.
      const inMarquee = multiSelectedIds.size > 1 && multiSelectedIds.has(id);
      if (inMarquee && onMultiContextMenu) {
        onMultiContextMenu(sx, sy);
        return;
      }
      onSelect(id);
      onElementContextMenu?.(id, sx, sy);
    },
    [onSelect, onElementContextMenu, onMultiContextMenu, multiSelectedIds, inertIds],
  );

  // The latest selection through a ref, so the click callbacks below stay
  // stable as the selection changes and a release reads the selection it ends.
  const selectionRef = useRef({ selectedId, multiSelectedIds });
  useEffect(() => {
    selectionRef.current = { selectedId, multiSelectedIds };
  }, [selectedId, multiSelectedIds]);

  // The click rules (docs/specs/008-canvas/canvas-and-palette.md "Selection", "Marquee
  // box-select"): a plain click deselects the only selected element and selects
  // anything else alone, a multi-selection member included.
  const handleElementClick = useCallback(
    (id: string) => {
      if (inertIds.has(id)) return;
      const outcome = plainClickOutcome(selectionRef.current, id);
      debugLog('[select-click]', id, outcome);
      if (outcome === 'deselect') onDeselect();
      else onSelect(id);
    },
    [onSelect, onDeselect, inertIds],
  );

  // Stable wrapper for the arrow press flow. Same rationale as
  // handleElementContextSelect: a per-arrow inline arrow at the call site
  // would defeat ArrowView's memo on every render of the Canvas. Shift-click
  // toggles membership; a plain press selects the arrow alone, except on the
  // only selected arrow, where the release settles the click (a press that
  // bends the line keeps it selected). `paired` is the second press of a
  // double-click, which always selects, as its editor opens.
  const handleArrowSelect = useCallback(
    (id: string, e: ReactPointerEvent, paired = false) => {
      if (inertIds.has(id)) return;
      if (e.shiftKey) {
        onShiftSelect(id);
        return;
      }
      if (!paired && !isPaintMode && isOnlySelected(selectionRef.current, id)) {
        armPlainClick(e, () => handleElementClick(id));
        return;
      }
      onSelect(id);
    },
    [onSelect, onShiftSelect, inertIds, isPaintMode, handleElementClick],
  );

  return { handleElementContextSelect, handleArrowSelect, handleElementClick };
}
