'use client';

import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { ClusterPopoverSegment } from './ClusterPopoverButton';

// The Slides button in the bottom-right cluster, in Pages mode (docs/specs/007-editor/
// pages-mode.md "Slides"): a design is likely to be presented, so its deck sits one press
// away, where Layers sits in the other modes. The second segment of the pages strip
// (PagesClusterStrip), after Contents.
export function SlidesClusterSegment(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  return (
    <ClusterPopoverSegment
      divided
      label="Open Slides"
      name="Slides"
      hoverTitle="Open Slides"
      hoverDescription="Order, hide and present your pages."
      icon={<SlideDeckIcon />}
      // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md).
      dataTourId="slides"
      {...props}
    />
  );
}
