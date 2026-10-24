import { Fragment, memo } from 'react';
import {
  arrowLabelFontStack,
  exportFontFamily,
  isBoxed,
  isVotableInVote,
  type Element,
} from '@liveplanner/project';
import type { ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
import type {
  LayerDrawn,
  LayerPreviewStore,
  PreviewEntry,
} from '@/hooks/canvas/useLayerDragPreview';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { arrowViewGeometry } from './arrow-view-frame';
import type { CanvasElementsLayerProps } from './CanvasElementsLayer';
import { PreviewedElement } from './PreviewedElement';
import { FreeArrowFrame, SelectableArrowView, SelectableBoxedView } from './selection-aware-views';
import type { BoxedShared } from './sheet-chart-renderer';

// Every element of the canvas in paint order (arrows and boxed views interleaved, so `bringToFront` /
// `sendToBack` reorder arrows relative to boxes), each a PreviewedElement drawn from its drag preview
// entry or the project. Memoised: every prop is identity-stable across editor renders that change
// nothing it draws, so a press or a release that renders the editor (a drag beginning or ending) does
// not walk the board's element views (docs/specs/008-canvas/canvas-performance.md "A move re-renders
// what moved").

// Stable empty-array constant for the `remoteSelectors` prop on the
// (very common) "no remote participants have this element selected"
// path, so BoxedElementView's memo isn't invalidated by a fresh [] per
// render.
const EMPTY_REMOTE_SELECTORS: RemoteSelector[] = [];

type P = CanvasElementsLayerProps;

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
  | 'tabLocked'
  | 'readOnly'
  | 'shiftDupGhostIds'
  | 'tabVote'
  | 'tabLayers'
  | 'remoteSelectionsByElement'
  | 'canMove'
  | 'canResize'
  | 'voteReview'
  | 'tabFont'
  | 'tabFinish'
> & {
  shownOrder: readonly LayerDrawn[];
  previewStore: LayerPreviewStore;
  h: ElementListHandlers;
  boxedShared: BoxedShared;
  arrowGeometry: ReadonlyMap<string, ReturnType<typeof arrowViewGeometry>>;
  arrowLabels: ArrowLabels;
  commentActionsFor: ((id: string) => BoxedViewProp<'commentActions'>) | null;
  actionActionsFor: ((id: string) => BoxedViewProp<'actionActions'>) | null;
  // Bumped when webfonts land, so every fitted label measures again in its real face (useFontEpoch).
  fontEpoch: number;
};

type BoxedViewProp<K extends string> = K extends keyof Parameters<typeof SelectableBoxedView>[0]
  ? Parameters<typeof SelectableBoxedView>[0][K]
  : never;

export const CanvasElementList = memo(function CanvasElementList({
  shownOrder,
  previewStore,
  h,
  boxedShared,
  arrowGeometry,
  arrowLabels,
  elements,
  editingId,
  editCursorAtEnd,
  reshapingArrowId,
  tabLocked,
  readOnly,
  shiftDupGhostIds,
  tabVote,
  tabLayers,
  remoteSelectionsByElement,
  canMove,
  canResize,
  voteReview,
  commentActionsFor,
  actionActionsFor,
  tabFont,
  tabFinish,
}: CanvasElementListProps) {
  return (
    // The element plane (docs/specs/008-canvas/canvas-performance.md "The canvas's cursor stays off the
    // elements"): no box of its own, and a cursor of its own (globals.css), so the canvas's cursor
    // changing restyles this node and not the board beneath it.
    <div data-element-plane="" className="contents">
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
                    // Tagged for tests and e2e, which find an arrow's path by it.
                    data-arrow-svg=""
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
                      isEditing={element.id === editingId}
                      editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
                      tabLocked={tabLocked}
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
                      tabLocked
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
                // Resolved once here, where both the vote and the tab's layers
                // are in scope, rather than threading `layers` down to the
                // gesture hook and the overlay separately (docs/specs/012-collaboration/vote-layer-scope.md).
                votableInVote={isVotableInVote(element, tabVote, tabLayers)}
                layerOpacity={effOpacity < 1 ? effOpacity : undefined}
                remoteSelectors={
                  remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS
                }
                isEditing={element.id === editingId}
                editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
                movable={!readOnly || canMove?.(element) === true}
                resizable={!readOnly || canResize?.(element) === true}
                isVoteFocus={voteReview?.focusId === element.id}
                commentActions={commentActionsFor?.(element.id)}
                actionActions={actionActionsFor?.(element.id)}
                // An explicit per-element font outranks the tab default.
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
