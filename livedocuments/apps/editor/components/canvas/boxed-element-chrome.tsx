import { defaultFillColor } from '@livedocuments/document';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import type { useElementSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { indicatorBacking } from '@liveworkspace/workbench/components/canvas/indicator-items';
import type { useElementIndicators } from '@/components/canvas/useElementIndicators';
import type { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import type { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { AnimationLayer } from '@liveworkspace/workbench/components/canvas/AnimationLayer';
import { IconDropPreview, type useIconDropTarget } from '@/components/canvas/useIconDropTarget';
import type { BoxedElementViewProps } from './BoxedElementView.types';

type Animation = ReturnType<typeof useBoxedElementAnimation>;

// What BoxedElementView works out for its chrome, handed down as it is.
export type BoxedChromeLocals = {
  layer: Animation['layer'];
  layerAnim: Animation['layerAnim'];
  shapeKind: string | undefined;
  cornerPx: number;
  dropSide: ReturnType<typeof useIconDropTarget>['dropSide'];
  indicators: ReturnType<typeof useElementIndicators>;
  own: { fill?: string; stroke?: string; text?: string };
  surface: ReturnType<typeof useElementSurface>;
  rotation: number;
  // A picture being cropped, whose crop overlay takes the handles' place.
  cropping: boolean;
  longPress: ReturnType<typeof useBoxedElementGestures>['longPress'];
};

// What a boxed element draws over its face (BoxedElementView): the animation layer, the icon drop
// preview, its lock and remote selectors, its indicators and the selection handles. A plain function the
// view calls in its render, so the element gains no component level.
export function useBoxedElementChrome(
  {
    element,
    remoteSelectors,
    isSelected,
    showHandles,
    showAnchors,
    onBeginDrag,
  }: BoxedElementViewProps,
  {
    layer,
    layerAnim,
    shapeKind,
    cornerPx,
    dropSide,
    indicators,
    own,
    surface,
    rotation,
    cropping,
    longPress,
  }: BoxedChromeLocals,
) {
  return (
    <>
      {/* The Shape set's ring / halo / trace / gradient layer (AnimationLayer): over the face. */}
      {layer && layerAnim ? (
        <AnimationLayer
          animation={layerAnim}
          width={element.width}
          height={element.height}
          radius={
            shapeKind === 'circle' || shapeKind === 'stadium'
              ? Math.min(element.width, element.height) / 2
              : cornerPx
          }
        />
      ) : null}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? <IconDropPreview side={dropSide} /> : null}

      {/* The element's own lock only: a locked tab or layer shows its padlock once, on the tab or the layer
          (canvas-and-palette.md "Locking"). */}
      {element.locked === true ? <LockBadge /> : null}

      {remoteSelectors.length > 0 ? <RemoteSelectorsStrip selectors={remoteSelectors} /> : null}

      {/* A margin note shows its count on its own face (ArticleNoteFace). */}
      {indicators.layout ? (
        <ElementIndicators
          element={element}
          cornerPx={indicators.cornerPx}
          fill={indicatorBacking(own.fill ?? defaultFillColor(element, surface))}
          selected={isSelected}
          items={indicators.items}
          placed={indicators.layout}
        />
      ) : null}

      {/* Selection chrome (resize / edge-grip handles), portalled into the
          grips layer above every element (see SelectionChromeLayer for the
          stacking rationale). */}
      <SelectionChromeLayer
        elementId={element.id}
        box={element}
        rotation={rotation}
        // The crop overlay's handles take the box's place while it is cropped (picture-crop-and-mask.md).
        showHandles={showHandles && !cropping}
        showAnchors={showAnchors}
        onBeginDrag={onBeginDrag}
        onHandlePress={longPress.onPointerDown}
      />
    </>
  );
}
