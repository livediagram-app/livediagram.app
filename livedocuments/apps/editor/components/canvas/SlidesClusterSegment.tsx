'use client';

import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { ClusterPopoverSegment } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

// Whether the Slides button shows: once at least one page is a slide (pages-mode.md "Slides button"), since
// until then the deck has nothing to hold.
export function showsSlidesButton(pages: readonly { kind?: string }[]): boolean {
  return pages.some((p) => p.kind === 'slide');
}

// The Slides button in the bottom-right cluster, in Pages mode (docs/specs/007-editor/
// pages-mode.md "Slides"): an infographic is likely to be presented, so its deck sits one
// press away, where Layers sits in the other modes. The second segment of the pages strip
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
      hoverDescription="Build a slide deck from your pages and present it."
      icon={<SlideDeckIcon />}
      // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md).
      dataTourId="slides"
      {...props}
    />
  );
}
