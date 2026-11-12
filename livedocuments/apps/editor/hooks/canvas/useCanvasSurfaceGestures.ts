import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  useCanvasSurfaceGestures as useSurfaceGestures,
  type CanvasSurfaceGestureArgs,
} from '@liveworkspace/workbench/hooks/canvas/useCanvasSurfaceGestures';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useSpotlight } from '@liveworkspace/workbench/hooks/canvas/useSpotlight';

// How presses on the bare canvas surface route between the tools (docs/specs/008-canvas/canvas-and-palette.md):
// the workbench's hooks/canvas/useCanvasSurfaceGestures, bound to this editor's canvas types. Canvas mounts the
// returned handlers verbatim.
export function useCanvasSurfaceGestures(
  args: Omit<CanvasSurfaceGestureArgs, 'canvasTool' | 'onEraseStart'> & {
    canvasTool: CanvasProps['canvasTool'];
    pendingDraw: CanvasProps['pendingDraw'];
    spotlight: ReturnType<typeof useSpotlight>;
    // Starts the queued draw-to-size gesture; true when it claimed the press (see useCanvasDrawGesture).
    beginPendingDrawGesture: (e: ReactPointerEvent) => boolean;
    // A tool that owns a primary press on the canvas (the Format tool on a page's paper); true when
    // it claimed the press.
    interceptPress?: (e: ReactPointerEvent) => boolean;
  },
) {
  return useSurfaceGestures(args);
}
