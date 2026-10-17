import { useMemo, useState } from 'react';
import { participantKey } from '@/lib/identity';
import { useStableHandlers } from '@/hooks/ui/useStableHandlers';
import { idBound } from './element-layer-props';
import { arrowViewGeometry } from './arrow-view-frame';
import { buildArrowLinks } from './drag-affected-arrows';
import { shownWithOverlay, useLayerDragPreview } from '@/hooks/canvas/useLayerDragPreview';
import { CanvasElementList } from './CanvasElementList';
import { usePublishSketchBackdrops } from '@/lib/sketch-backdrop-store';
import { useFontEpoch } from './useFontEpoch';
import {
  elementFontId,
  resolveFontStack,
  resolveFinish,
  isSelectionMode,
  alignmentCoordinates,
  buildElementIndex,
  layerBands,
  laneSeamCoordinates,
  layerOpacityOf,
  snapSeamCoordinate,
  type CommentMention,
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
} from '@/components/canvas/SelectionGripsLayer';
import { ChangesetRevealOverlay } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusOverlay } from '@/components/canvas/AgentFocusOverlay';
import { LayerSelectionChrome } from '@/components/canvas/LayerSelectionChrome';
import { useSheetChartRenderer, type BoxedShared } from '@/components/canvas/sheet-chart-renderer';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { usePhotoDraftView } from '@/lib/photo-draft-preview';
import { ZoomedLaserOverlay, ZoomedRemoteCursor } from '@/components/canvas/view-readers';
import { useInsertShift } from '@/hooks/canvas/useInsertShift';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { IllustratePageClip } from '@/components/canvas/IllustratePageClip';
import { CardVoteProvider, type CardVote } from '@/components/plan/CardVoteContext';
import {
  SheetChartsContext,
  type SheetChartsValue,
} from '@/components/sheets/sheet-charts-context';
import { sheetDrawnChartIds, type LaneGutterEdge, type LaneLike } from '@livediagram/document';
import { GifOmit } from './GifOmit';

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
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    hasArrows,
    arrowLabels,
    drawDrag,
    imageContext,
    isPaintMode,
    laserTrails,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginArrowTranslate,
    onBeginDrag,
    onPressArmedAction,
    onBeginEdit,
    onBeginEndpointDrag,
    onCancelEdit,
    onCommitLabel,
    onSetTextAlign,
    onCommitTable,
    onCommitHeaderSize,
    onAddRailPoint,
    onAddTableRow,
    onAddTableColumn,
    onSetRailLabel,
    onToggleChecklistItem,
    onSetPageHeading,
    onSetWebRows,
    onSetPointerTip,
    onAppendWebRow,
    onSetHeroCaptionLine,
    chartPalette,
    onSpawnConnect,
    onStartArrow,
    onStartPencil,
    onFollowLink,
    onPressModeButton,
    onPressFocusButton,
    onPressSessionButton,
    sessionStartBlocked,
    sessionRunBy,
    timerState,
    // The tab's live timer plus the handlers that drive it, so a Timer
    // session element can BE the timer (docs/specs/012-collaboration/session-button.md) rather than a button that
    // starts one elsewhere. The handlers no-op when edits are blocked, so a
    // read-only surface needs no separate gate here.
    tabTimer,
    onSetSessionConfig,
    onOpenElementSettings,
    commentSelfId,
    commentPanelActions,
    actionSelfId,
    actionPanelActions,
    onPauseTimer,
    onResumeTimer,
    onResetTimer,
    onClearTimer,
    onSetTimerDuration,
    revealedIds,
    onToggleReveal,
    onRollPicker,
    collab,
    chairSitters,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onOpenEditDialog,
    onDropIcon,
    onLinkCell,
    onShiftSelect,
    tabVote,
    selfParticipant,
    onCastVote,
    onRetractVote,
    readOnly,
    takePart = false,
    canMove,
    canWriteText,
    canResize,
    canvasTool,
    onEnterPortal,
    onFireReaction,
    reactionBursts,
    onReactionBurstDone,
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
    onBeginEndpointDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginArrowTranslate,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginDrag,
    onPressArmedAction,
    onShiftSelect,
    // Voting is taking part: a Participant's as well as an Editor's (docs/specs/013-workspace/share-roles.md).
    onCastVote: readOnly && !takePart ? undefined : onCastVote,
    onRetractVote: readOnly && !takePart ? undefined : onRetractVote,
    onSetTextAlign: readOnly ? undefined : onSetTextAlign,
    onCommitTable,
    onCommitHeaderSize: readOnly ? undefined : onCommitHeaderSize,
    // The seam's snap targets (docs/specs/009-elements/lane.md). Resolved here because this is where
    // the sibling elements are: BoxedElementView only ever sees its own.
    onSnapSeam: readOnly
      ? undefined
      : (
          candidate: number,
          axis: 'x' | 'y',
          excludeId: string,
          edgeOf: (el: LaneLike) => LaneGutterEdge,
          sizeOf: (el: LaneLike) => number,
        ) =>
          snapSeamCoordinate(candidate, {
            seams: laneSeamCoordinates(elements, axis, excludeId, edgeOf, sizeOf),
            alignment: alignmentCoordinates(elements, axis, excludeId),
          }).value,
    onSetRailLabel,
    onToggleChecklistItem: readOnly ? undefined : onToggleChecklistItem,
    onSetPageHeading,
    onSetWebRows: readOnly ? undefined : onSetWebRows,
    onSetPointerTip: readOnly ? undefined : onSetPointerTip,
    onSetHeroCaptionLine: readOnly ? undefined : onSetHeroCaptionLine,
    onFollowLink,
    onPressModeButton,
    onPressFocusButton,
    onPressSessionButton,
    onToggleReveal,
    onRollPicker,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onOpenEditDialog,
    onDropIcon,
    onLinkCell,
    // docs/specs/008-canvas/canvas-performance.md: the rest of what each view receives, stable too.
    onSetSessionConfig,
    onOpenElementSettings,
    onEnterPortal,
    onFireReaction,
    onReactionBurstDone,
    onPauseTimer,
    onResumeTimer,
    onResetTimer,
    onClearTimer,
    onSetTimerDuration,
    commentAdd: commentPanelActions?.add,
    commentRemove: commentPanelActions?.remove,
    commentResolve: commentPanelActions?.resolve,
    commentUnresolve: commentPanelActions?.unresolve,
    actionConfigure: actionPanelActions?.configure,
    actionComplete: actionPanelActions?.complete,
    actionReopen: actionPanelActions?.reopen,
  });
  // One timer bag and one comment / action bag per element, built from the stable wrappers above, so
  // a view's memo holds across editor renders (docs/specs/008-canvas/canvas-performance.md).
  // Running the timer is the session's runner's (docs/specs/013-workspace/share-roles.md, facilitator.md): a
  // Participant, a Viewer and anyone but the facilitator see the face without its controls.
  const timerControls = useMemo(
    () =>
      sessionStartBlocked
        ? {}
        : {
            pause: h.onPauseTimer,
            resume: h.onResumeTimer,
            reset: h.onResetTimer,
            clear: h.onClearTimer,
            setDuration: h.onSetTimerDuration,
          },
    [h, sessionStartBlocked],
  );
  const commentActionsFor = useMemo(() => {
    const { commentAdd, commentRemove, commentResolve, commentUnresolve } = h;
    if (!commentAdd || !commentRemove || !commentResolve || !commentUnresolve) return null;
    return idBound((id) => ({
      add: (text: string, mentions: CommentMention[]) => commentAdd(id, text, mentions),
      remove: (commentId: string) => commentRemove(id, commentId),
      resolve: () => commentResolve(id),
      unresolve: () => commentUnresolve(id),
    }));
  }, [h]);
  const actionActionsFor = useMemo(() => {
    const { actionConfigure, actionComplete, actionReopen } = h;
    if (!actionConfigure || !actionComplete || !actionReopen) return null;
    return idBound((id) => ({
      add: () => actionConfigure(id, null),
      edit: (actionId: string) => actionConfigure(id, actionId),
      complete: (actionId: string) => actionComplete(id, actionId),
      reopen: (actionId: string) => actionReopen(id, actionId),
    }));
  }, [h]);
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
  // A chart that sits in a Sheet on this tab is the Sheet's to draw, over its cells (docs/specs/029-sheets/sheet.md
  // "Charts"): the canvas draws no copy of it.
  const inSheet = useMemo(() => sheetDrawnChartIds(elements), [elements]);
  const ordered = useMemo(() => {
    const drawn = (element: { id: string }) => !inSheet.has(element.id);
    if (layerPreviewId) {
      return layerBands(elements, tabLayers, { includeHidden: true })
        .filter((band) => band.layer.id === layerPreviewId)
        .flatMap((band) =>
          band.elements.filter(drawn).map((element) => ({ element, layerOpacity: 1 })),
        );
    }
    return layerBands(elements, tabLayers).flatMap((band) => {
      const layerOpacity = layerOpacityOf(band.layer);
      return band.elements.filter(drawn).map((element) => ({ element, layerOpacity }));
    });
  }, [elements, tabLayers, layerPreviewId, inSheet]);
  // The palette arrives as a fresh array each render (themeChartPalette): keyed by its colours, so the views (and a
  // Sheet's charts) re-render only when the colours change.
  const paletteKey = chartPalette?.join('|') ?? '';
  // oxlint-disable-next-line react/exhaustive-deps
  const stablePalette = useMemo(() => chartPalette, [paletteKey]);
  const selfId = participantKey(selfParticipant);
  // What every boxed element view takes from this layer, the same for each element; a chart its Sheet draws takes
  // the same (sheet-chart-renderer), so it looks and acts as it would here.
  const boxedShared = useMemo<BoxedShared>(
    () => ({
      onPlainClick: h.handleElementClick,
      isPaintMode,
      tabLocked,
      tabSummaries,
      readOnly,
      onBeginDrag: h.onBeginDrag,
      onPressArmedAction: h.onPressArmedAction,
      onShiftSelect: h.onShiftSelect,
      vote: tabVote,
      selfId,
      voteMax,
      voteReviewActive: voteReview != null,
      onCastVote: h.onCastVote,
      onRetractVote: h.onRetractVote,
      onBeginEdit: h.onBeginEdit,
      onCommitLabel: h.onCommitLabel,
      onSetTextAlign: h.onSetTextAlign,
      onCommitTable: h.onCommitTable,
      onCommitHeaderSize: h.onCommitHeaderSize,
      onSnapSeam: h.onSnapSeam,
      onSetRailLabel: h.onSetRailLabel,
      onToggleChecklistItem: h.onToggleChecklistItem,
      onSetPageHeading: h.onSetPageHeading,
      onSetWebRows: h.onSetWebRows,
      onSetPointerTip: h.onSetPointerTip,
      onSetHeroCaptionLine: h.onSetHeroCaptionLine,
      chartPalette: stablePalette,
      onCancelEdit: h.onCancelEdit,
      onFollowLink: h.onFollowLink,
      onPressModeButton: h.onPressModeButton,
      onPressFocusButton: h.onPressFocusButton,
      onPressSessionButton: h.onPressSessionButton,
      sessionStartBlocked,
      sessionRunBy,
      timerState,
      tabTimer: tabTimer ?? null,
      onSetSessionConfig: h.onSetSessionConfig,
      onOpenElementSettings: h.onOpenElementSettings,
      commentSelfId,
      actionSelfId,
      timerControls,
      onToggleReveal: h.onToggleReveal,
      onRollPicker: h.onRollPicker,
      collab,
      chairSitters,
      // Mode Buttons light up for the mode they hand out, and the canvas-tool union is WIDER than the mode
      // vocabulary: Slide Deck (docs/specs/012-collaboration/presentation-mode.md) has no Mode Button, so it is not a
      // SelectionMode. Narrow rather than widen: a "Switch to Slide Deck" button is exactly what that spec rules out.
      activeMode: isSelectionMode(canvasTool) ? canvasTool : undefined,
      onEnterPortal: h.onEnterPortal,
      onFireReaction: h.onFireReaction,
      onReactionBurstDone: h.onReactionBurstDone,
      onOpenComments: h.onOpenComments,
      onOpenAction: h.onOpenAction,
      onOpenNote: h.onOpenNote,
      onEditLink: h.onEditLink,
      onOpenEditDialog: h.onOpenEditDialog,
      onDropIcon: h.onDropIcon,
      onLinkCell: h.onLinkCell,
      imageContext,
      onContextSelect: h.handleElementContextSelect,
    }),
    [
      h,
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
      timerControls,
      collab,
      chairSitters,
      canvasTool,
      imageContext,
    ],
  );
  const renderChart = useSheetChartRenderer(boxedShared, tabFontStack);
  const sheetCharts = useMemo<SheetChartsValue>(
    () => ({ elements, chartPalette: stablePalette, editable: true, renderChart }),
    [elements, stablePalette, renderChart],
  );
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
  });
  const shownOrder = useMemo(
    () => (previewStructure ? shownWithOverlay(ordered, previewStructure) : ordered),
    [ordered, previewStructure],
  );
  // The grips layer's portal hosts (docs/specs/008-canvas/canvas-and-palette.md "Resize"), set once
  // it mounts; every element view portals its grips into them.
  const [gripHosts, setGripHosts] = useState<SelectionGripHosts | null>(null);
  // The vote as a board's cards see it (CardVoteContext): their stepper reads it, keyed by card.
  const cardVote = useMemo<CardVote | null>(
    () =>
      tabVote
        ? {
            vote: tabVote,
            selfId,
            voteMax,
            layers: tabLayers,
            reviewActive: voteReview != null,
            focusKey: voteReview?.focusId ?? null,
            onCast: readOnly && !takePart ? undefined : onCastVote,
            onRetract: readOnly && !takePart ? undefined : onRetractVote,
          }
        : null,
    [
      tabVote,
      selfId,
      voteMax,
      tabLayers,
      voteReview,
      readOnly,
      takePart,
      onCastVote,
      onRetractVote,
    ],
  );
  return (
    <SheetChartsContext.Provider value={sheetCharts}>
      <CardVoteProvider value={cardVote}>
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
          {/* Illustrate mode cuts elements off at the page edges (IllustratePageClip); not in the
          isometric view, whose 3D stack a clip would flatten. */}
          <IllustratePageClip
            pages={
              props.illustratePages && props.canvasTool !== 'isometric'
                ? props.illustratePages.pages
                : null
            }
            // A page under a layout preview shows only the preview.
            hiddenPageId={props.illustratePages?.layoutPreview?.pageId ?? null}
            elements={elements}
            layers={tabLayers}
          >
            <CanvasElementList
              shownOrder={shownOrder}
              previewStore={previewStore}
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
          </IllustratePageClip>

          {/* Editor-only marks, left out of an animated GIF (GifOmit). */}
          <GifOmit>
            {/* The line or arrow being drawn (docs/specs/023-drawing-mode/drawing-mode.md "Shapes"): the
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

            {remoteCursors.map((c) => (
              <ZoomedRemoteCursor key={c.id} cursor={c} />
            ))}

            {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
            <ZoomedLaserOverlay trails={laserTrails} />

            {/* What a relayed changeset touched (docs/specs/024-agents/agent-changesets.md "In the editor"):
          above the elements, below the selection chrome. */}
            <ChangesetRevealOverlay elements={elements} tabId={props.activeTabId ?? ''} />
          </GifOmit>

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
                        readOnly ||
                        tabLocked ||
                        props.createBlocked === true ||
                        insertShift.animates,
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
                onAddRailPoint,
                onAddTableRow,
                onAddTableColumn,
                onAppendWebRow,
              }}
              onBeginDrag={onBeginDrag}
              pages={props.illustratePages?.pages}
            />
          </SelectionGripsLayer>
        </SelectionGripsContext.Provider>
      </CardVoteProvider>
    </SheetChartsContext.Provider>
  );
}
