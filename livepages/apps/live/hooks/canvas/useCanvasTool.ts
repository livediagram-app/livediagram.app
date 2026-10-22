// Canvas tool slice, lifted out of useEditorState. Select (default,
// drag-on-empty marquee-selects) vs Pan (drag-on-empty scrolls) vs
// Laser (presenter pointer). Holding Space always pans regardless.
// Lives in editor state (not Canvas) so other components (e.g. a
// status bar later) can read it without prop-drilling through Canvas.

import { useRef, useState } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@/lib/responsive';
import { track } from '@/lib/telemetry';

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
  // User-facing tool picker (palette buttons + keyboard). Wraps the raw
  // setter to emit telemetry when the user enters laser (presenter)
  // mode, a distinct feature. Pan / select switches stay untracked
  // (high frequency), and internal auto-switches (e.g. laser to pan
  // when a draw starts) keep the raw setter so they don't count as
  // "used laser".
  // Whatever tool you were in before the current one, for any mode. A Selection Mode button (docs/specs/009-elements/mode-button.md) presses back
  // out of its own mode with this, so a button that switches you in is never a
  // one-way door.
  const priorToolRef = useRef<CanvasTool>('select');
  const selectCanvasTool = (tool: CanvasTool) => {
    if (tool !== canvasTool) priorToolRef.current = canvasTool;
    if (tool === 'laser' && canvasTool !== 'laser') track('Canvas', 'Used', 'Laser');
    if (tool === 'spotlight' && canvasTool !== 'spotlight') track('Canvas', 'Used', 'Spotlight');
    if (tool === 'format' && canvasTool !== 'format') track('Canvas', 'Used', 'FormatPainter');
    if (tool === 'isometric' && canvasTool !== 'isometric') track('Canvas', 'Used', 'Isometric');
    // Slide Deck (docs/specs/012-collaboration/presentation-mode.md) is 'UI'/'Opened' rather than 'Canvas'/'Used':
    // picking it opens the deck workbench, it does not change the canvas.
    // Starting the presentation is its own event, fired from the panel.
    if (tool === 'slide-deck' && canvasTool !== 'slide-deck') track('UI', 'Opened', 'SlideDeck');
    setCanvasTool(tool);
  };
  // Where "go back" leads: the tool before the current one, never the current
  // one itself (a stale ref must not trap the user in the mode they're leaving).
  const toolBeforeCurrent = (): CanvasTool =>
    priorToolRef.current === canvasTool ? 'select' : priorToolRef.current;
  return { canvasTool, setCanvasTool, selectCanvasTool, toolBeforeCurrent };
}
