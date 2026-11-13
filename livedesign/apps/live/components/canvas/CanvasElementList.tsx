import { Fragment, memo } from 'react';
import { drawsWithChartPalette } from '@livedesign/design';
import { useShallowStable } from '@liveworkspace/workbench/hooks/ui/useShallowStable';
import { arrowLabelFontStack, exportFontFamily, isBoxed, type Element } from '@livedesign/design';
import type { ArrowLabelRender, ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
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
import type { BoxedShared } from './boxed-shared';

// A boxed element whose face draws in the theme's chart colours (drawsWithChartPalette).
const paletteDrawn = (element: Element): boolean =>
  element.type === 'shape' && drawsWithChartPalette(element.shape);

// Every element of the canvas in paint order (arrows and boxed views interleaved, so `bringToFront` /
// `sendToBack` reorder arrows relative to boxes), each a PreviewedElement drawn from its drag preview
// entry or the design. Memoised: every prop is identity-stable across editor renders that change
// nothing it draws, so a press or a release that renders the editor (a drag beginning or ending) does
// not walk the board's element views (docs/specs/008-canvas/canvas-performance.md "A move re-renders
// what moved"); and each row is memoised on what it draws, so a commit that changes one element draws
// that element's row and the rows it reached, not the board's ("A drop redraws what it reached").

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
  | 'isPaintMode'
  | 'tabLocked'
  | 'readOnly'
  | 'shiftDupGhostIds'
  | 'remoteSelectionsByElement'
  | 'canMove'
  | 'canWriteText'
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

// What a row draws from beyond its element: its arrow's geometry and label render, the free arrow's board (its frame
// reads the elements) and its layer's opacity. Each the same object while it is unchanged, so a commit re-renders the
// rows it changed (docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached").
export type ElementRow = {
  geometry: ReturnType<typeof arrowViewGeometry> | undefined;
  label: ArrowLabelRender | undefined;
  elements: Element[] | undefined;
  layerOpacity: number;
};

// What every row reads alike: the list's props less the board, its arrows' geometry and labels, which reach each row
// as its own ElementRow. Held by value (useShallowStable), so it changes only when one of them does (the font epoch
// among them, so every row draws again when webfonts land, as before).
type RowShared = Omit<
  CanvasElementListProps,
  'shownOrder' | 'previewStore' | 'attachPlane' | 'elements' | 'arrowGeometry' | 'arrowLabels'
> & { draftLayout: ArrowLabels['draftLayout'] };

export const CanvasElementList = memo(function CanvasElementList({
  shownOrder,
  previewStore,
  attachPlane,
  elements,
  arrowGeometry,
  arrowLabels,
  ...rest
}: CanvasElementListProps) {
  const shared = useShallowStable<RowShared>({ ...rest, draftLayout: arrowLabels.draftLayout });
  return (
    // The element plane (docs/specs/008-canvas/canvas-performance.md "The canvas's cursor stays off the
    // elements"): a cursor of its own (globals.css), so the canvas's cursor changing restyles this node and
    // not the board beneath it. Its box is its parent's, always, and takes no press itself (globals.css):
    // a very large move carries its offset as one transform, which lays nothing out again
    // (docs/specs/008-canvas/drag-preview.md "A very large move rides as one layer").
    // Its parent holds every node a riding element's offset is written to (useLayerDragPreview).
    <div data-element-plane="" data-ride-plane="" className="absolute inset-0" ref={attachPlane}>
      {shownOrder.map(({ element: listed, layerOpacity }) => (
        <PreviewedElement
          key={listed.id}
          store={previewStore}
          element={listed}
          row={rowOf(listed, layerOpacity, elements, arrowGeometry, arrowLabels)}
          shared={shared}
          draw={drawElement}
        />
      ))}
    </div>
  );
});

// One row's ElementRow. Its fields are what the row reads, each carried over as it was; the object is new each render,
// and PreviewedElement compares it field by field.
function rowOf(
  listed: Element,
  layerOpacity: number,
  elements: Element[],
  arrowGeometry: CanvasElementListProps['arrowGeometry'],
  arrowLabels: ArrowLabels,
): ElementRow {
  if (listed.type !== 'arrow')
    return { geometry: undefined, label: undefined, elements: undefined, layerOpacity };
  // Either end free: a preview can free the other one, and the frame reads the board then.
  const free = listed.from.kind === 'free' || listed.to.kind === 'free';
  return {
    geometry: arrowGeometry.get(listed.id),
    label: arrowLabels.renderOf(listed.id),
    elements: free ? elements : undefined,
    layerOpacity,
  };
}

function drawElement(
  element: Element,
  entry: PreviewEntry | undefined,
  row: ElementRow,
  {
    h,
    boxedShared,
    editingId,
    editCursorAtEnd,
    reshapingArrowId,
    isPaintMode,
    tabLocked,
    readOnly,
    shiftDupGhostIds,
    remoteSelectionsByElement,
    canMove,
    canWriteText,
    canResize,
    tabFont,
    tabFinish,
    stackedIds,
    draftLayout,
  }: RowShared,
) {
  const { layerOpacity } = row;
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
            frame={(entry?.geometry ?? row.geometry!).frame}
            holes={(entry?.geometry ?? row.geometry!).holes}
            labelRender={entry?.label ?? row.label!}
            draftLayout={draftLayout}
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
          elements={row.elements!}
          standsDown={
            element.id === editingId ||
            element.id === reshapingArrowId ||
            readOnly ||
            tabLocked ||
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
      // The theme's chart colours only to a face that draws in them: handed to every view, a theme pick's
      // new palette rendered them all (docs/specs/008-canvas/canvas-performance.md "A theme pick on a big
      // board keeps the page answering").
      chartPalette={paletteDrawn(element) ? boxedShared.chartPalette : undefined}
      element={element}
      // A stack's child glides to its new slot, unless the gesture is moving it (docs/specs/009-elements/stack.md).
      stackGlide={stackedIds.has(element.id) && entry === undefined}
      layerOpacity={effOpacity < 1 ? effOpacity : undefined}
      remoteSelectors={remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS}
      isEditing={element.id === editingId}
      editCursorAtEnd={element.id === editingId && editCursorAtEnd === true}
      movable={!readOnly || canMove?.(element) === true}
      writable={!readOnly || canWriteText?.(element) === true}
      resizable={!readOnly || canResize?.(element) === true}
      // An explicit per-element font outranks the tab default.
      // Under the Sketch finish, the handwriting font (docs/specs/008-canvas/finish.md).
      fontFamily={exportFontFamily(element, tabFont, tabFinish)}
    />
  );
}
