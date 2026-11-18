'use client';

import {
  ClusterPopoverButton,
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { Glyph } from '@livehuddle/ui';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideRotateCcw, lucideRotateCw } from '@liveworkspace/icons/lucide';
import { toggleSpace3D } from '@/lib/space-3d/space-3d-preference';
import { turnSpace3D } from '@/lib/space-3d/space-3d-turn';
import { useSpace3DPreference } from './useSpace3DView';

const TurnLeftIcon = lucideGlyph(lucideRotateCcw, 18);
const TurnRightIcon = lucideGlyph(lucideRotateCw, 18);

// The 3D View switch in the bottom-right cluster while walking (docs/specs/008-canvas/3d-view.md "Turning it on and
// off"): lit while the view is 3D, named "3D" beside its icon on a wide desktop.
export function Space3DButton() {
  const on = useSpace3DPreference();
  return (
    <>
      {/* Turn Left and Turn Right while it is on (3d-view.md "Turning the camera"). */}
      {on ? (
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
      ) : null}
      <ClusterPopoverButton
        toggle
        label="3D View"
        hoverTitle="3D View"
        hoverDescription="Tilt the Space back and stand its walls up. Shift+3."
        name="3D"
        icon={<Space3DGlyph />}
        popoverOpen={on}
        onTogglePopover={toggleSpace3D}
        dataTourId="space-3d"
      />
    </>
  );
}

/** A floor seen in perspective with two walls standing on it. */
export function Space3DGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M2.5 16.5h15l-3-7.5h-9z" />
      <path d="M5.5 9V4.5h9V9" />
      <path d="M10 4.5V9" />
    </Glyph>
  );
}
