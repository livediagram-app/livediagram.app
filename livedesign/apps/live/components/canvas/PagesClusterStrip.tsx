'use client';

import type { ReactNode } from 'react';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

// Pages mode's pages strip in the bottom-right cluster (docs/specs/007-editor/pages-mode.md "Contents" and
// "Slides"): Contents and Slides joined in one frame, as Layers and Theme are, since both are ways through the tab's
// pages (every page to jump to, and the ones that make the deck). While a photo page is in focus, Photo joins right
// after Contents (docs/specs/031-photo/photo-pages.md "The Photo panel"). Each segment opens its own popover. Slides is
// absent until it has something to hold, and Contents then stands alone in the frame. Contents is absent while it is
// docked as the sidebar; with neither, there is no strip.
export function PagesClusterStrip({
  contents,
  photo,
  slides,
}: {
  contents: ReactNode;
  photo?: ReactNode;
  slides: ReactNode;
}) {
  if (!contents && !photo && !slides) return null;
  return (
    <ClusterStrip>
      {contents}
      {photo}
      {slides}
    </ClusterStrip>
  );
}
