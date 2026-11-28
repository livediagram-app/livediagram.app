'use client';

import {
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideRotateCcw, lucideRotateCw } from '@liveworkspace/icons/lucide';
import { turnSpace3D } from '@/lib/space-3d/space-3d-turn';

const TurnLeftIcon = lucideGlyph(lucideRotateCcw, 18);
const TurnRightIcon = lucideGlyph(lucideRotateCw, 18);

// Turn Left and Turn Right in a phone's bottom-right cluster (docs/specs/008-canvas/3d-view.md "Turning the camera"):
// the view is always 3D, so there is no switch; a desktop turns with the view dial's arrows or `[` and `]`.
export function Space3DTurnButtons() {
  return (
    <ClusterStrip dataTourId="space-3d-turn">
      <ClusterPopoverSegment
        label="Turn Left"
        hoverTitle="Turn Left"
        hoverDescription="Turn the camera a quarter turn to the left. [."
        icon={<TurnLeftIcon />}
        popoverOpen={false}
        onTogglePopover={() => turnSpace3D(-1)}
      />
      <ClusterPopoverSegment
        divided
        label="Turn Right"
        hoverTitle="Turn Right"
        hoverDescription="Turn the camera a quarter turn to the right. ]."
        icon={<TurnRightIcon />}
        popoverOpen={false}
        onTogglePopover={() => turnSpace3D(1)}
      />
    </ClusterStrip>
  );
}
