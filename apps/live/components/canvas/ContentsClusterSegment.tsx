'use client';

import { lucideListOrdered } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { ClusterPopoverSegment } from './ClusterPopoverButton';

const ContentsIcon = lucideGlyph(lucideListOrdered, 16);

// Contents in the bottom-right cluster, in Illustrate mode (docs/specs/007-editor/
// illustrate-pages.md "Contents"): every page of the tab one press away, for every role. Named
// beside its icon on a desktop; its icon alone on a phone. The first segment of the pages strip
// (PagesClusterStrip), Slides beside it.
export function ContentsClusterSegment(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  return (
    <ClusterPopoverSegment
      label="Contents"
      name="Contents"
      hoverTitle="Contents"
      hoverDescription="Every page of this tab: jump to one, or add a page."
      icon={<ContentsIcon />}
      dataTourId="contents"
      {...props}
    />
  );
}
