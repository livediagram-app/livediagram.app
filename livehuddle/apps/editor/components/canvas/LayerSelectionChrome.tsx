'use client';

// The selection chrome inside the grips layer (docs/specs/008-canvas/blueprints/selection-store.md): the
// union resize box. It reads the selection from the store, so a selection change re-renders this and not
// the element layer around it.

import type { ComponentProps } from 'react';
import { UnionResizeHandles } from '@/components/canvas/element-parts';
import {
  useCanvasSelectionView,
  type CanvasSelectionInput,
} from '@/hooks/canvas/useCanvasSelectionView';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';

export function LayerSelectionChrome({
  selectionInput,
  tabId,
  onBeginDrag,
}: {
  selectionInput: CanvasSelectionInput;
  // The tab the selection is on, whose drag preview the selection follows.
  tabId: string;
  onBeginDrag: ComponentProps<typeof UnionResizeHandles>['onBeginDrag'];
}) {
  const { showUnionResize, unionResizeBounds, unionResizePrimaryId } = useCanvasSelectionView(
    selectionInput,
    tabId,
  );
  // Counter-scaled chrome: the zoom from the canvas's zoom context, so the layer passes none.
  const zoom = useCanvasZoom();
  return (
    <>
      {/* Dotted border around the whole multi-selection / group, so it reads
          as one unit. Outset a touch from the union bounds. */}
      {showUnionResize && unionResizeBounds ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md border border-dashed border-brand-400/80 dark:border-brand-300/70"
          style={{
            left: unionResizeBounds.x - 6,
            top: unionResizeBounds.y - 6,
            width: unionResizeBounds.width + 12,
            height: unionResizeBounds.height + 12,
          }}
        />
      ) : null}

      {showUnionResize && unionResizeBounds && unionResizePrimaryId ? (
        <UnionResizeHandles
          bounds={unionResizeBounds}
          primaryId={unionResizePrimaryId}
          zoom={zoom}
          onBeginDrag={onBeginDrag}
        />
      ) : null}
    </>
  );
}
