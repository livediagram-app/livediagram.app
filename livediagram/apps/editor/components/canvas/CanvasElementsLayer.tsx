import { useMemo, useState } from 'react';
import { RemoteCursors } from '@liveworkspace/workbench/components/canvas/RemoteCursor';
import { identityVars } from '@livediagram/ui';
import { participantKey } from '@/lib/identity';
import { useBoxedShared, useElementLayerHandlers } from './useElementLayerHandlers';
import { arrowViewGeometry } from './arrow-view-frame';
import { buildArrowLinks } from './drag-affected-arrows';
import { shownWithOverlay, useLayerDragPreview } from '@/hooks/canvas/useLayerDragPreview';
import { CanvasElementList } from './CanvasElementList';
import { usePublishSketchBackdrops } from '@/lib/sketch-backdrop-store';
import { useFontEpoch } from '@liveworkspace/workbench/components/canvas/useFontEpoch';
import {
  elementFontId,
  resolveFontStack,
  resolveFinish,
  buildElementIndex,
  layerBands,
  layerOpacityOf,
  createElementGridTracker,
  type ElementIndex,
  stackedElementIds,
} from '@livediagram/document';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { type QuickConnectDirection } from '@/lib/canvas';
import { ArrowDefs } from '@/components/canvas/arrow-defs';
import type { ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
import { DrawnArrowPreview } from '@/components/canvas/DrawnArrowPreview';
import {
  SelectionGripsContext,
  SelectionGripsLayer,
  type SelectionGripHosts,
} from '@liveworkspace/workbench/components/canvas/SelectionGripsLayer';
import { ChangesetRevealOverlay } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusOverlay } from '@/components/canvas/AgentFocusOverlay';
import { LayerSelectionChrome } from '@/components/canvas/LayerSelectionChrome';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { usePhotoDraftView } from '@/lib/photo-draft-preview';
import { ZoomedLaserOverlay } from '@/components/canvas/view-readers';
import { useInsertShift } from '@/hooks/canvas/useInsertShift';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

// What a drawn arrow resolves its ends against on a board with no arrows yet.
const EMPTY_ELEMENT_INDEX: ElementIndex = new Map();

// Canvas-computed values threaded into the element layer alongside the
// raw props.
type ElementsExtras = {
  // The draw gesture in flight (canvas coords), for the line or arrow it would land.
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  hasArrows: boolean;
  // Every arrow label laid out once per element change (Canvas owns the pass).
  arrowLabels: ArrowLabels;
  // What the selection chrome derives the selection from (it reads the selection from the store).
  selectionInput: CanvasSelectionInput;
  isPaintMode: boolean;
  handleArrowSelect: (id: string, e: ReactPointerEvent, paired?: boolean) => void;
  handleElementClick: (id: string) => void;
  handleElementContextSelect: (id: string, sx: number, sy: number) => void;
  // Which quick-connect ring is open (lifted to Canvas so only one opens
  // at a time and the toolbar can dodge the top ring). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
};

export type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

// The element-rendering layer of the canvas: the shared arrow defs, every
// element (arrows + boxed views interleaved in z-order), remote cursors,
// the laser overlay, and the grips layer on top of them all: the union resize
// handles, the quick-connect plus buttons, and every element's own grips,
// portalled in (SelectionGripsLayer). Rendered inside Canvas's
// viewport-transformed wrapper.
export function CanvasElementsLayer(props: CanvasElementsLayerProps) {
  const {
    editCursorAtEnd,
    editingId,
    elements,
    tabLayers,
    layerPreviewId,
    hasArrows,
    arrowLabels,
    drawDrag,
    imageContext,
    isPaintMode,
    laserTrails,
    onBeginDrag,
    onAddTableRow,
    onAddTableColumn,
    onAppendWebRow,
    chartPalette,
    onSpawnConnect,
    onStartArrow,
    onStartPencil,
    sessionStartBlocked,
    sessionRunBy,
    timerState,
    // The tab's live timer plus the handlers that drive it, so a Timer
    // session element can BE the timer (docs/specs/012-collaboration/session-button.md) rather than a button that
    // starts one elsewhere. The handlers no-op when edits are blocked, so a
    // read-only surface needs no separate gate here.
    tabTimer,
    commentSelfId,
    actionSelfId,
    revealedIds,
    collab,
    tabVote,
    selfParticipant,
    readOnly,
    canMove,
    canWriteText,
    canResize,
    canvasTool,
    reactionBursts,
    remoteCursors,
    remoteSelectionsByElement,
    shiftDupGhostIds,
    voteReview,
    tabFont,
    tabFinish,
    tabLocked,
    tabSummaries,
    quickRingOpen,
    setQuickRingOpen,
    settings,
  } = props;
  // Identity-stable wrappers for every function prop the memoized element views receive, and the
  // per-element timer, comment and action bags built from them (useElementLayerHandlers.ts).
  const { h, timerControls, commentActionsFor, actionActionsFor } = useElementLayerHandlers(props);
  // Auto-fit measures the face it paints, and webfonts land after first
  // paint — re-render this layer once they are in so every fitted label
  // re-measures in its real face (see useFontEpoch).
  const fontEpoch = useFontEpoch();
  // What the tab's stacks hold, for the reflow glide (docs/specs/009-elements/stack.md "Animation").
  const stackedIds = useMemo(() => stackedElementIds(elements), [elements]);
  // The font an element following the tab letters in, resolved once (docs/specs/004-interface-design/fonts.md):
  // the tab's, or the handwriting font on a Sketch tab (docs/specs/008-canvas/finish.md).
  const tabFontStack = resolveFontStack(elementFontId({}, tabFont, tabFinish));
  // Highest dot count on the tab (docs/specs/012-collaboration/session-tools.md), computed once so each element's
  // vote pill can flag itself a winner once results are revealed.
  const voteMax = tabVote
    ? Object.values(tabVote.votes).reduce((m, ids) => Math.max(m, ids.length), 0)
    : 0;
  // One id -> element index per ELEMENTS CHANGE (not per render),
  // shared by every ArrowView so each resolves its endpoints / label
  // collisions with O(1) lookups instead of scanning the whole element
  // list twice per arrow. Memoised because it's a memo-compared prop of
  // every ArrowView: a fresh Map per render (cursor packets, selection
  // changes) defeated their React.memo and re-rendered every arrow at
  // presence-message rate even when no element had changed.
  const elementIndex = useMemo(
    () => (hasArrows ? buildElementIndex(elements) : null),
    [hasArrows, elements],
  );
  // Insert-between preview (docs/specs/021-event-storming/event-storming.md): while a palette drag hovers a gap on an
  // event-storming board, the elements at and after the insertion point RENDER
  // shifted right to show the slot opening — see useInsertShift.
  const insertShift = useInsertShift();
  // Session-local view state for an open photo draft (docs/specs/021-event-storming/event-storming.md Phase 8).
  const draftView = usePhotoDraftView();
  // Paint order (docs/specs/006-document/layers.md + docs/specs/008-canvas/canvas-and-palette.md): layer bands bottom -> top, keeping
  // array order within each band with frames hoisted to the front of
  // THEIR band (a frame is a section backdrop that must sit behind its
  // contents so they stay clickable). Hidden layers' elements drop out
  // here entirely — no DOM, so no hit-testing either. Same banding the
  // exporters use. Each element carries its band's opacity so per-layer
  // opacity multiplies over the element's own. While a Layers-panel row
  // is hovered (`layerPreviewId`, docs/specs/006-document/layers.md hover-solo) ONLY that band
  // renders — hidden or not — at full band opacity so the preview is
  // legible. Memoised for the same reason as the index (stable identity
  // when inputs are).
  const ordered = useMemo(() => {
    if (layerPreviewId) {
      return layerBands(elements, tabLayers, { includeHidden: true })
        .filter((band) => band.layer.id === layerPreviewId)
        .flatMap((band) => band.elements.map((element) => ({ element, layerOpacity: 1 })));
    }
    return layerBands(elements, tabLayers).flatMap((band) => {
      const layerOpacity = layerOpacityOf(band.layer);
      return band.elements.map((element) => ({ element, layerOpacity }));
    });
  }, [elements, tabLayers, layerPreviewId]);
  // The palette arrives as a fresh array each render (themeChartPalette): keyed by its colours, so the views
  // re-render only when the colours change.
  const paletteKey = chartPalette?.join('|') ?? '';
  // oxlint-disable-next-line react/exhaustive-deps -- keyed on the palette's colours, not the fresh array
  const stablePalette = useMemo(() => chartPalette, [paletteKey]);
  const selfId = participantKey(selfParticipant);
  // What every boxed element view takes from this layer, the same for each element.
  const boxedShared = useBoxedShared({
    h,
    timerControls,
    isPaintMode,
    tabLocked,
    tabSummaries,
    readOnly,
    tabVote,
    selfId,
    voteMax,
    voteReview,
    stablePalette,
    sessionStartBlocked,
    sessionRunBy,
    timerState,
    tabTimer,
    commentSelfId,
    actionSelfId,
    collab,
    canvasTool,
    imageContext,
  });
  // The elements actually drawn, for the arrows' pass-behind breaks: a box on
  // a hidden layer must not cut a gap in a line (docs/specs/008-canvas/arrow-route-behind.md).
  const drawnElements = useMemo(() => ordered.map((o) => o.element), [ordered]);
  // Shapes something sits on keep a solid fill under Sketch (docs/specs/008-canvas/finish.md).
  usePublishSketchBackdrops(props.activeTabId ?? '', drawnElements, tabFinish);
  // The drawn elements' grid (docs/specs/008-canvas/canvas-performance.md "Questions about neighbours
  // ask a spatial index"), re-bucketing only what changed since the last one, and every arrow's frame
  // and holes from it, once per element change. ArrowView compares both by value, so a move
  // re-renders only the arrows whose geometry it changed.
  const [gridTracker] = useState(createElementGridTracker);
  const arrowGeometry = useMemo(() => {
    const out = new Map<string, ReturnType<typeof arrowViewGeometry>>();
    if (!elementIndex) return out;
    const grid = gridTracker.gridFor(drawnElements);
    for (const el of drawnElements) {
      if (el.type === 'arrow')
        out.set(
          el.id,
          arrowViewGeometry(el, elementIndex, grid, resolveFinish(el.finish, tabFinish)),
        );
    }
    return out;
  }, [drawnElements, elementIndex, gridTracker, tabFinish]);
  const arrowLinks = useMemo(
    () => (hasArrows ? buildArrowLinks(drawnElements) : null),
    [hasArrows, drawnElements],
  );
  // A drag in progress, ours or a collaborator's (docs/specs/008-canvas/drag-preview.md): each element
  // it changes, and each arrow depending on them, reads its own preview entry (PreviewedElement), so a
  // preview frame renders those and not this layer; the maps above stay as built from the document.
  // The layer renders for a preview only when it adds or removes elements, which changes the list.
  const { store: previewStore, structure: previewStructure } = useLayerDragPreview({
    tabId: props.activeTabId ?? '',
    ordered,
    drawnElements,
    elementIndex,
    arrowLinks,
    gridFor: (els) => gridTracker.gridFor(els),
    arrowLabels,
    tabFinish,
    stackedIds,
    project: props.projectElement,
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
        {/* Shared arrowhead defs. Multiple per-arrow <svg>s below
            all reference url(#arrowhead) — defs are document-scoped
            in SVG so a single defs node lets every arrow render
            with the same marker. */}
        {hasArrows ? (
          <svg
            className="absolute"
            style={{ width: 0, height: 0, overflow: 'visible' }}
            aria-hidden
          >
            <ArrowDefs />
          </svg>
        ) : null}

        {/* Render elements in their natural array order so
            `bringToFront` / `sendToBack` reorder arrows relative to
            boxed elements (instead of all arrows perpetually stacking
            above all boxes inside a single SVG layer). Each arrow
            gets its own <svg> overlay; pointer events on the SVG are
            disabled in CSS, only the inner arrow line picks them up. */}
        <CanvasElementList
          shownOrder={shownOrder}
          previewStore={previewStore}
          attachPlane={previewStore.attachPlane}
          h={h}
          boxedShared={boxedShared}
          arrowGeometry={arrowGeometry}
          arrowLabels={arrowLabels}
          elements={elements}
          editingId={editingId}
          editCursorAtEnd={editCursorAtEnd}
          reshapingArrowId={props.reshapingArrowId}
          isPaintMode={isPaintMode}
          tabLocked={tabLocked}
          readOnly={readOnly}
          insertShift={insertShift}
          shiftDupGhostIds={shiftDupGhostIds}
          draftView={draftView}
          tabVote={tabVote}
          tabLayers={tabLayers}
          remoteSelectionsByElement={remoteSelectionsByElement}
          canMove={canMove}
          canWriteText={canWriteText}
          canResize={canResize}
          voteReview={voteReview}
          commentActionsFor={commentActionsFor}
          actionActionsFor={actionActionsFor}
          revealedIds={revealedIds}
          reactionBursts={reactionBursts}
          tabFont={tabFont}
          tabFinish={tabFinish}
          fontEpoch={fontEpoch}
          stackedIds={stackedIds}
        />

        {/* The line or arrow being drawn (docs/specs/023-draw-mode/draw-mode.md "Shapes"): the
          element the release lands, after every element, where it will land. */}
        {drawDrag && props.pendingDraw?.type === 'arrow' && props.previewDrawnArrow ? (
          <DrawnArrowPreview
            arrow={props.previewDrawnArrow(
              props.pendingDraw,
              drawDrag.startX,
              drawDrag.startY,
              drawDrag.currentX,
              drawDrag.currentY,
            )}
            elementIndex={elementIndex ?? EMPTY_ELEMENT_INDEX}
            occluders={drawnElements}
            draftLayout={arrowLabels.draftLayout}
            fontFamily={tabFontStack}
            withDefs={!hasArrows}
          />
        ) : null}

        {/* What the agents present name in focus (docs/specs/024-agents/agent-presence.md "In the editor"):
          above the elements, beneath the remote cursors. */}
        <AgentFocusOverlay elements={elements} />

        <RemoteCursors cursors={remoteCursors} paint={identityVars} />

        {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
        <ZoomedLaserOverlay trails={laserTrails} />

        {/* What a relayed changeset touched (docs/specs/024-agents/agent-changesets.md "In the editor"):
          above the elements, below the selection chrome. */}
        <ChangesetRevealOverlay elements={elements} tabId={props.activeTabId ?? ''} />

        {/* The grips layer (docs/specs/008-canvas/canvas-and-palette.md "Resize"): above every element, so
          no grip is ever covered. The canvas's own grips go in here; each element's are portalled in. */}
        <SelectionGripsLayer onHosts={setGripHosts} isoDepth={ordered.length}>
          <LayerSelectionChrome
            selectionInput={props.selectionInput}
            tabId={props.activeTabId ?? ''}
            elements={elements}
            editingId={editingId}
            nextNote={
              props.esBoard && props.onAddNextNote
                ? {
                    blocked:
                      readOnly || tabLocked || props.createBlocked === true || insertShift.animates,
                    onAdd: props.onAddNextNote,
                  }
                : null
            }
            pluses={{
              quickRingOpen,
              setQuickRingOpen,
              openOnHover: settings.quickAddOnHover === true,
              onSpawnConnect,
              onStartArrow,
              onStartPencil,
              onAddTableRow,
              onAddTableColumn,
              onAppendWebRow,
              onAddEntityField: h.onAddEntityField,
              onAddRelatedEntity: h.onAddRelatedEntity,
            }}
            onBeginDrag={onBeginDrag}
          />
        </SelectionGripsLayer>
      </SelectionGripsContext.Provider>
    </>
  );
}
