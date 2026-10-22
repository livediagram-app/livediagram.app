'use client';

// The selection chrome inside the grips layer (docs/specs/008-canvas/blueprints/selection-store.md): the
// quick-connect pluses and the union resize box. It reads the selection from
// the store, so a selection change re-renders this and not the element layer around it.

import type { ComponentProps } from 'react';
import { logoPageAt, type Element, type LaidOutPage } from '@livepages/document';
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

/** Whether a selection's centre sits on a logo page: no quick-connect pluses there. */
export function onLogoPage(
  pages: readonly LaidOutPage[] | null | undefined,
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !!pages && !!logoPageAt(pages, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
}

export function LayerSelectionChrome({
  selectionInput,
  tabId,
  elements,
  pluses,
  onBeginDrag,
  pages,
}: {
  selectionInput: CanvasSelectionInput;
  // The tab the selection is on, whose drag preview the selection follows.
  tabId: string;
  elements: Element[];
  pluses: Omit<PlusesProps, 'selectedElement' | 'bounds' | 'zoom'>;
  onBeginDrag: ComponentProps<typeof UnionResizeHandles>['onBeginDrag'];
  // The pages: a selection on a logo page shows no quick-connect pluses
  // (docs/specs/007-editor/logo-pages.md "A logo page"), a mark not a diagram.
  pages?: readonly LaidOutPage[] | null;
}) {
  const { selectionBounds, showPlus, showUnionResize, unionResizeBounds, unionResizePrimaryId } =
    useCanvasSelectionView(selectionInput, tabId);
  const selectedId = useSelectionOf(singleId);
  // Counter-scaled chrome: the zoom from the canvas's zoom context, so the layer passes none.
  const zoom = useCanvasZoom();
  return (
    <>
      {showPlus && selectionBounds && !onLogoPage(pages, selectionBounds) ? (
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
