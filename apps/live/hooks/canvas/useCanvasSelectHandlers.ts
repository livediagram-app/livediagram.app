import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { isBoxed, type Element } from '@livediagram/diagram';

// The element / arrow selection-routing callbacks, lifted out of
// Canvas: stable wrappers for the memo'd children (BoxedElementView /
// ArrowView), so a Canvas re-render doesn't hand every element a fresh
// closure and defeat the memo.
export function useCanvasSelectHandlers({
  elements,
  multiSelectedIds,
  onSelect,
  onShiftSelect,
  onElementContextMenu,
  onMultiContextMenu,
}: {
  elements: Element[];
  multiSelectedIds: Set<string>;
  onSelect: (id: string) => void;
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
      // Right-clicking a member of an active multi-selection keeps the whole
      // selection and opens a selection-wide menu. Right-clicking a grouped
      // element selects the group (which expands to all members) and opens
      // the same menu. Otherwise it's a single element.
      const inMarquee = multiSelectedIds.size > 1 && multiSelectedIds.has(id);
      const el = elements.find((e) => e.id === id);
      const grouped = !!el && isBoxed(el) && !!el.groupId;
      if (inMarquee && onMultiContextMenu) {
        onMultiContextMenu(sx, sy);
        return;
      }
      if (grouped && onMultiContextMenu) {
        onSelect(id);
        onMultiContextMenu(sx, sy);
        return;
      }
      onSelect(id);
      onElementContextMenu?.(id, sx, sy);
    },
    [onSelect, onElementContextMenu, onMultiContextMenu, elements, multiSelectedIds],
  );

  // Stable wrapper for the arrow click flow. Same rationale as
  // handleElementContextSelect: a per-arrow inline arrow at the
  // call site would defeat ArrowView's memo on every render of the
  // Canvas. Mirrors BoxedElementView's shift-modifier semantics so
  // an arrow can join a marquee multi-selection via plain click
  // (when one is active) or Shift-click. Reading the latest
  // `multiSelectedIds` through a ref keeps this callback stable
  // even as the selection set changes.
  const multiSelectedIdsRef = useRef(multiSelectedIds);
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

  const handleArrowSelect = useCallback(
    (id: string, e: ReactPointerEvent) => {
      const set = multiSelectedIdsRef.current;
      const isMember = set.has(id);
      if (e.shiftKey || (set.size > 0 && !isMember)) {
        onShiftSelect(id);
        return;
      }
      onSelect(id);
    },
    [onSelect, onShiftSelect],
  );

  return { handleElementContextSelect, handleArrowSelect };
}
