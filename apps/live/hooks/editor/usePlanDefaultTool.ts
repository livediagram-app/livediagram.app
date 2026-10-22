'use client';

// The canvas tool Plan starts with (docs/specs/026-plan/plan-mode.md "The tools"): Hand, since a board's cards take
// the pointer themselves; any tool can be picked after. Plan leaves Eraser and Format out: either falls back to Hand if
// it is ever the tool.
import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';

export const PLAN_LEFT_OUT_TOOLS: ReadonlySet<string> = new Set(['eraser', 'format']);

export function usePlanDefaultTool(
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool) => void,
): void {
  const started = useRef(false);
  useEffect(() => {
    const first = !started.current;
    started.current = true;
    if ((first || PLAN_LEFT_OUT_TOOLS.has(canvasTool)) && canvasTool !== 'pan')
      setCanvasTool('pan');
  }, [canvasTool, setCanvasTool]);
}
