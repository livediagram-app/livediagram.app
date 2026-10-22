'use client';

// Drops out of the Slide Deck tool (docs/specs/012-collaboration/presentation-mode.md) when the viewport
// shrinks to phone width while it is picked. The pickers already hide the
// tool on a phone; this covers the resize / rotate that happens with it open,
// so the deck panel never renders in a layout it does not fit. Falls back to
// Hand, the phone's default tool (useCanvasTool). A running presentation is
// untouched: it does not depend on the tool staying picked.

import { useEffect } from 'react';

import type { CanvasTool } from '@/components/palette/palette.types';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';

export function useDesktopOnlyToolExit(
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool) => void,
): void {
  const isMobile = useIsMobileViewport();
  useEffect(() => {
    if (isMobile && canvasTool === 'slide-deck') setCanvasTool('pan');
  }, [isMobile, canvasTool, setCanvasTool]);
}
