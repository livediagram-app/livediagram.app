'use client';

// The canvas tool a mode starts with (docs/specs/007-editor/editor-modes.md "The tool a mode starts
// with"): Select in every mode, and Hand where a finger is the way in (a phone, or a touch-first
// screen such as an iPad with no trackpad or mouse attached), where a drag should move the canvas.
// Picked whenever the mode changes, the first mode included; any tool can be picked after.
import { useEffect, useRef } from 'react';
import type { EditorMode } from '@livediagram/document';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync, isTouchFirstSync } from '@liveworkspace/workbench/lib/responsive';

export function modeDefaultTool(handFirst: boolean): CanvasTool {
  return handFirst ? 'pan' : 'select';
}

/** Whether a mode starts on Hand here: a phone, or a touch-first screen. Read from the media queries each time. */
export const startsOnHand = (): boolean => isMobileViewportSync() || isTouchFirstSync();

/** The tool a held tool is put down to (a template's scaffold, Escape out of Isometric, the Magnifier or the format
 *  painter, the eraser leaving Draw): the tool a mode starts with here, so a touch-first screen goes back to Hand. */
export const restingTool = (): CanvasTool => modeDefaultTool(startsOnHand());

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
      const tool = forcePan ? 'pan' : modeDefaultTool(startsOnHand());
      if (tool !== canvasTool) setCanvasTool(tool);
    }
  }, [mode, canvasTool, setCanvasTool, forcePan]);
}
