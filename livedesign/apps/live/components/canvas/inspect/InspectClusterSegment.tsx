'use client';

import { lucideSquareDashedMousePointer } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { ClusterPopoverSegment } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

const InspectIcon = lucideGlyph(lucideSquareDashedMousePointer, 16);

// Inspect's button in the bottom-right cluster (docs/specs/007-editor/wireframe-pages.md "Inspect"): joined after
// Contents in the pages strip while the tab is a wireframe tab, for every role. Pressed, it holds the canvas in the
// Inspect tool and opens its panel; pressed again, it goes back to Select.
export function InspectClusterSegment({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <ClusterPopoverSegment
      label="Inspect"
      name="Inspect"
      hoverTitle="Inspect"
      hoverDescription="Click any element to see its size, spacing, colours and type, copy them as CSS, and export it."
      icon={<InspectIcon />}
      dataTourId="inspect-button"
      popoverOpen={active}
      onTogglePopover={onToggle}
    />
  );
}
