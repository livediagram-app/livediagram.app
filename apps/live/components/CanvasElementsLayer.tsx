import { buildElementIndex, isBoxed } from '@livediagram/diagram';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { resolveFontStack } from '@/lib/fonts';
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { LaserOverlay } from './LaserOverlay';
import { UnionResizeHandles } from './element-parts';
import { PlusButton } from './PlusButton';
import { RemoteCursor } from './RemoteCursor';
import type { CanvasProps } from './Canvas.types';

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
};

export type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

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
    onBeginAnchorDrag,
    onBeginArrowCurveDrag,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginArrowTranslate,
    onBeginDrag,
    onBeginEdit,
    onBeginEndpointDrag,
    onBeginRotate,
    onCancelEdit,
    onCommitLabel,
    onCommitTable,
    onDuplicateConnect,
    onFollowLink,
    onOpenComments,
    onOpenNote,
    onDropIcon,
    onLinkCell,
    onShiftSelect,
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
  } = props;
  // Resolved tab default font once; per-element falls back to it (spec/28).
  const tabFontStack = resolveFontStack(tabFont);
  // One id -> element index per render, shared by every ArrowView so
  // each resolves its endpoints / label collisions with O(1) lookups
  // instead of scanning the whole element list twice per arrow.
  const elementIndex = hasArrows ? buildElementIndex(elements) : null;
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
      {elements.map((element) => {
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
                onBeginEndpointDrag={onBeginEndpointDrag}
                onBeginEdit={onBeginEdit}
                onCommitLabel={onCommitLabel}
                onCancelEdit={onCancelEdit}
                onBeginTranslate={onBeginArrowTranslate}
                onBeginCurveDrag={onBeginArrowCurveDrag}
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
            onBeginRotate={onBeginRotate}
            onShiftSelect={onShiftSelect}
            onBeginAnchorDrag={onBeginAnchorDrag}
            onBeginEdit={onBeginEdit}
            onCommitLabel={onCommitLabel}
            onCommitTable={onCommitTable}
            onCancelEdit={onCancelEdit}
            onFollowLink={onFollowLink}
            onOpenComments={onOpenComments}
            onOpenNote={onOpenNote}
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

      {showUnionResize && unionResizeBounds && unionResizePrimaryId ? (
        <UnionResizeHandles
          bounds={unionResizeBounds}
          primaryId={unionResizePrimaryId}
          zoom={viewportZoom}
          onBeginDrag={onBeginDrag}
        />
      ) : null}

      {showPlus && selectionBounds ? (
        <>
          <PlusButton
            x={selectionBounds.x + selectionBounds.width}
            y={selectionBounds.y + selectionBounds.height / 2}
            placement="right"
            zoom={viewportZoom}
            onClick={() => onDuplicateConnect('right')}
          />
          <PlusButton
            x={selectionBounds.x + selectionBounds.width / 2}
            y={selectionBounds.y + selectionBounds.height}
            placement="below"
            zoom={viewportZoom}
            onClick={() => onDuplicateConnect('below')}
          />
          <PlusButton
            x={selectionBounds.x}
            y={selectionBounds.y + selectionBounds.height / 2}
            placement="left"
            zoom={viewportZoom}
            onClick={() => onDuplicateConnect('left')}
          />
          <PlusButton
            x={selectionBounds.x + selectionBounds.width / 2}
            y={selectionBounds.y}
            placement="above"
            zoom={viewportZoom}
            onClick={() => onDuplicateConnect('above')}
          />
        </>
      ) : null}
    </>
  );
}
