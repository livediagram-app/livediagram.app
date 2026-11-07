import { Fragment, memo, type ComponentProps } from 'react';
import { arrowLabelFontStack, exportFontFamily, isBoxed, type Element } from '@livehuddle/document';
import type { ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
import type {
  LayerDrawn,
  LayerPreviewStore,
  PreviewEntry,
} from '@/hooks/canvas/useLayerDragPreview';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { arrowViewGeometry } from './arrow-view-frame';
import type { BoxedElementView } from './BoxedElementView';
import type { CanvasElementsLayerProps } from './CanvasElementsLayer';
import { PreviewedElement } from './PreviewedElement';
import { FreeArrowFrame, SelectableArrowView, SelectableBoxedView } from './selection-aware-views';

// Every element of the canvas in paint order (arrows and boxed views interleaved, so `bringToFront` /
// `sendToBack` reorder arrows relative to boxes), each a PreviewedElement drawn from its drag preview
// entry or the document. Memoised: every prop is identity-stable across editor renders that change
// nothing it draws, so a press or a release that renders the editor (a drag beginning or ending) does
// not walk the board's element views (docs/specs/008-canvas/canvas-performance.md "A move re-renders
// what moved").

// Stable empty-array constant for the `remoteSelectors` prop on the
// (very common) "no remote participants have this element selected"
// path, so BoxedElementView's memo isn't invalidated by a fresh [] per
// render.
const EMPTY_REMOTE_SELECTORS: RemoteSelector[] = [];

type P = CanvasElementsLayerProps;

// What every boxed element view on the canvas takes from its layer, the same for each element.
export type BoxedShared = Omit<
  ComponentProps<typeof BoxedElementView>,
  | 'element'
  | 'isSelected'
  | 'isMultiSelected'
  | 'showHandles'
  | 'showAnchors'
  | 'layerOpacity'
  | 'remoteSelectors'
  | 'isEditing'
  | 'editCursorAtEnd'
  | 'movable'
  | 'resizable'
  | 'fontFamily'
>;

// The layer's identity-stable handler bag (useStableHandlers), as much of it as an element uses.
type ElementListHandlers = Pick<
  P,
  | 'handleArrowSelect'
  | 'handleElementContextSelect'
  | 'onBeginEndpointDrag'
  | 'onBeginEdit'
  | 'onCommitLabel'
  | 'onCancelEdit'
  | 'onBeginArrowCurveDrag'
  | 'onBeginArrowCurvePointDrag'
  | 'onBeginArrowBend'
  | 'onDeleteCurvePoint'
  | 'onBeginArrowElbowDrag'
  | 'onBeginArrowLabelDrag'
  | 'onBeginArrowTranslate'
  | 'onBeginArrowScale'
>;

type CanvasElementListProps = Pick<
  P,
  | 'elements'
  | 'editingId'
  | 'editCursorAtEnd'
  | 'reshapingArrowId'
  | 'isPaintMode'
  | 'readOnly'
  | 'shiftDupGhostIds'
  | 'remoteSelectionsByElement'
  | 'canMove'
  | 'canResize'
  | 'tabFont'
  | 'tabFinish'
> & {
  shownOrder: readonly LayerDrawn[];
  previewStore: LayerPreviewStore;
  // The preview store's plane ref (LayerPreviewStore.attachPlane): where riding offsets are written.
  attachPlane: (plane: HTMLElement | null) => void;
  h: ElementListHandlers;
  boxedShared: BoxedShared;
  arrowGeometry: ReadonlyMap<string, ReturnType<typeof arrowViewGeometry>>;
  arrowLabels: ArrowLabels;
  // Bumped when webfonts land, so every fitted label measures again in its real face (useFontEpoch).
  fontEpoch: number;
  // The ids a stack holds, which glide to their slots when it reflows (docs/specs/009-elements/stack.md).
  stackedIds: ReadonlySet<string>;
};

export const CanvasElementList = memo(function CanvasElementList({
  shownOrder,
  previewStore,
  attachPlane,
  h,
  boxedShared,
  arrowGeometry,
  arrowLabels,
  elements,
  editingId,
  editCursorAtEnd,
  reshapingArrowId,
  isPaintMode,
  readOnly,
  shiftDupGhostIds,
  remoteSelectionsByElement,
  canMove,
  canResize,
  tabFont,
  tabFinish,
  stackedIds,
}: CanvasElementListProps) {
  return (
    // The element plane (docs/specs/008-canvas/canvas-performance.md "The canvas's cursor stays off the
    // elements"): no box of its own, and a cursor of its own (globals.css), so the canvas's cursor
    // changing restyles this node and not the board beneath it.
    // Its parent holds every node a riding element's offset is written to (useLayerDragPreview).
    <div data-element-plane="" data-ride-plane="contents" className="contents" ref={attachPlane}>
      {shownOrder.map(({ element: listed, layerOpacity }) => (
        <PreviewedElement
          key={listed.id}
          store={previewStore}
          element={listed}
          draw={(element: Element, entry: PreviewEntry | undefined) => {
            // Shift-duplicate ghost (docs/specs/008-canvas/shift-drag-duplicate.md): the dragged set renders
            // translucent while its materialised copy holds the start
            // position, multiplied over any per-layer opacity.
            const ghostFactor = shiftDupGhostIds?.has(element.id) ? 0.45 : 1;
            const effOpacity = ghostFactor * layerOpacity;
            if (element.type === 'arrow') {
              return (
                <Fragment key={element.id}>
                  <svg
                    className="absolute inset-0 h-full w-full"
                    data-arrow-svg=""
                    // Where a move's offset rides (docs/specs/008-canvas/drag-preview.md "Moves ride an offset").
                    data-ride-id={element.id}
                    style={{
                      pointerEvents: 'none',
                      overflow: 'visible',
                      ...(effOpacity < 1 ? { opacity: effOpacity } : {}),
                    }}
                  >
                    <SelectableArrowView
                      arrow={element}
                      frame={(entry?.geometry ?? arrowGeometry.get(element.id)!).frame}
                      holes={(entry?.geometry ?? arrowGeometry.get(element.id)!).holes}
                      labelRender={entry?.label ?? arrowLabels.renderOf(element.id)}
                      draftLayout={arrowLabels.draftLayout}
                      isPaintMode={isPaintMode}
                      isEditing={element.id === editingId}
                      editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
                      readOnly={readOnly}
                      onSelect={h.handleArrowSelect}
                      onContextSelect={h.handleElementContextSelect}
                      onBeginEndpointDrag={h.onBeginEndpointDrag}
                      onBeginEdit={h.onBeginEdit}
                      onCommitLabel={h.onCommitLabel}
                      onBeginCurveDrag={h.onBeginArrowCurveDrag}
                      onBeginCurvePointDrag={h.onBeginArrowCurvePointDrag}
                      onBeginArrowBend={h.onBeginArrowBend}
                      onDeleteCurvePoint={h.onDeleteCurvePoint}
                      onBeginElbowDrag={h.onBeginArrowElbowDrag}
                      onBeginLabelDrag={h.onBeginArrowLabelDrag}
                      fontFamily={arrowLabelFontStack(element, tabFont, tabFinish)}
                    />
                  </svg>
                  <FreeArrowFrame
                    arrow={element}
                    elements={elements}
                    standsDown={
                      element.id === editingId ||
                      element.id === reshapingArrowId ||
                      readOnly ||
                      isPaintMode
                    }
                    onBeginArrowTranslate={h.onBeginArrowTranslate}
                    onBeginArrowScale={h.onBeginArrowScale}
                  />
                </Fragment>
              );
            }
            if (!isBoxed(element)) return null;
            return (
              <SelectableBoxedView
                key={element.id}
                editingId={editingId}
                {...boxedShared}
                element={element}
                // A stack's child glides to its new slot, unless the gesture is moving it (docs/specs/009-elements/stack.md).
                stackGlide={stackedIds.has(element.id) && entry === undefined}

                layerOpacity={effOpacity < 1 ? effOpacity : undefined}
                remoteSelectors={
                  remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS
                }
                isEditing={element.id === editingId}
                editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
                movable={!readOnly || canMove?.(element) === true}
                resizable={!readOnly || canResize?.(element) === true}

                // Under the Sketch finish, the handwriting font (docs/specs/008-canvas/finish.md).
                fontFamily={exportFontFamily(element, tabFont, tabFinish)}
              />
            );
          }}
        />
      ))}
    </div>
  );
});
