'use client';

// The canvas tool the editor starts with (docs/specs/007-editor/editor-modes.md "The tool it starts with"): Select,
// and Hand on a phone, where a drag should move the canvas. Picked once as the editor opens; any tool can be picked
// after.
import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';

export function startingTool(mobile: boolean): CanvasTool {
  return mobile ? 'pan' : 'select';
}

export function useStartingTool(
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool) => void,
  // An embedded viewer always starts on Hand (useCanvasTool's defaultPan).
  forcePan = false,
): void {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tool = forcePan ? 'pan' : startingTool(isMobileViewportSync());
    if (tool !== canvasTool) setCanvasTool(tool);
  }, [canvasTool, setCanvasTool, forcePan]);
}
