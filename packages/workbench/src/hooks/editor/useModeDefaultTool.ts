'use client';

// The canvas tool the editor starts with: Select, and Hand where a finger is the way in (a phone, or a touch-first
// screen such as an iPad with no trackpad or mouse), where a drag should move the canvas. Select whenever a fine
// pointer is present. Picked once, when the editor opens; any tool can be picked after.
import { useEffect, useRef } from 'react';
import { isMobileViewportSync, isTouchFirstSync } from '../../lib/responsive';

// The two tools a mode starts on; each editor's own tool union has both.
type StartTool = 'select' | 'pan';

export function modeDefaultTool(mobile: boolean): StartTool {
  return mobile ? 'pan' : 'select';
}

/** Whether the editor starts on Hand here: a phone, or a touch-first screen. Read from the media queries each time. */
export const startsOnHand = (): boolean => isMobileViewportSync() || isTouchFirstSync();

/** The tool a held tool is put down to (a template's scaffold, Escape out of the format painter): the tool the editor
 *  starts with here, so a touch-first screen goes back to Hand. */
export const restingTool = (): StartTool => modeDefaultTool(startsOnHand());

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
    const tool = forcePan ? 'pan' : modeDefaultTool(startsOnHand());
    if (tool !== canvasTool) setCanvasTool(tool);
  }, [canvasTool, setCanvasTool, forcePan]);
}
