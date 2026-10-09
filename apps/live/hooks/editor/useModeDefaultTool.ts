'use client';

// The canvas tool a mode starts with (docs/specs/007-editor/editor-modes.md "The tool a mode starts
// with"): Select in every mode, Hand in Plan (a board's cards take the pointer themselves), and Hand
// on a phone, where a drag should move the canvas. Picked whenever the mode changes, the first
// mode included; any tool can be picked after. Plan also leaves Eraser and Format out
// (docs/specs/026-plan/plan-mode.md): either falls back to Hand if it is ever the tool there.
import { useEffect, useRef } from 'react';
import type { EditorMode } from '@livediagram/document';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@/lib/responsive';

export const PLAN_LEFT_OUT_TOOLS: ReadonlySet<string> = new Set(['eraser', 'format']);

export function modeDefaultTool(mode: EditorMode, mobile: boolean): CanvasTool {
  return mobile || mode === 'plan' ? 'pan' : 'select';
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
      const tool = forcePan ? 'pan' : modeDefaultTool(mode, isMobileViewportSync());
      if (tool !== canvasTool) setCanvasTool(tool);
      return;
    }
    if (mode === 'plan' && PLAN_LEFT_OUT_TOOLS.has(canvasTool)) setCanvasTool('pan');
  }, [mode, canvasTool, setCanvasTool, forcePan]);
}
