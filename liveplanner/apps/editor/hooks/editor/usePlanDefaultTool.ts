'use client';

// The canvas tool Plan starts with (docs/specs/026-plan/plan-mode.md "Tools"): Hand, since a board's cards take
// the pointer themselves.
import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';

export function usePlanDefaultTool(
  canvasTool: CanvasTool,
  setCanvasTool: (tool: CanvasTool) => void,
): void {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (canvasTool !== 'pan') setCanvasTool('pan');
  }, [canvasTool, setCanvasTool]);
}
