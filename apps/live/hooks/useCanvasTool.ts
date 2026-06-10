// Canvas tool slice, lifted out of useEditorState. Select (default,
// drag-on-empty marquee-selects) vs Pan (drag-on-empty scrolls) vs
// Laser (presenter pointer). Holding Space always pans regardless.
// Lives in editor state (not Canvas) so other components (e.g. a
// status bar later) can read it without prop-drilling through Canvas.

import { useState } from 'react';
import type { CanvasTool } from '@/components/CommandPalette';
import { track } from '@/lib/telemetry';

export function useCanvasTool() {
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('select');
  // User-facing tool picker (palette buttons + keyboard). Wraps the raw
  // setter to emit telemetry when the user enters laser (presenter)
  // mode, a distinct feature. Pan / select switches stay untracked
  // (high frequency), and internal auto-switches (e.g. laser to pan
  // when a draw starts) keep the raw setter so they don't count as
  // "used laser".
  const selectCanvasTool = (tool: CanvasTool) => {
    if (tool === 'laser' && canvasTool !== 'laser') track('Canvas', 'Used', 'Laser');
    setCanvasTool(tool);
  };
  return { canvasTool, setCanvasTool, selectCanvasTool };
}
