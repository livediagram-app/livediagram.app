'use client';

import type { ReactNode } from 'react';
import { ClusterStrip } from './ClusterPopoverButton';

// Illustrate's pages strip in the bottom-right cluster (docs/specs/007-editor/illustrate-pages.md "Contents" and
// "Slides"): Contents and Slides joined in one frame, as Layers and Theme are, since both are ways through the tab's
// pages (every page to jump to, and the ones that make the deck). Each segment opens its own popover. Slides is
// absent until it has something to hold, and Contents then stands alone in the frame.
export function PagesClusterStrip({
  contents,
  slides,
}: {
  contents: ReactNode;
  slides: ReactNode;
}) {
  return (
    <ClusterStrip>
      {contents}
      {slides}
    </ClusterStrip>
  );
}
