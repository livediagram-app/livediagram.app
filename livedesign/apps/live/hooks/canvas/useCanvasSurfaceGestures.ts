import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  useCanvasSurfaceGestures as useSurfaceGestures,
  type CanvasSurfaceGestureArgs,
  type CanvasSurfaceGestureOptions,
} from '@liveworkspace/workbench/hooks/canvas/useCanvasSurfaceGestures';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useSpotlight } from '@liveworkspace/workbench/hooks/canvas/useSpotlight';

// A press inside a portal (a row's menu from the phone's photo Layers sheet, which lives under <main> in the React
// tree) reaches the canvas's bubble handler through React's tree, not the DOM's. It is not the canvas's: focusing
// the canvas pulled focus out of the menu, which closed it before its item's click, so Rename on a layer did nothing.
const SURFACE_OPTIONS: CanvasSurfaceGestureOptions = { ignorePortalPresses: true };

// How presses on the bare canvas surface route between the tools (docs/specs/008-canvas/canvas-and-palette.md),
// the Eraser's included: the workbench's hooks/canvas/useCanvasSurfaceGestures, bound to this editor's canvas
// types. Canvas mounts the returned handlers verbatim.
export function useCanvasSurfaceGestures(
  args: Omit<CanvasSurfaceGestureArgs, 'canvasTool'> & {
    canvasTool: CanvasProps['canvasTool'];
    pendingDraw: CanvasProps['pendingDraw'];
    spotlight: ReturnType<typeof useSpotlight>;
    // Starts the queued draw-to-size / freehand gesture; true when it claimed the press (see useCanvasDrawGesture).
    beginPendingDrawGesture: (e: ReactPointerEvent) => boolean;
    // A mode that owns every primary press on the canvas while it is open (a path's edit mode,
    // docs/specs/023-draw-mode/path-tool.md "Editing"); true when it claimed the press.
    interceptPress?: (e: ReactPointerEvent) => boolean;
    onEraseStart?: CanvasProps['onEraseStart'];
  },
) {
  return useSurfaceGestures(args, SURFACE_OPTIONS);
}
