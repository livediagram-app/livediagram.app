// Canvas tool slice, lifted out of useEditorState. Select (default,
// drag-on-empty marquee-selects) vs Pan (drag-on-empty scrolls) vs
// Laser (presenter pointer) vs Avatar (walk mode, spec/101). Holding
// Space always pans regardless.
// Lives in editor state (not Canvas) so other components (e.g. a
// status bar later) can read it without prop-drilling through Canvas.

import { useRef, useState } from 'react';
import type { CanvasTool } from '@/components/palette/CommandPalette';
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
  // The tool that was active before Avatar mode (spec/101) took over, so
  // picking a palette tile can put the user back exactly where they were
  // rather than guessing Select. Same idea as useFormatTool's preFormatToolRef.
  const preAvatarToolRef = useRef<CanvasTool>('select');
  // The general form of the same idea: whatever tool you were in before the
  // current one, for any mode. A Selection Mode button (spec/103) presses back
  // out of its own mode with this, so a button that switches you in is never a
  // one-way door.
  const priorToolRef = useRef<CanvasTool>('select');
  const selectCanvasTool = (tool: CanvasTool) => {
    if (tool !== canvasTool) priorToolRef.current = canvasTool;
    if (tool === 'avatar' && canvasTool !== 'avatar') preAvatarToolRef.current = canvasTool;
    if (tool === 'laser' && canvasTool !== 'laser') track('Canvas', 'Used', 'Laser');
    if (tool === 'spotlight' && canvasTool !== 'spotlight') track('Canvas', 'Used', 'Spotlight');
    if (tool === 'eraser' && canvasTool !== 'eraser') track('Canvas', 'Used', 'Eraser');
    // `AvatarMode`, not `Avatar` — the palette's Avatar photo tile already owns
    // the `Avatar` token on Element·Added (spec/101).
    if (tool === 'avatar' && canvasTool !== 'avatar') track('Canvas', 'Used', 'AvatarMode');
    if (tool === 'format' && canvasTool !== 'format') track('Canvas', 'Used', 'FormatPainter');
    if (tool === 'isometric' && canvasTool !== 'isometric') track('Canvas', 'Used', 'Isometric');
    setCanvasTool(tool);
  };
  // Leave Avatar mode for the tool that preceded it. Called when the user
  // reaches for the palette mid-walk (spec/101): a tile is an edit, and the
  // mode is read-only, so the character steps aside instead of swallowing the
  // click. A no-op in every other tool, so callers can fire it blind. The
  // remembered tool can't itself be 'avatar' (selectCanvasTool only records a
  // change INTO the mode), but guard anyway so a stale ref can't trap the user.
  const exitAvatarTool = () => {
    if (canvasTool !== 'avatar') return;
    const back = preAvatarToolRef.current;
    setCanvasTool(back === 'avatar' ? 'select' : back);
  };
  // Where "go back" leads: the tool before the current one, never the current
  // one itself (a stale ref must not trap the user in the mode they're leaving).
  const toolBeforeCurrent = (): CanvasTool =>
    priorToolRef.current === canvasTool ? 'select' : priorToolRef.current;
  return { canvasTool, setCanvasTool, selectCanvasTool, exitAvatarTool, toolBeforeCurrent };
}
