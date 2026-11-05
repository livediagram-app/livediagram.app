'use client';

import type { ReactNode } from 'react';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

// Pages mode's pages strip in the bottom-right cluster (docs/specs/007-editor/pages-mode.md "Contents"): Contents in
// its own frame, as Layers and Theme share one. It opens Contents' popover. Contents is absent while it is docked as
// the sidebar, and then there is no strip.
export function PagesClusterStrip({ contents }: { contents: ReactNode }) {
  if (!contents) return null;
  return <ClusterStrip>{contents}</ClusterStrip>;
}
