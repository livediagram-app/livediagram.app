'use client';

// The element layer's per-element selection readers (docs/specs/008-canvas/blueprints/selection-store.md):
// each element view reads its own selected state from the store, so a selection change re-renders
// the views whose state flipped and not the layer that lays them out. Each wrapper is memoised as the
// view it wraps, so a layer render costs what it did.

import { memo, type ComponentProps } from 'react';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { elementGrips } from '@/lib/canvas-selection';
import {
  elementSelectionFlags,
  sameFlags,
  type Selection,
} from '@liveworkspace/workbench/lib/selection-store';

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
