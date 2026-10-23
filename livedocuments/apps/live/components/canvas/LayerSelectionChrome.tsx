'use client';

// The selection chrome inside the grips layer (docs/specs/008-canvas/blueprints/selection-store.md): the
// quick-connect pluses and the union resize box. It reads the selection from
// the store, so a selection change re-renders this and not the element layer around it.

import type { ComponentProps } from 'react';
import type { Element } from '@livedocuments/document';
import { UnionResizeHandles } from '@/components/canvas/element-parts';
import { QuickConnectPluses } from '@/components/canvas/QuickConnectPluses';
import {
  useCanvasSelectionView,
  type CanvasSelectionInput,
} from '@/hooks/canvas/useCanvasSelectionView';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import type { Selection } from '@/lib/selection-store';

const singleId = (s: Selection) => s.selectedId;

type PlusesProps = ComponentProps<typeof QuickConnectPluses>;

export function LayerSelectionChrome({
  selectionInput,
  tabId,
  elements,
  pluses,
  onBeginDrag,
}: {
  selectionInput: CanvasSelectionInput;
  // The tab the selection is on, whose drag preview the selection follows.
  tabId: string;
  elements: Element[];
  pluses: Omit<PlusesProps, 'selectedElement' | 'bounds' | 'zoom'>;
  onBeginDrag: ComponentProps<typeof UnionResizeHandles>['onBeginDrag'];
}) {
  const { selectionBounds, showPlus, showUnionResize, unionResizeBounds, unionResizePrimaryId } =
    useCanvasSelectionView(selectionInput, tabId);
  const selectedId = useSelectionOf(singleId);
  // Counter-scaled chrome: the zoom from the canvas's zoom context, so the layer passes none.
  const zoom = useCanvasZoom();
  return (
    <>
      {showPlus && selectionBounds ? (
        <QuickConnectPluses
          {...pluses}
          selectedElement={selectedId ? elements.find((e) => e.id === selectedId) : undefined}
          bounds={selectionBounds}
          zoom={zoom}
        />
      ) : null}

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
