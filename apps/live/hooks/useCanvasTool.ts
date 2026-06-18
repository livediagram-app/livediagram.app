// Canvas tool slice, lifted out of useEditorState. Select (default,
// drag-on-empty marquee-selects) vs Pan (drag-on-empty scrolls) vs
// Laser (presenter pointer). Holding Space always pans regardless.
// Lives in editor state (not Canvas) so other components (e.g. a
// status bar later) can read it without prop-drilling through Canvas.

import { useState } from 'react';
import type { CanvasTool } from '@/components/CommandPalette';
import { isMobileViewportSync } from '@/lib/responsive';
import { track } from '@/lib/telemetry';

export function useCanvasTool({ defaultPan = false }: { defaultPan?: boolean } = {}) {
  // Default to Hand (pan) on a touch / mobile viewport, Select on
  // desktop: on a small touchscreen a drag-on-empty far more often
  // means "scroll the canvas" than "marquee-select", and pinch-zoom
  // pairs naturally with panning. Lazy initial read is safe during the
  // static-export render (see isMobileViewportSync). `defaultPan` forces
  // Hand on every viewport, used by the read-only embed view (spec/33):
  // there's nothing to select / edit, so panning is the only useful
  // drag-on-empty gesture.
  const [canvasTool, setCanvasTool] = useState<CanvasTool>(() =>
    defaultPan || isMobileViewportSync() ? 'pan' : 'select',
  );
  // User-facing tool picker (palette buttons + keyboard). Wraps the raw
  // setter to emit telemetry when the user enters laser (presenter)
  // mode, a distinct feature. Pan / select switches stay untracked
  // (high frequency), and internal auto-switches (e.g. laser to pan
  // when a draw starts) keep the raw setter so they don't count as
  // "used laser".
  const selectCanvasTool = (tool: CanvasTool) => {
    if (tool === 'laser' && canvasTool !== 'laser') track('Canvas', 'Used', 'Laser');
    if (tool === 'spotlight' && canvasTool !== 'spotlight') track('Canvas', 'Used', 'Spotlight');
    if (tool === 'eraser' && canvasTool !== 'eraser') track('Canvas', 'Used', 'Eraser');
    if (tool === 'isometric' && canvasTool !== 'isometric') track('Canvas', 'Used', 'Isometric');
    setCanvasTool(tool);
  };
  return { canvasTool, setCanvasTool, selectCanvasTool };
}
