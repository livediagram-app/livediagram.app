import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  useCanvasSurfaceGestures as useSurfaceGestures,
  type CanvasSurfaceGestureArgs,
  type CanvasSurfaceGestureOptions,
} from '@liveworkspace/workbench/hooks/canvas/useCanvasSurfaceGestures';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

// A maximised or tab-filling Plan board covers the canvas (`data-canvas-cover`, docs/specs/026-plan/plan-board.md
// "Maximised board"): a press on it, or on the cover around it, is the board's or nothing, never a canvas gesture.
const SURFACE_OPTIONS: CanvasSurfaceGestureOptions = { ignoreCoverPresses: true };

// How presses on the bare canvas surface route between the tools (docs/specs/008-canvas/canvas-and-palette.md):
// the workbench's hooks/canvas/useCanvasSurfaceGestures, bound to this editor's canvas types. This editor has no
// Spotlight, Laser, Eraser or draw-to-size, so those branches never run here. Canvas mounts the returned handlers
// verbatim.
export function useCanvasSurfaceGestures(
  args: Omit<
    CanvasSurfaceGestureArgs,
    'canvasTool' | 'pendingDraw' | 'spotlight' | 'beginPendingDrawGesture' | 'onEraseStart'
  > & {
    canvasTool: CanvasProps['canvasTool'];
    // A tool that owns a primary press on the canvas; true when it claimed the press.
    interceptPress?: (e: ReactPointerEvent) => boolean;
  },
) {
  return useSurfaceGestures(args, SURFACE_OPTIONS);
}
