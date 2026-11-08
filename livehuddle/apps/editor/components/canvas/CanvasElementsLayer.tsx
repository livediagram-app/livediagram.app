import { useMemo, useState } from 'react';
import { PeerCursors } from '@/components/canvas/PeerCursors';

import { useStableHandlers } from '@liveworkspace/workbench/hooks/ui/useStableHandlers';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { buildRetiredArrowLinks } from './retired-arrow-links';
import { shownWithOverlay, useLayerDragPreview } from '@/hooks/canvas/useLayerDragPreview';
import { CanvasElementList, type BoxedShared } from './CanvasElementList';
import { usePublishSketchBackdrops } from '@/lib/sketch-backdrop-store';
import { useFontEpoch } from '@liveworkspace/workbench/components/canvas/useFontEpoch';
import { isSelectionMode, elementIndexFor, paintOrder } from '@livehuddle/document';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  SelectionGripsContext,
  SelectionGripsLayer,
  type SelectionGripHosts,
} from '@/components/canvas/SelectionGripsLayer';
import { ChangesetRevealOverlay } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusOverlay } from '@/components/canvas/AgentFocusOverlay';
import { LayerSelectionChrome } from '@/components/canvas/LayerSelectionChrome';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

// Canvas-computed values threaded into the element layer alongside the
// raw props.
type ElementsExtras = {
  // What the selection chrome derives the selection from (it reads the selection from the store).
  selectionInput: CanvasSelectionInput;
  isPaintMode: boolean;
  // A retired arrow's card press: selects it, never drags it (RetiredArrowView).
  handleArrowSelect: (id: string, e: ReactPointerEvent, paired?: boolean) => void;
  handleElementClick: (id: string) => void;
  handleElementContextSelect: (id: string, sx: number, sy: number) => void;
};

export type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

// The element-rendering layer of the canvas: every element (retired arrows
// and boxed views interleaved in z-order), remote cursors,
// and the grips layer on top of them all: the union resize
// handles and every element's own grips,
// portalled in (SelectionGripsLayer). Rendered inside Canvas's
// viewport-transformed wrapper.
// Memoised with its `on…` props stable (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters,
// not the canvas"): a canvas render that changes none of them (a pan, the camera following a walk) stops here.
export const CanvasElementsLayer = withStableEventProps(CanvasElementsLayerView);

function CanvasElementsLayerView(props: CanvasElementsLayerProps) {
  const {
    editCursorAtEnd,
    editingId,
    elements,
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    imageContext,
    isPaintMode,
    onBeginDrag,
    onPressArmedAction,
    onBeginEdit,
    onCancelEdit,
    onCommitLabel,
    onSetTextAlign,
    onDeleteRetired,
    onFollowLink,
    onPressModeButton,
    onPressFocusButton,
    onOpenElementSettings,
    chairSitters,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onShiftSelect,
    readOnly,
    canMove,
    canResize,
    canvasTool,
    onEnterPortal,
    onPressAvatarPad,
    peers,
    remoteSelectionsByElement,
    shiftDupGhostIds,
    tabFont,
    tabFinish,
    tabSummaries,
  } = props;
  // Identity-stable wrappers for every function prop the memoized
  // element views receive. The editor's orchestration mints fresh
  // closures per render (every drag tick, cursor packet, keystroke), so
  // without this the views' React.memo never fired and dragging ONE
  // element re-rendered all N views at pointer rate. See
  // useStableHandlers; the conditional (read-only) handlers keep their
  // presence/absence so children still branch on them.
  const h = useStableHandlers({
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginDrag,
    onPressArmedAction,
    onShiftSelect,

    onSetTextAlign: readOnly ? undefined : onSetTextAlign,
    onDeleteRetired: readOnly ? undefined : onDeleteRetired,
    onFollowLink,
    onPressModeButton,
    onPressFocusButton,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    // docs/specs/008-canvas/canvas-performance.md: the rest of what each view receives, stable too.
    onOpenElementSettings,
    onEnterPortal,
    onPressAvatarPad,
  });
  // Auto-fit measures the face it paints, and webfonts land after first
  // paint — re-render this layer once they are in so every fitted label
  // re-measures in its real face (see useFontEpoch).
  const fontEpoch = useFontEpoch();
  // Paint order (docs/specs/006-document/layers.md "Stacking"): array order with frames hoisted to the front (a frame
  // is a section backdrop that must sit behind its contents so they stay clickable). The same order the exporters
  // use. Memoised for the same reason as the index (stable identity when inputs are).
  const ordered = useMemo(
    () => paintOrder(elements).map((element) => ({ element, layerOpacity: 1 })),
    [elements],
  );

  // What every boxed element view takes from this layer, the same for each element.
  const boxedShared = useMemo<BoxedShared>(
    () => ({
      onPlainClick: h.handleElementClick,
      isPaintMode,
      tabSummaries,
      readOnly,
      onBeginDrag: h.onBeginDrag,
      onPressArmedAction: h.onPressArmedAction,
      onShiftSelect: h.onShiftSelect,
      onBeginEdit: h.onBeginEdit,
      onCommitLabel: h.onCommitLabel,
      onSetTextAlign: h.onSetTextAlign,
      onDeleteRetired: h.onDeleteRetired,
      onCancelEdit: h.onCancelEdit,
      onFollowLink: h.onFollowLink,
      onPressModeButton: h.onPressModeButton,
      onPressFocusButton: h.onPressFocusButton,
      onOpenElementSettings: h.onOpenElementSettings,
      chairSitters,
      // Mode Buttons light up for the mode they hand out; the canvas-tool union is wider than the mode vocabulary
      // so narrow rather than widen.
      activeMode: isSelectionMode(canvasTool) ? canvasTool : undefined,
      onEnterPortal: h.onEnterPortal,
      onPressAvatarPad: h.onPressAvatarPad,
      onOpenComments: h.onOpenComments,
      onOpenAction: h.onOpenAction,
      onOpenNote: h.onOpenNote,
      onEditLink: h.onEditLink,
      imageContext,
      onContextSelect: h.handleElementContextSelect,
    }),
    [h, isPaintMode, tabSummaries, readOnly, chairSitters, canvasTool, imageContext],
  );
  // The elements actually drawn.
  const drawnElements = useMemo(() => ordered.map((o) => o.element), [ordered]);
  // Shapes something sits on keep a solid fill under Sketch (docs/specs/008-canvas/finish.md).
  usePublishSketchBackdrops(props.activeTabId ?? '', drawnElements, tabFinish);
  // The drawn board by id (cached per board), which each retired arrow's ends resolve against, and which arrows read
  // which elements, so a drag preview redraws the arrows on what it moves.
  const elementIndex = elementIndexFor(drawnElements);
  const arrowLinks = useMemo(() => buildRetiredArrowLinks(drawnElements), [drawnElements]);
  // A drag in progress, ours or a collaborator's (docs/specs/008-canvas/drag-preview.md): each element
  // it changes, and each retired arrow reading them, reads its own preview entry (PreviewedElement), so a
  // preview frame renders those and not this layer; the maps above stay as built from the document.
  // The layer renders for a preview only when it adds or removes elements, which changes the list.
  const { store: previewStore, structure: previewStructure } = useLayerDragPreview({
    tabId: props.activeTabId ?? '',
    ordered,
    drawnElements,
    elementIndex,
    arrowLinks,
  });
  const shownOrder = useMemo(
    () => (previewStructure ? shownWithOverlay(ordered, previewStructure) : ordered),
    [ordered, previewStructure],
  );
  // The grips layer's portal hosts (docs/specs/008-canvas/canvas-and-palette.md "Resize"), set once
  // it mounts; every element view portals its grips into them.
  const [gripHosts, setGripHosts] = useState<SelectionGripHosts | null>(null);
  return (
    <>
      <SelectionGripsContext.Provider value={gripHosts}>
        {/* Render elements in their natural array order so
            `bringToFront` / `sendToBack` reorder a retired arrow
            relative to boxed elements. */}
        <CanvasElementList
          shownOrder={shownOrder}
          previewStore={previewStore}
          attachPlane={previewStore.attachPlane}
          h={h}
          boxedShared={boxedShared}
          elementIndex={elementIndex}
          editingId={editingId}
          editCursorAtEnd={editCursorAtEnd}
          readOnly={readOnly}
          shiftDupGhostIds={shiftDupGhostIds}
          remoteSelectionsByElement={remoteSelectionsByElement}
          canMove={canMove}
          canResize={canResize}
          tabFont={tabFont}
          tabFinish={tabFinish}
          fontEpoch={fontEpoch}
        />

        {/* What the agents present name in focus (docs/specs/024-agents/agent-presence.md "In the editor"):
          above the elements, beneath the remote cursors. */}
        <AgentFocusOverlay elements={elements} />

        <PeerCursors peers={peers} />

        {/* What a relayed changeset touched (docs/specs/024-agents/agent-changesets.md "In the editor"):
          above the elements, below the selection chrome. */}
        <ChangesetRevealOverlay elements={elements} tabId={props.activeTabId ?? ''} />

        {/* The grips layer (docs/specs/008-canvas/canvas-and-palette.md "Resize"): above every element, so
          no grip is ever covered. The canvas's own grips go in here; each element's are portalled in. */}
        <SelectionGripsLayer onHosts={setGripHosts}>
          <LayerSelectionChrome
            selectionInput={props.selectionInput}
            tabId={props.activeTabId ?? ''}
            onBeginDrag={onBeginDrag}
          />
        </SelectionGripsLayer>
      </SelectionGripsContext.Provider>
    </>
  );
}
