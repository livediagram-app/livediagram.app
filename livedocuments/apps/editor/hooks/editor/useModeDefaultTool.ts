'use client';

// The canvas tool the editor starts with: Select, and Hand on a phone, where a drag should move the
// canvas. Picked once, when the editor opens; any tool can be picked after.
import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';

export function modeDefaultTool(mobile: boolean): CanvasTool {
  return mobile ? 'pan' : 'select';
}

export function useModeDefaultTool(
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool) => void,
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
