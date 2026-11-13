'use client';

// The canvas tool the editor starts with: Select, and Hand on a phone, where a drag should move the
// canvas. Picked once, when the editor opens; any tool can be picked after.
import { useEffect, useRef } from 'react';
import { isMobileViewportSync } from '../../lib/responsive';

// The two tools a mode starts on; each editor's own tool union has both.
type StartTool = 'select' | 'pan';

export function modeDefaultTool(mobile: boolean): StartTool {
  return mobile ? 'pan' : 'select';
}

export function useModeDefaultTool<CanvasTool extends string>(
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool | StartTool) => void,
  // An embedded viewer always starts on Hand (useCanvasTool's defaultPan).
  forcePan = false,
): void {
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current) return;
    picked.current = true;
    const tool = forcePan ? 'pan' : modeDefaultTool(isMobileViewportSync());
    if (tool !== canvasTool) setCanvasTool(tool);
  }, [canvasTool, setCanvasTool, forcePan]);
}
