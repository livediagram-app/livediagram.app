'use client';

import type { ReactNode } from 'react';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

// Pages mode's pages strip in the bottom-right cluster (docs/specs/007-editor/pages-mode.md "Contents"): Contents in
// one frame, as Layers and Theme are. While a photo page is in focus, Photo joins after it
// (docs/specs/031-photo/photo-pages.md "The Photo panel"). Each segment opens its own popover. Contents is absent while
// it is docked as the sidebar; with nothing to hold, there is no strip.
export function PagesClusterStrip({ contents, photo }: { contents: ReactNode; photo?: ReactNode }) {
  if (!contents && !photo) return null;
  return (
    <ClusterStrip>
      {contents}
      {photo}
    </ClusterStrip>
  );
}
