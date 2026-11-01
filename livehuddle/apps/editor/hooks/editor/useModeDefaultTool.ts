'use client';

// The canvas tool a mode starts with (docs/specs/007-editor/editor-modes.md "The tool a mode starts
// with"): Select in every mode, and Hand on a phone, where a drag should move the canvas. Picked
// whenever the mode changes, the first mode included; any tool can be picked after.
import { useEffect, useRef } from 'react';
import type { EditorMode } from '@livehuddle/document';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';

export function modeDefaultTool(mobile: boolean): CanvasTool {
  return mobile ? 'pan' : 'select';
}

export function useModeDefaultTool(
  mode: EditorMode,
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool) => void,
  // An embedded viewer always starts on Hand (useCanvasTool's defaultPan).
  forcePan = false,
): void {
  const previous = useRef<EditorMode | null>(null);
  useEffect(() => {
    const changed = previous.current !== mode;
    previous.current = mode;
    if (changed) {
      const tool = forcePan ? 'pan' : modeDefaultTool(isMobileViewportSync());
      if (tool !== canvasTool) setCanvasTool(tool);
    }
  }, [mode, canvasTool, setCanvasTool, forcePan]);
}
