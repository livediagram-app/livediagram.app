import { Fragment, useMemo, useState } from 'react';
import { participantKey } from '@/lib/identity';
import { useStableHandlers } from '@/hooks/ui/useStableHandlers';
import { useFontsReady } from './useFontsReady';
import {
  eventStormingNoteFont,
  resolveFontStack,
  isSelectionMode,
  alignmentCoordinates,
  buildElementIndex,
  isBoxed,
  isVotableInVote,
  layerBands,
  laneSeamCoordinates,
  layerOpacityOf,
  snapSeamCoordinate,
  arrowRoutePoints,
  type ElementIndex,
} from '@livediagram/document';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { type QuickConnectDirection } from '@/lib/canvas';
import { ArrowDefs } from '@/components/canvas/arrow-defs';
import { ArrowView } from '@/components/canvas/ArrowView';
import type { ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
import { FreeArrowSelection } from '@/components/canvas/FreeArrowSelection';
import { DrawnArrowPreview } from '@/components/canvas/DrawnArrowPreview';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { LaserOverlay } from '@/components/canvas/LaserOverlay';
import { UnionResizeHandles } from '@/components/canvas/element-parts';
import { QuickConnectPluses } from '@/components/canvas/QuickConnectPluses';
import {
  BoxGripsPortal,
  SelectionGripsContext,
  SelectionGripsLayer,
  type SelectionGripHosts,
} from '@/components/canvas/SelectionGripsLayer';
import { NextNoteButtons } from '@/components/canvas/NextNoteButtons';
import { usePhotoDraftView } from '@/lib/photo-draft-preview';
import { RemoteCursor } from '@/components/canvas/RemoteCursor';
import { useInsertShift } from '@/hooks/canvas/useInsertShift';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

type Bounds = { x: number; y: number; width: number; height: number };

// Stable empty-array constant for the `remoteSelectors` prop on the
// (very common) "no remote participants have this element selected"
// path, so BoxedElementView's memo isn't invalidated by a fresh [] per
// render.
// What a drawn arrow resolves its ends against on a board with no arrows yet.
const EMPTY_ELEMENT_INDEX: ElementIndex = new Map();

const EMPTY_REMOTE_SELECTORS: { id: string; name: string; color: string }[] = [];

// Canvas-computed values threaded into the element layer alongside the
// raw props.
type ElementsExtras = {
  // The draw gesture in flight (canvas coords), for the line or arrow it would land.
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  hasArrows: boolean;
  // Every arrow label laid out once per element change (Canvas owns the pass).
  arrowLabels: ArrowLabels;
  showHandles: (id: string) => boolean;
  showAnchorsFor: (id: string) => boolean;
  badgeColor: string;
  selectionBounds: Bounds | null;
  showPlus: boolean;
  showUnionResize: boolean;
  unionResizeBounds: Bounds | null;
  unionResizePrimaryId: string | null;
  isPaintMode: boolean;
  handleArrowSelect: (id: string, e: ReactPointerEvent, paired?: boolean) => void;
  handleElementClick: (id: string) => void;
  handleElementContextSelect: (id: string, sx: number, sy: number) => void;
  // Which quick-connect ring is open (lifted to Canvas so only one opens
  // at a time and the toolbar can dodge the top ring). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
};

type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

// The element-rendering layer of the canvas: the shared arrow defs, every
// element (arrows + boxed views interleaved in z-order), remote cursors,
// the laser overlay, and the grips layer on top of them all: the union resize
// handles, the quick-connect plus buttons, and every element's own grips,
// portalled in (SelectionGripsLayer). Rendered inside Canvas's
// viewport-transformed wrapper.
export function CanvasElementsLayer(props: CanvasElementsLayerProps) {
  const {
    badgeColor,
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
    multiSelectedIds,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginArrowTranslate,
    onBeginDrag,
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
    onEditCode,
    onDropIcon,
    onLinkCell,
    onShiftSelect,
    tabVote,
    selfParticipant,
    onCastVote,
    onRetractVote,
    readOnly,
    canvasTool,
    onEnterPortal,
    onFireReaction,
    reactionBursts,
    onReactionBurstDone,
    remoteCursors,
    remoteSelectionsByElement,
    selectedId,
    selectionBounds,
    shiftDupGhostIds,
    voteReview,
    showAnchorsFor,
    showHandles,
    showPlus,
    showUnionResize,
    tabFont,
    tabLocked,
    tabSummaries,
    unionResizeBounds,
    unionResizePrimaryId,
    viewportZoom,
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
    onShiftSelect,
    onCastVote: readOnly ? undefined : onCastVote,
    onRetractVote: readOnly ? undefined : onRetractVote,
    onSetTextAlign: readOnly ? undefined : onSetTextAlign,
    onCommitTable,
    onCommitHeaderSize: readOnly ? undefined : onCommitHeaderSize,
    // The seam's snap targets (docs/specs/009-elements/lane.md). Resolved here because this is where
    // the sibling elements are: BoxedElementView only ever sees its own.
    onSnapSeam: readOnly
      ? undefined
      : (candidate: number, axis: 'x' | 'y', excludeId: string, edgeOf, sizeOf) =>
          snapSeamCoordinate(candidate, {
            seams: laneSeamCoordinates(elements, axis, excludeId, edgeOf, sizeOf),
            alignment: alignmentCoordinates(elements, axis, excludeId),
          }).value,
    onSetRailLabel,
    onToggleChecklistItem: readOnly ? undefined : onToggleChecklistItem,
    onSetPageHeading,
    onSetWebRows: readOnly ? undefined : onSetWebRows,
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
    onEditCode,
    onDropIcon,
    onLinkCell,
  });
  // Auto-fit measures the face it paints, and webfonts land after first
  // paint — re-render this layer once they are in so every fitted label
  // re-measures in its real face (see useFontsReady).
  useFontsReady();
  // Resolved tab default font once; per-element falls back to it (docs/specs/004-interface-design/fonts.md).
  const tabFontStack = resolveFontStack(tabFont);
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
  // The elements actually drawn, for the arrows' pass-behind breaks: a box on
  // a hidden layer must not cut a gap in a line (docs/specs/008-canvas/arrow-route-behind.md).
  const drawnElements = useMemo(() => ordered.map((o) => o.element), [ordered]);
  // The grips layer's portal hosts (docs/specs/008-canvas/canvas-and-palette.md "Resize"), set once
  // it mounts; every element view portals its grips into them.
  const [gripHosts, setGripHosts] = useState<SelectionGripHosts | null>(null);
  return (
    <SelectionGripsContext.Provider value={gripHosts}>
      {/* Shared arrowhead defs. Multiple per-arrow <svg>s below
            all reference url(#arrowhead) — defs are document-scoped
            in SVG so a single defs node lets every arrow render
            with the same marker. */}
      {hasArrows ? (
        <svg className="absolute" style={{ width: 0, height: 0, overflow: 'visible' }} aria-hidden>
          <ArrowDefs />
        </svg>
      ) : null}

      {/* Render elements in their natural array order so
            `bringToFront` / `sendToBack` reorder arrows relative to
            boxed elements (instead of all arrows perpetually stacking
            above all boxes inside a single SVG layer). Each arrow
            gets its own <svg> overlay; pointer events on the SVG are
            disabled in CSS, only the inner arrow line picks them up. */}
      {ordered.map(({ element, layerOpacity }, isoDepth) => {
        // Shift-duplicate ghost (docs/specs/008-canvas/shift-drag-duplicate.md): the dragged set renders
        // translucent while its materialised copy holds the start
        // position, multiplied over any per-layer opacity.
        const ghostFactor = shiftDupGhostIds?.has(element.id) ? 0.45 : 1;
        // Photo draft (docs/specs/021-event-storming/event-storming.md Phase 8): while one is open, everything that
        // is NOT part of it recedes, so the notes the photo brought are the
        // most visible thing on the board. A render-time style, local to the
        // importing session — the board itself is untouched.
        const isDraftNote = element.type === 'sticky' && element.esDraft === true;
        const draftFade = draftView && !isDraftNote ? 0.5 : 1;
        const effOpacity = ghostFactor * layerOpacity * draftFade;
        if (element.type === 'arrow') {
          // A selected free arrow wears a box's selection: ring + scale handles
          // (docs/specs/008-canvas/arrow-bending.md). HTML, beside its <svg>, so it is the same chrome.
          const framed =
            element.id === selectedId &&
            multiSelectedIds.size === 0 &&
            element.from.kind === 'free' &&
            element.to.kind === 'free' &&
            element.locked !== true &&
            element.id !== editingId &&
            !readOnly &&
            !tabLocked &&
            !isPaintMode;
          return (
            <Fragment key={element.id}>
              <svg
                className="absolute inset-0 h-full w-full"
                // Tagged so isometric mode can lift arrows just off the base
                // plane (globals.css [data-iso] rule): an arrow's surface is
                // coplanar with the boxes it crosses under preserve-3d, and
                // coplanar layers z-fight — which is what made a FLOWING arrow
                // shimmer in isometric while a static one looked fine (the
                // animation repaints every frame, so the fight is visible
                // continuously rather than only while the camera orbits).
                data-arrow-svg=""
                // An arrow travels whole or not at all in the preview (see
                // insert-between.ts): one that straddles the insertion point
                // stretches, which a transform cannot express, so it waits for
                // the drop.
                data-insert-shift={insertShift.animates ? '' : undefined}
                style={{
                  pointerEvents: 'none',
                  overflow: 'visible',
                  ...(effOpacity < 1 ? { opacity: effOpacity } : {}),
                  ...(insertShift.xFor(element.id)
                    ? { transform: `translateX(${insertShift.xFor(element.id)}px)` }
                    : {}),
                }}
              >
                <ArrowView
                  arrow={element}
                  elementIndex={elementIndex!}
                  occluders={drawnElements}
                  labelRender={arrowLabels.renderOf(element.id)}
                  draftLayout={arrowLabels.draftLayout}
                  isSelected={element.id === selectedId || multiSelectedIds.has(element.id)}
                  isPaintMode={isPaintMode}
                  isEditing={element.id === editingId}
                  editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
                  tabLocked={tabLocked}
                  readOnly={readOnly}
                  onSelect={h.handleArrowSelect}
                  onContextSelect={h.handleElementContextSelect}
                  onBeginEndpointDrag={h.onBeginEndpointDrag}
                  onBeginEdit={h.onBeginEdit}
                  onCommitLabel={h.onCommitLabel}
                  onCancelEdit={h.onCancelEdit}
                  onBeginCurveDrag={h.onBeginArrowCurveDrag}
                  onBeginCurvePointDrag={h.onBeginArrowCurvePointDrag}
                  onBeginArrowBend={h.onBeginArrowBend}
                  onDeleteCurvePoint={h.onDeleteCurvePoint}
                  onBeginElbowDrag={h.onBeginArrowElbowDrag}
                  onBeginLabelDrag={h.onBeginArrowLabelDrag}
                  fontFamily={resolveFontStack(element.font) ?? tabFontStack}
                />
              </svg>
              {framed ? (
                <BoxGripsPortal>
                  <FreeArrowSelection
                    arrowId={element.id}
                    points={arrowRoutePoints(element, elements)}
                    zoom={viewportZoom}
                    onBeginMove={(e) => h.onBeginArrowTranslate(element.id, e)}
                    onBeginScale={(handle, e) => h.onBeginArrowScale(element.id, handle, e)}
                  />
                </BoxGripsPortal>
              ) : null}
            </Fragment>
          );
        }
        if (!isBoxed(element)) return null;
        return (
          <BoxedElementView
            key={element.id}
            element={element}
            // Paint index, used only by isometric mode to stagger each element
            // onto its own z-plane (globals.css --iso-z): coplanar layers
            // z-fight under preserve-3d, which is the flicker.
            isoDepth={isoDepth}
            insertShiftX={insertShift.xFor(element.id)}
            insertShiftAnimates={insertShift.animates}
            // Resolved once here, where both the vote and the tab's layers
            // are in scope, rather than threading `layers` down to the
            // gesture hook and the overlay separately (docs/specs/012-collaboration/vote-layer-scope.md).
            votableInVote={isVotableInVote(element, tabVote, tabLayers)}
            layerOpacity={effOpacity < 1 ? effOpacity : undefined}
            // The draft treatment, and the "already here" badge on a note the
            // photo matched (with what it read, when that differed).
            photoDraft={isDraftNote}
            photoMatched={draftView?.matchedIds.has(element.id) === true}
            photoReadAs={draftView?.differences.get(element.id)}
            isSelected={element.id === selectedId || multiSelectedIds.has(element.id)}
            isMultiSelected={multiSelectedIds.has(element.id)}
            onPlainClick={h.handleElementClick}
            remoteSelectors={remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS}
            isEditing={element.id === editingId}
            editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
            isPaintMode={isPaintMode}
            showHandles={showHandles(element.id)}
            showAnchors={showAnchorsFor(element.id)}
            zoom={viewportZoom}
            badgeColor={badgeColor}
            tabLocked={tabLocked}
            tabSummaries={tabSummaries}
            readOnly={readOnly}
            onBeginDrag={h.onBeginDrag}
            onShiftSelect={h.onShiftSelect}
            vote={tabVote}
            selfId={participantKey(selfParticipant)}
            voteMax={voteMax}
            voteReviewActive={voteReview != null}
            isVoteFocus={voteReview?.focusId === element.id}
            onCastVote={h.onCastVote}
            onRetractVote={h.onRetractVote}
            onBeginEdit={h.onBeginEdit}
            onCommitLabel={h.onCommitLabel}
            onSetTextAlign={h.onSetTextAlign}
            onCommitTable={h.onCommitTable}
            onCommitHeaderSize={h.onCommitHeaderSize}
            onSnapSeam={h.onSnapSeam}
            onSetRailLabel={h.onSetRailLabel}
            onToggleChecklistItem={h.onToggleChecklistItem}
            onSetPageHeading={h.onSetPageHeading}
            onSetWebRows={h.onSetWebRows}
            onSetHeroCaptionLine={h.onSetHeroCaptionLine}
            chartPalette={chartPalette}
            onCancelEdit={h.onCancelEdit}
            onFollowLink={h.onFollowLink}
            onPressModeButton={h.onPressModeButton}
            onPressFocusButton={h.onPressFocusButton}
            onPressSessionButton={h.onPressSessionButton}
            sessionStartBlocked={sessionStartBlocked}
            timerState={timerState}
            tabTimer={tabTimer ?? null}
            onSetSessionConfig={onSetSessionConfig}
            onOpenElementSettings={onOpenElementSettings}
            commentSelfId={commentSelfId}
            commentActions={
              commentPanelActions
                ? {
                    add: (text, mentions) => commentPanelActions.add(element.id, text, mentions),
                    remove: (id) => commentPanelActions.remove(element.id, id),
                    resolve: () => commentPanelActions.resolve(element.id),
                    unresolve: () => commentPanelActions.unresolve(element.id),
                  }
                : undefined
            }
            actionSelfId={actionSelfId}
            actionActions={
              actionPanelActions
                ? {
                    add: () => actionPanelActions.configure(element.id, null),
                    edit: (id) => actionPanelActions.configure(element.id, id),
                    complete: (id) => actionPanelActions.complete(element.id, id),
                    reopen: (id) => actionPanelActions.reopen(element.id, id),
                  }
                : undefined
            }
            timerControls={{
              pause: onPauseTimer,
              resume: onResumeTimer,
              reset: onResetTimer,
              clear: onClearTimer,
              setDuration: onSetTimerDuration,
            }}
            revealedForMe={revealedIds?.has(element.id)}
            onToggleReveal={h.onToggleReveal}
            onRollPicker={h.onRollPicker}
            collab={collab}
            chairSitters={chairSitters}
            // Mode Buttons light up for the mode they hand out, and the
            // canvas-tool union is WIDER than the mode vocabulary: Slide Deck
            // (docs/specs/012-collaboration/presentation-mode.md) has no Mode Button, so it is not a SelectionMode.
            // Narrow rather than widen — a "Switch to Slide Deck" button is
            // exactly what docs/specs/012-collaboration/presentation-mode.md rules out.
            activeMode={isSelectionMode(canvasTool) ? canvasTool : undefined}
            onEnterPortal={onEnterPortal}
            onFireReaction={onFireReaction}
            reactionBurst={reactionBursts?.get(element.id)}
            onReactionBurstDone={onReactionBurstDone}
            onOpenComments={h.onOpenComments}
            onOpenAction={h.onOpenAction}
            onOpenNote={h.onOpenNote}
            onEditLink={h.onEditLink}
            onEditCode={h.onEditCode}
            onDropIcon={h.onDropIcon}
            onLinkCell={h.onLinkCell}
            imageContext={imageContext}
            onContextSelect={h.handleElementContextSelect}
            // A workshop note writes in marker (docs/specs/021-event-storming/event-storming.md): the notation names
            // the face, so it outranks the tab default — but not an explicit
            // per-element font, which is a deliberate author choice.
            fontFamily={
              resolveFontStack(element.font ?? eventStormingNoteFont(element)) ?? tabFontStack
            }
          />
        );
      })}

      {/* The line or arrow being drawn (docs/specs/023-whiteboard/whiteboard.md "Shapes"): the
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

      {remoteCursors.map((c) => (
        <RemoteCursor key={c.id} cursor={c} zoom={viewportZoom} />
      ))}

      {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
      <LaserOverlay trails={laserTrails} zoom={viewportZoom} />

      {/* The grips layer (docs/specs/008-canvas/canvas-and-palette.md "Resize"): above every element, so
          no grip is ever covered. The canvas's own grips go in here; each element's are portalled in. */}
      <SelectionGripsLayer onHosts={setGripHosts} isoDepth={ordered.length}>
        {/* The next-note buttons on the note you are pointing at or have
            selected (docs/specs/021-event-storming/event-storming.md Phase 7). They stand down while any drag is in
            hand: the board is the drag's for the duration. */}
        {props.esBoard && props.onAddNextNote ? (
          <NextNoteButtons
            elements={elements}
            selectedId={selectedId}
            editingId={editingId}
            blocked={readOnly || tabLocked || props.createBlocked === true || insertShift.animates}
            zoom={viewportZoom}
            onAdd={props.onAddNextNote}
          />
        ) : null}

        {showPlus && selectionBounds ? (
          <QuickConnectPluses
            selectedElement={selectedId ? elements.find((e) => e.id === selectedId) : undefined}
            bounds={selectionBounds}
            zoom={viewportZoom}
            quickRingOpen={quickRingOpen}
            setQuickRingOpen={setQuickRingOpen}
            openOnHover={settings.quickAddOnHover === true}
            onSpawnConnect={onSpawnConnect}
            onStartArrow={onStartArrow}
            onStartPencil={onStartPencil}
            onAddRailPoint={onAddRailPoint}
            onAddTableRow={onAddTableRow}
            onAddTableColumn={onAddTableColumn}
            onAppendWebRow={onAppendWebRow}
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
            zoom={viewportZoom}
            onBeginDrag={onBeginDrag}
          />
        ) : null}
      </SelectionGripsLayer>
    </SelectionGripsContext.Provider>
  );
}
