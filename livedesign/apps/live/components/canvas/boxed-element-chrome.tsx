import { defaultFillColor } from '@livedesign/design';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import type { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
import { RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { indicatorBacking } from '@liveworkspace/workbench/components/canvas/indicator-items';
import type { useElementIndicators } from '@/components/canvas/useElementIndicators';
import { AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
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
  isAnnotation: boolean;
  hovering: boolean;
};

// What a boxed element draws over its face (BoxedElementView): the animation layer, the icon drop
// preview, its lock and remote selectors, its indicators, the selection handles and an annotation's hover
// note. A plain function the view calls in its render, so the element gains no component level.
export function useBoxedElementChrome(
  {
    element,
    remoteSelectors,
    isSelected,
    showHandles,
    showAnchors,
    onBeginDrag,
    isEditing,
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
    isAnnotation,
    hovering,
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

      {/* The annotation marker IS the note affordance, so it suppresses
          the generic note badge (it would be redundant). */}
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
        showHandles={showHandles}
        showAnchors={showAnchors}
        onBeginDrag={onBeginDrag}
      />

      {/* Hover preview: float this annotation's note above every element
          (docs/specs/009-elements/annotations.md). Suppressed while selected (the click/edit popover owns
          that surface then), and only when there's note text to show. */}
      {isAnnotation && hovering && !isSelected && !isEditing && element.note ? (
        <AnnotationHoverNote
          elementId={element.id}
          note={element.note}
          noteRich={element.noteRich}
        />
      ) : null}
    </>
  );
}
