'use client';

// The element layer's per-element selection readers (docs/specs/008-canvas/blueprints/selection-store.md):
// each element view reads its own selected state from the store, so a selection change re-renders
// the views whose state flipped and not the layer that lays them out. Each wrapper is memoised as the
// view it wraps, so a layer render costs what it did.

import { memo, type ComponentProps, type PointerEvent as ReactPointerEvent } from 'react';
import { arrowRoutePoints, type ArrowElement, type Element } from '@livediagram/document';
import { ArrowView, arrowViewPropsEqual } from '@/components/canvas/ArrowView';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { FreeArrowSelection } from '@/components/canvas/FreeArrowSelection';
import { BoxGripsPortal } from '@/components/canvas/SelectionGripsLayer';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { elementGrips } from '@/lib/canvas-selection';
import { elementSelectionFlags, sameFlags, type Selection } from '@/lib/selection-store';

const useFlagsOf = (id: string) =>
  useSelectionOf((s: Selection) => elementSelectionFlags(s, id), sameFlags);

type BoxedProps = ComponentProps<typeof BoxedElementView>;
type SelectableBoxedProps = Omit<
  BoxedProps,
  'isSelected' | 'isMultiSelected' | 'showHandles' | 'showAnchors'
> & { editingId: string | null };

export const SelectableBoxedView = memo(function SelectableBoxedView({
  editingId,
  ...props
}: SelectableBoxedProps) {
  const flags = useFlagsOf(props.element.id);
  const grips = elementGrips(props.element, flags.single, {
    editingId,
    isPaintMode: props.isPaintMode === true,
    tabLocked: props.tabLocked === true,
    readOnly: props.readOnly === true,
    resizable: props.resizable,
  });
  return (
    <BoxedElementView
      {...(props as BoxedProps)}
      isSelected={flags.selected}
      isMultiSelected={flags.multi}
      showHandles={grips.handles}
      showAnchors={grips.anchors}
    />
  );
});

type ArrowProps = ComponentProps<typeof ArrowView>;
type SelectableArrowProps = Omit<ArrowProps, 'isSelected'>;

export const SelectableArrowView = memo(
  function SelectableArrowView(props: SelectableArrowProps) {
    const { selected } = useFlagsOf(props.arrow.id);
    return <ArrowView {...(props as ArrowProps)} isSelected={selected} />;
  },
  (a, b) => arrowViewPropsEqual(a as ArrowProps, b as ArrowProps),
);

// A selected free arrow wears a box's selection: ring + scale handles (docs/specs/008-canvas/arrow-bending.md),
// portalled into the grips layer. Not while it is locked, edited or reshaped by a handle (the frame
// grew with every bend and read as a selection box being dragged out), nor in an edit-blocking mode.
export const FreeArrowFrame = memo(function FreeArrowFrame({
  arrow,
  elements,
  standsDown,
  onBeginArrowTranslate,
  onBeginArrowScale,
}: {
  arrow: ArrowElement;
  elements: Element[];
  // Editing, reshaping, read-only, tab-locked or painting: any of them hides the frame.
  standsDown: boolean;
  onBeginArrowTranslate: (id: string, e: ReactPointerEvent) => void;
  onBeginArrowScale: (
    id: string,
    handle: Parameters<ComponentProps<typeof FreeArrowSelection>['onBeginScale']>[0],
    e: ReactPointerEvent,
  ) => void;
}) {
  const { single } = useFlagsOf(arrow.id);
  const framed =
    single &&
    !standsDown &&
    arrow.from.kind === 'free' &&
    arrow.to.kind === 'free' &&
    arrow.locked !== true;
  if (!framed) return null;
  return (
    <FramedArrow
      arrow={arrow}
      elements={elements}
      onBeginArrowTranslate={onBeginArrowTranslate}
      onBeginArrowScale={onBeginArrowScale}
    />
  );
});

// The one framed arrow's frame: it alone follows the zoom (its grips keep their screen size), so a
// zoom renders it and no other arrow's slot (docs/specs/008-canvas/canvas-performance.md).
function FramedArrow({
  arrow,
  elements,
  onBeginArrowTranslate,
  onBeginArrowScale,
}: Omit<ComponentProps<typeof FreeArrowFrame>, 'standsDown'>) {
  const zoom = useCanvasZoom();
  return (
    <BoxGripsPortal>
      <FreeArrowSelection
        arrowId={arrow.id}
        points={arrowRoutePoints(arrow, elements)}
        zoom={zoom}
        onBeginMove={(e) => onBeginArrowTranslate(arrow.id, e)}
        onBeginScale={(handle, e) => onBeginArrowScale(arrow.id, handle, e)}
      />
    </BoxGripsPortal>
  );
}
