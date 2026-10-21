'use client';

import type { ReactNode } from 'react';
import { ClusterStrip } from './ClusterPopoverButton';

// Pages mode's pages strip in the bottom-right cluster (docs/specs/007-editor/pages-mode.md "Contents"): Contents
// in its own frame, as Layers is. Contents is absent while it is docked as the sidebar, and there is then no strip.
export function PagesClusterStrip({ contents }: { contents: ReactNode }) {
  if (!contents) return null;
  return <ClusterStrip>{contents}</ClusterStrip>;
}
