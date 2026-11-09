import { memo, type ComponentProps } from 'react';
import {
  exportFontFamily,
  isBoxed,
  isRetiredArrow,
  retiredArrowEnds,
  type Element,
  type ElementIndex,
} from '@livehuddle/document';
import type {
  LayerDrawn,
  LayerPreviewStore,
  PreviewEntry,
} from '@/hooks/canvas/useLayerDragPreview';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { BoxedElementView } from './BoxedElementView';
import type { CanvasElementsLayerProps } from './CanvasElementsLayer';
import { PreviewedElement } from './PreviewedElement';
import { RetiredArrowView } from './RetiredArrowView';
import { SelectableBoxedView } from './selection-aware-views';

// Every element of the canvas in paint order (retired arrows and boxed views interleaved, so `bringToFront` /
// `sendToBack` reorder a retired arrow relative to boxes), each a PreviewedElement drawn from its drag preview
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
type ElementListHandlers = Pick<P, 'handleArrowSelect'>;

type CanvasElementListProps = Pick<
  P,
  | 'editingId'
  | 'editCursorAtEnd'
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
  // The drawn board by id, which a retired arrow's ends resolve against (retiredArrowEnds).
  elementIndex: ElementIndex;
  // Bumped when webfonts land, so every fitted label measures again in its real face (useFontEpoch).
  fontEpoch: number;
};

export const CanvasElementList = memo(function CanvasElementList({
  shownOrder,
  previewStore,
  attachPlane,
  h,
  boxedShared,
  elementIndex,
  editingId,
  editCursorAtEnd,
  readOnly,
  shiftDupGhostIds,
  remoteSelectionsByElement,
  canMove,
  canResize,
  tabFont,
  tabFinish,
}: CanvasElementListProps) {
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
          draw={(element: Element, entry: PreviewEntry | undefined) => {
            // Shift-duplicate ghost (docs/specs/008-canvas/shift-drag-duplicate.md): the dragged set renders
            // translucent while its materialised copy holds the start
            // position, multiplied over any per-layer opacity.
            const ghostFactor = shiftDupGhostIds?.has(element.id) ? 0.45 : 1;
            const effOpacity = ghostFactor * layerOpacity;
            const remoteSelectors =
              remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS;
            // A retired arrow (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4):
            // its dashed line and its placeholder card, its ends worked out now (or as a drag preview has them).
            if (isRetiredArrow(element)) {
              return (
                <RetiredArrowView
                  key={element.id}
                  editingId={editingId}
                  {...boxedShared}
                  arrow={element}
                  ends={entry?.ends ?? retiredArrowEnds(element, elementIndex)}
                  onSelect={h.handleArrowSelect}
                  layerOpacity={effOpacity < 1 ? effOpacity : undefined}
                  remoteSelectors={remoteSelectors}
                  isEditing={false}
                  // The tab's font: an arrow carries none of its own that livehuddle reads.
                  fontFamily={exportFontFamily({}, tabFont, tabFinish)}
                />
              );
            }
            if (!isBoxed(element)) return null;
            return (
              <SelectableBoxedView
                key={element.id}
                editingId={editingId}
                {...boxedShared}
                element={element}
                layerOpacity={effOpacity < 1 ? effOpacity : undefined}
                remoteSelectors={remoteSelectors}
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
