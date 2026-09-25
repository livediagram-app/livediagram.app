import { useMemo } from 'react';
import { useStableHandlers } from '@/hooks/ui/useStableHandlers';
import { useMindGrow } from '@/components/canvas/MindGrowContext';
import { useFontsReady } from './useFontsReady';
import {
  eventStormingNoteFont,
  resolveFontStack,
  isSelectionMode,
  alignmentCoordinates,
  buildElementIndex,
  isBoxed,
  isRailShape,
  canAppendWebRow,
  isVotableInVote,
  layerBands,
  laneSeamCoordinates,
  layerOpacityOf,
  snapSeamCoordinate,
} from '@livediagram/diagram';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { type QuickConnectDirection } from '@/lib/canvas';
import { ArrowDefs } from '@/components/canvas/arrow-defs';
import { ArrowView } from '@/components/canvas/ArrowView';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { LaserOverlay } from '@/components/canvas/LaserOverlay';
import { UnionResizeHandles } from '@/components/canvas/element-parts';
import { QuickConnectRing } from '@/components/canvas/QuickConnectRing';
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
const EMPTY_REMOTE_SELECTORS: { id: string; name: string; color: string }[] = [];

// Canvas-computed values threaded into the element layer alongside the
// raw props.
type ElementsExtras = {
  hasArrows: boolean;
  showHandles: (id: string) => boolean;
  showAnchorsFor: (id: string) => boolean;
  badgeColor: string;
  selectionBounds: Bounds | null;
  showPlus: boolean;
  showUnionResize: boolean;
  unionResizeBounds: Bounds | null;
  unionResizePrimaryId: string | null;
  isPaintMode: boolean;
  handleArrowSelect: (id: string, e: ReactPointerEvent) => void;
  handleElementContextSelect: (id: string, sx: number, sy: number) => void;
  // Which quick-connect ring is open (lifted to Canvas so only one opens
  // at a time and the toolbar can dodge the top ring). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
};

type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

// The ring action each row-carrying web component offers (spec/147).
const WEB_ROW_ACTION: Partial<Record<string, { label: string; description: string }>> = {
  'stat-row': { label: 'Add stat', description: 'Add another KPI card to the row.' },
  process: { label: 'Add step', description: 'Add another step to the end of the process.' },
  'site-header': { label: 'Add link', description: 'Add another link to the header.' },
};

// The element-rendering layer of the canvas: the shared arrow defs, every
// element (arrows + boxed views interleaved in z-order), remote cursors,
// the laser overlay, the union resize handles, and the duplicate-connect
// plus buttons. Rendered inside Canvas's viewport-transformed wrapper.
// Extracted from Canvas.tsx verbatim.
export function CanvasElementsLayer(props: CanvasElementsLayerProps) {
  const {
    badgeColor,
    editCursorAtEnd,
    editingId,
    elements,
    tabLayers,
    layerPreviewId,
    handleArrowSelect,
    handleElementContextSelect,
    hasArrows,
    imageContext,
    isPaintMode,
    laserTrails,
    multiSelectedIds,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onAddCurvePoint,
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
    // session element can BE the timer (spec/105) rather than a button that
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
    handleElementContextSelect,
    onBeginEndpointDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginArrowTranslate,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onAddCurvePoint,
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
    // The seam's snap targets (spec/119). Resolved here because this is where
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
  // Resolved tab default font once; per-element falls back to it (spec/28).
  const tabFontStack = resolveFontStack(tabFont);
  // Highest dot count on the tab (spec/39), computed once so each element's
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
  // Insert-between preview (spec/139): while a palette drag hovers a gap on an
  // event-storming board, the elements at and after the insertion point RENDER
  // shifted right to show the slot opening — see useInsertShift.
  const insertShift = useInsertShift();
  // Session-local view state for an open photo draft (spec/139 Phase 8).
  const draftView = usePhotoDraftView();
  // Paint order (spec/74 + spec/09): layer bands bottom -> top, keeping
  // array order within each band with frames hoisted to the front of
  // THEIR band (a frame is a section backdrop that must sit behind its
  // contents so they stay clickable). Hidden layers' elements drop out
  // here entirely — no DOM, so no hit-testing either. Same banding the
  // exporters use. Each element carries its band's opacity so per-layer
  // opacity multiplies over the element's own. While a Layers-panel row
  // is hovered (`layerPreviewId`, spec/74 hover-solo) ONLY that band
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
  // Whether the single selected element is a timeline rail — gates the rail's
  // "Add point" action on the quick-connect "+" (spec/51).
  const selectedElement = selectedId ? elements.find((e) => e.id === selectedId) : undefined;
  const selectedIsRail = selectedElement?.type === 'shape' && isRailShape(selectedElement.shape);
  const selectedIsTable = selectedElement?.type === 'table';
  // Web components (spec/147): the ring's "Add stat / step / link", while
  // there is room for one more.
  const webRow =
    selectedElement?.type === 'shape' && onAppendWebRow && canAppendWebRow(selectedElement)
      ? {
          ...WEB_ROW_ACTION[selectedElement.shape]!,
          onAdd: () => onAppendWebRow(selectedElement.id),
        }
      : undefined;
  const selectedIsMind = selectedElement?.type === 'shape' && selectedElement.shape === 'mind-node';
  const growMind = useMindGrow();
  return (
    <>
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
        // Shift-duplicate ghost (spec/80): the dragged set renders
        // translucent while its materialised copy holds the start
        // position, multiplied over any per-layer opacity.
        const ghostFactor = shiftDupGhostIds?.has(element.id) ? 0.45 : 1;
        // Photo draft (spec/139 Phase 8): while one is open, everything that
        // is NOT part of it recedes, so the notes the photo brought are the
        // most visible thing on the board. A render-time style, local to the
        // importing session — the board itself is untouched.
        const isDraftNote = element.type === 'sticky' && element.esDraft === true;
        const draftFade = draftView && !isDraftNote ? 0.5 : 1;
        const effOpacity = ghostFactor * layerOpacity * draftFade;
        if (element.type === 'arrow') {
          return (
            <svg
              key={element.id}
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
                onBeginTranslate={h.onBeginArrowTranslate}
                onBeginCurveDrag={h.onBeginArrowCurveDrag}
                onBeginCurvePointDrag={h.onBeginArrowCurvePointDrag}
                onAddCurvePoint={h.onAddCurvePoint}
                onDeleteCurvePoint={h.onDeleteCurvePoint}
                onBeginElbowDrag={h.onBeginArrowElbowDrag}
                onBeginLabelDrag={h.onBeginArrowLabelDrag}
                fontFamily={tabFontStack}
              />
            </svg>
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
            // gesture hook and the overlay separately (spec/96).
            votableInVote={isVotableInVote(element, tabVote, tabLayers)}
            layerOpacity={effOpacity < 1 ? effOpacity : undefined}
            // The draft treatment, and the "already here" badge on a note the
            // photo matched (with what it read, when that differed).
            photoDraft={isDraftNote}
            photoMatched={draftView?.matchedIds.has(element.id) === true}
            photoReadAs={draftView?.differences.get(element.id)}
            isSelected={element.id === selectedId || multiSelectedIds.has(element.id)}
            isMultiSelected={multiSelectedIds.has(element.id)}
            multiSelectActive={multiSelectedIds.size > 0}
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
            selfId={selfParticipant.id}
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
                    add: (text) => commentPanelActions.add(element.id, text),
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
                    configure: () => actionPanelActions.configure(element.id),
                    complete: () => actionPanelActions.complete(element.id),
                    reopen: () => actionPanelActions.reopen(element.id),
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
            // (spec/31) has no Mode Button, so it is not a SelectionMode.
            // Narrow rather than widen — a "Switch to Slide Deck" button is
            // exactly what spec/31 rules out.
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
            // A workshop note writes in marker (spec/139): the notation names
            // the face, so it outranks the tab default — but not an explicit
            // per-element font, which is a deliberate author choice.
            fontFamily={
              resolveFontStack(element.font ?? eventStormingNoteFont(element)) ?? tabFontStack
            }
          />
        );
      })}

      {remoteCursors.map((c) => (
        <RemoteCursor key={c.id} cursor={c} zoom={viewportZoom} />
      ))}

      {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
      <LaserOverlay trails={laserTrails} zoom={viewportZoom} />

      {/* Dotted border around the whole multi-selection / group, so it reads
          as one unit. Outset a touch from the union bounds; sits in the world
          transform so it pans + zooms with the elements. */}
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

      {/* The next-note buttons on the note you are pointing at or have
          selected (spec/139 Phase 7). They stand down while any drag is in
          hand: the board is the drag's for the duration. */}
      {props.esBoard && props.onAddNextNote ? (
        <NextNoteButtons
          elements={elements}
          selectedId={selectedId}
          blocked={readOnly || tabLocked || props.createBlocked === true || insertShift.animates}
          zoom={viewportZoom}
          onAdd={props.onAddNextNote}
        />
      ) : null}

      {showPlus && selectionBounds
        ? (
            [
              {
                placement: 'right' as const,
                x: selectionBounds.x + selectionBounds.width,
                y: selectionBounds.y + selectionBounds.height / 2,
              },
              {
                placement: 'below' as const,
                x: selectionBounds.x + selectionBounds.width / 2,
                y: selectionBounds.y + selectionBounds.height,
              },
              {
                placement: 'left' as const,
                x: selectionBounds.x,
                y: selectionBounds.y + selectionBounds.height / 2,
              },
              {
                placement: 'above' as const,
                x: selectionBounds.x + selectionBounds.width / 2,
                y: selectionBounds.y,
              },
            ] as const
          ).map(({ placement, x, y }) => (
            <QuickConnectRing
              key={placement}
              x={x}
              y={y}
              placement={placement}
              zoom={viewportZoom}
              open={quickRingOpen === placement}
              openOnHover={settings.quickAddOnHover === true}
              onToggle={() => setQuickRingOpen(quickRingOpen === placement ? null : placement)}
              onOpen={() => setQuickRingOpen(placement)}
              onClose={() => setQuickRingOpen(null)}
              onSpawn={(kind) => onSpawnConnect(placement, kind)}
              onArrowPointerDown={(e) => onStartArrow(placement, e)}
              onPencil={onStartPencil}
              // Timeline rail (spec/51): the standard "+" gains an "Add point"
              // action instead of the rail drawing its own competing button.
              onAddRailPoint={selectedIsRail ? onAddRailPoint : undefined}
              webRow={webRow}
              // Table ring (spec/09): Arrow + this side's structural add.
              variant={selectedIsTable ? 'table' : 'default'}
              onAddTableRow={selectedIsTable && placement === 'below' ? onAddTableRow : undefined}
              onAddTableColumn={
                selectedIsTable && placement === 'right' ? onAddTableColumn : undefined
              }
              // Mind map (spec/118): Add child / Add sibling, each naming its
              // shortcut in the tooltip. Only on a mind node, and only where
              // there is a grower (not the share view, embed, or exports).
              onGrowMind={
                selectedIsMind && growMind
                  ? (relation) => growMind(selectedElement.id, relation)
                  : undefined
              }
            />
          ))
        : null}
    </>
  );
}
