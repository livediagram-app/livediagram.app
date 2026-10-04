'use client';

// The selection chrome inside the grips layer (docs/specs/008-canvas/blueprints/selection-store.md): the
// next-note buttons, the quick-connect pluses and the union resize box. It reads the selection from
// the store, so a selection change re-renders this and not the element layer around it.

import type { ComponentProps } from 'react';
import type { Element } from '@livediagram/document';
import { UnionResizeHandles } from '@/components/canvas/element-parts';
import { NextNoteButtons } from '@/components/canvas/NextNoteButtons';
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
  elements,
  editingId,
  nextNote,
  pluses,
  onBeginDrag,
}: {
  selectionInput: CanvasSelectionInput;
  elements: Element[];
  editingId: string | null;
  // The event-storming next-note buttons, when the board offers them.
  nextNote: { blocked: boolean; onAdd: ComponentProps<typeof NextNoteButtons>['onAdd'] } | null;
  pluses: Omit<PlusesProps, 'selectedElement' | 'bounds' | 'zoom'>;
  onBeginDrag: ComponentProps<typeof UnionResizeHandles>['onBeginDrag'];
}) {
  const { selectionBounds, showPlus, showUnionResize, unionResizeBounds, unionResizePrimaryId } =
    useCanvasSelectionView(selectionInput);
  const selectedId = useSelectionOf(singleId);
  // Counter-scaled chrome: the zoom from the canvas's zoom context, so the layer passes none.
  const zoom = useCanvasZoom();
  return (
    <>
      {/* The next-note buttons on the note you are pointing at or have selected
          (docs/specs/021-event-storming/event-storming.md Phase 7). They stand down while any drag is in
          hand: the board is the drag's for the duration. */}
      {nextNote ? (
        <NextNoteButtons
          elements={elements}
          selectedId={selectedId}
          editingId={editingId}
          blocked={nextNote.blocked}
          zoom={zoom}
          onAdd={nextNote.onAdd}
        />
      ) : null}

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
