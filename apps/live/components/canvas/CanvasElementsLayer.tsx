import { buildElementIndex, isBoxed, isRailShape } from '@livediagram/diagram';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { framesFirst, type QuickConnectDirection } from '@/lib/canvas';
import { resolveFontStack } from '@/lib/fonts';
import { ArrowDefs, ArrowView } from '@/components/canvas/ArrowView';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { LaserOverlay } from '@/components/canvas/LaserOverlay';
import { UnionResizeHandles } from '@/components/canvas/element-parts';
import { QuickConnectRing } from '@/components/canvas/QuickConnectRing';
import { RemoteCursor } from '@/components/canvas/RemoteCursor';
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
  memberIds: Set<string>;
  showHandles: (id: string) => boolean;
  showAnchorsFor: (id: string) => boolean;
  badgeColor: string;
  selectionBounds: Bounds | null;
  showPlus: boolean;
  showUnionResize: boolean;
  unionResizeBounds: Bounds | null;
  unionResizePrimaryId: string | null;
  isPaintMode: boolean;
  isGroupMode: boolean;
  handleArrowSelect: (id: string, e: ReactPointerEvent) => void;
  handleElementContextSelect: (id: string, sx: number, sy: number) => void;
  // Which quick-connect ring is open (lifted to Canvas so only one opens
  // at a time and the toolbar can dodge the top ring). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
};

type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

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
    handleArrowSelect,
    handleElementContextSelect,
    hasArrows,
    imageContext,
    isGroupMode,
    isPaintMode,
    laserTrails,
    memberIds,
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
    onSetPadding,
    onSetFont,
    onSetTextSize,
    onCommitTable,
    onAddRailPoint,
    onSetRailLabel,
    chartPalette,
    onSpawnConnect,
    onStartArrow,
    onStartPencil,
    onFollowLink,
    onOpenComments,
    onOpenNote,
    onEditLink,
    onDropIcon,
    onLinkCell,
    onShiftSelect,
    tabVote,
    selfParticipant,
    onCastVote,
    onRetractVote,
    readOnly,
    remoteCursors,
    remoteSelectionsByElement,
    selectedId,
    selectionBounds,
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
  // Resolved tab default font once; per-element falls back to it (spec/28).
  const tabFontStack = resolveFontStack(tabFont);
  // Highest dot count on the tab (spec/39), computed once so each element's
  // vote pill can flag itself a winner once results are revealed.
  const voteMax = tabVote
    ? Object.values(tabVote.votes).reduce((m, ids) => Math.max(m, ids.length), 0)
    : 0;
  // One id -> element index per render, shared by every ArrowView so
  // each resolves its endpoints / label collisions with O(1) lookups
  // instead of scanning the whole element list twice per arrow.
  const elementIndex = hasArrows ? buildElementIndex(elements) : null;
  // Frames are section backdrops: always render them FIRST (lowest in the
  // paint + DOM order) so their contents sit on top and stay clickable.
  // Otherwise a frame painted over its contents would swallow the clicks
  // meant for the elements inside it (spec/09). Same rule the exporters
  // use, via the shared `framesFirst` helper.
  const ordered = framesFirst(elements);
  // Whether the single selected element is a timeline rail — gates the rail's
  // "Add point" action on the quick-connect "+" (spec/51).
  const selectedElement = selectedId ? elements.find((e) => e.id === selectedId) : undefined;
  const selectedIsRail = selectedElement?.type === 'shape' && isRailShape(selectedElement.shape);
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
      {ordered.map((element) => {
        if (element.type === 'arrow') {
          return (
            <svg
              key={element.id}
              className="absolute inset-0 h-full w-full"
              style={{ pointerEvents: 'none', overflow: 'visible' }}
            >
              <ArrowView
                arrow={element}
                elementIndex={elementIndex!}
                isSelected={element.id === selectedId || multiSelectedIds.has(element.id)}
                isPaintMode={isPaintMode || isGroupMode}
                isEditing={element.id === editingId}
                editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
                tabLocked={tabLocked}
                readOnly={readOnly}
                onSelect={handleArrowSelect}
                onContextSelect={handleElementContextSelect}
                onBeginEndpointDrag={onBeginEndpointDrag}
                onBeginEdit={onBeginEdit}
                onCommitLabel={onCommitLabel}
                onCancelEdit={onCancelEdit}
                onBeginTranslate={onBeginArrowTranslate}
                onBeginCurveDrag={onBeginArrowCurveDrag}
                onBeginCurvePointDrag={onBeginArrowCurvePointDrag}
                onAddCurvePoint={onAddCurvePoint}
                onDeleteCurvePoint={onDeleteCurvePoint}
                onBeginElbowDrag={onBeginArrowElbowDrag}
                onBeginLabelDrag={onBeginArrowLabelDrag}
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
            isSelected={memberIds.has(element.id) || multiSelectedIds.has(element.id)}
            isMultiSelected={multiSelectedIds.has(element.id)}
            multiSelectActive={multiSelectedIds.size > 0}
            remoteSelectors={remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS}
            isEditing={element.id === editingId}
            editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
            isPaintMode={isPaintMode || isGroupMode}
            showHandles={showHandles(element.id)}
            showAnchors={showAnchorsFor(element.id)}
            zoom={viewportZoom}
            badgeColor={badgeColor}
            tabLocked={tabLocked}
            tabSummaries={tabSummaries}
            readOnly={readOnly}
            onBeginDrag={onBeginDrag}
            onShiftSelect={onShiftSelect}
            vote={tabVote}
            selfId={selfParticipant.id}
            voteMax={voteMax}
            onCastVote={readOnly ? undefined : onCastVote}
            onRetractVote={readOnly ? undefined : onRetractVote}
            onBeginEdit={onBeginEdit}
            onCommitLabel={onCommitLabel}
            onSetTextAlign={readOnly ? undefined : onSetTextAlign}
            onSetPadding={readOnly ? undefined : onSetPadding}
            onSetFont={readOnly ? undefined : onSetFont}
            onSetTextSize={readOnly ? undefined : onSetTextSize}
            onCommitTable={onCommitTable}
            onSetRailLabel={onSetRailLabel}
            chartPalette={chartPalette}
            onCancelEdit={onCancelEdit}
            onFollowLink={onFollowLink}
            onOpenComments={onOpenComments}
            onOpenNote={onOpenNote}
            onEditLink={onEditLink}
            onDropIcon={onDropIcon}
            onLinkCell={onLinkCell}
            imageContext={imageContext}
            onContextSelect={handleElementContextSelect}
            fontFamily={resolveFontStack(element.font) ?? tabFontStack}
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
            />
          ))
        : null}
    </>
  );
}
