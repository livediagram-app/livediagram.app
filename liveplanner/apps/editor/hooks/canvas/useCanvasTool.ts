// Canvas tool slice, lifted out of useEditorState. Select (default,
// drag-on-empty marquee-selects) vs Pan (drag-on-empty scrolls). Holding Space always pans regardless.
// Lives in editor state (not Canvas) so other components (e.g. a
// status bar later) can read it without prop-drilling through Canvas.

import { useState } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@/lib/responsive';

export function useCanvasTool({ defaultPan = false }: { defaultPan?: boolean } = {}) {
  // Default to Hand (pan) on a touch / mobile viewport, Select on
  // desktop: on a small touchscreen a drag-on-empty far more often
  // means "scroll the canvas" than "marquee-select", and pinch-zoom
  // pairs naturally with panning. Lazy initial read is safe during the
  // static-export render (see isMobileViewportSync). `defaultPan` forces
  // Hand on every viewport, used by the read-only embed view (docs/specs/013-workspace/embeds.md):
  // there's nothing to select / edit, so panning is the only useful
  // drag-on-empty gesture.
  const [canvasTool, setCanvasTool] = useState<CanvasTool>(() =>
    defaultPan || isMobileViewportSync() ? 'pan' : 'select',
  );
  return { canvasTool, setCanvasTool };
}
