'use client';

import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { ClusterPopoverButton } from './ClusterPopoverButton';

// The Slides button in the bottom-right cluster, in Illustrate mode (docs/specs/007-editor/
// illustrate-pages.md "Slides"): an infographic is likely to be presented, so its deck sits one
// press away, where Layers sits in the other modes.
export function SlidesClusterButton(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  return (
    <ClusterPopoverButton
      label="Open Slides"
      hoverTitle="Open Slides"
      hoverDescription="Build a slide deck from your pages and present it."
      icon={<SlideDeckIcon />}
      {...props}
    />
  );
}
