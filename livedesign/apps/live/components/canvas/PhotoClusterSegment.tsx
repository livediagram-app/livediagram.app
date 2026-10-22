'use client';

import { lucideImage } from '@livedesign/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { ClusterPopoverSegment } from './ClusterPopoverButton';

const PhotoIcon = lucideGlyph(lucideImage, 16);

// The Photo panel's button in the bottom-right cluster (docs/specs/031-photo/photo-pages.md "The Photo panel"):
// joined to the right of Contents in the pages strip (PagesClusterStrip) while a photo page is in focus, its
// press opening the panel (Layers, Adjust, History) over it.
export function PhotoClusterSegment(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  return (
    <ClusterPopoverSegment
      label="Photo"
      name="Photo"
      hoverTitle="Photo"
      hoverDescription="The photo's layers, adjustments and history."
      icon={<PhotoIcon />}
      dataTourId="photo-panel-button"
      {...props}
    />
  );
}
