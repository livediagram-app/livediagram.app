import { useCallback } from 'react';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import {
  useCanvasSelectionView,
  type CanvasSelectionInput,
} from '@/hooks/canvas/useCanvasSelectionView';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { selectionMoving, useCanvasGesture } from '@/lib/canvas-gesture';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { FloatingToolbar } from '@/components/chrome/FloatingToolbar';
import { MultiSelectionToolbar } from '@/components/canvas/MultiSelectionToolbar';

// The floating multi-selection toolbar (docs/specs/008-canvas/canvas-and-palette.md), riding a sibling wrapper
// that mirrors the canvas transform so it counter-scales with zoom and floats over the selection. A single
// selected element has no toolbar in livedocuments ("Selection popover"): what it held is in the element menu,
// opened by a right-click or a long-press.

// What the toolbar reads while it is not drawn: never drawn, so any fixed view will do.
const RESTING_VIEW: View = { zoom: 1, offset: { x: 0, y: 0 } };
const multiOf = (s: Selection) => s.multiSelectedIds;

// Canvas passes its props and what the selection is derived from; the toolbar reads the selection
// from the store, so a selection change re-renders it and not the canvas.
export function CanvasSelectionToolbars({
  props,
  selectionInput,
}: {
  props: CanvasProps;
  selectionInput: CanvasSelectionInput;
}) {
  const { multiToolbarBounds, showMultiToolbar } = useCanvasSelectionView(
    selectionInput,
    props.activeTabId ?? '',
  );
  const multiSelectedIds = useSelectionOf(multiOf);
  // The toolbar mirrors the canvas transform, so it follows the view, but only while it shows:
  // otherwise a zoom renders none of this (docs/specs/008-canvas/blueprints/viewport-store.md).
  const { zoom: viewportZoom, offset: viewportOffset } = useViewportOf(
    useCallback((v: View) => (showMultiToolbar ? v : RESTING_VIEW), [showMultiToolbar]),
  );
  // While a selection is moved, resized or reshaped the toolbar stands down and stops measuring
  // (docs/specs/008-canvas/canvas-performance.md); it comes back at the new place when it ends.
  const multiStale = selectionMoving(useCanvasGesture());
  const { elements, readOnly, canvasTool, onOpenMultiContextMenu } = props;
  return (
    <>
      {/* Marquee multi-selection toolbar — floats over the selection's union
          bounds (above, or below when there's no room) instead of pinning to
          the top of the screen. Rides
          a canvas-transform sibling wrapper so it counter-scales with
          zoom. Anchored on `multiToolbarBounds` (which spans arrows too) rather
          than the boxed-only resize box, so an arrow-only / mixed marquee still
          gets the toolbar — and its "More" entry into the Flow / animate menu.
          Gated on a true marquee multi-selection (2+), never in view-only. */}
      {showMultiToolbar && multiToolbarBounds && canvasTool !== 'spotlight' ? (
        <div
          className="pointer-events-none absolute inset-0 z-[var(--z-overlay)] origin-center"
          style={{
            transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
            opacity: multiStale ? 0 : 1,
            visibility: multiStale ? 'hidden' : 'visible',
            transition:
              'opacity var(--transition-duration-micro) ease, visibility var(--transition-duration-micro) ease',
          }}
        >
          <FloatingToolbar
            bounds={multiToolbarBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            suspended={multiStale}
            title={`Selected Elements (${multiSelectedIds.size})`}
          >
            <MultiSelectionToolbar
              allLocked={elements
                .filter((el) => multiSelectedIds.has(el.id))
                .every((el) => el.locked === true)}
              selectedElements={elements.filter((el) => multiSelectedIds.has(el.id))}
              onDuplicate={props.onDuplicateMultiSelected}
              onDelete={props.onDeleteMultiSelected}
              onToggleLock={props.onToggleLockMultiSelected}
              onFilter={readOnly ? undefined : props.onFilterMultiSelected}
              onExport={props.onExportMultiSelected}
              onOpenContextMenu={readOnly ? undefined : onOpenMultiContextMenu}
            />
          </FloatingToolbar>
        </div>
      ) : null}
    </>
  );
}
