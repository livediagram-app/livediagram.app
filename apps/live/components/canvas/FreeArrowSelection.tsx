import type { PointerEvent as ReactPointerEvent } from 'react';
import type { FrameHandle } from '@livediagram/document';
import type { DragMode } from '@/lib/canvas';
import { handlePressStarts } from '@/lib/double-press';
import { EdgeResizeHandle, ResizeHandles } from './element-parts';

// Clearance between the arrow's drawn route and its frame, in canvas px: enough
// that the edge handles sit clear of the endpoint grips.
export const MOVE_FRAME_PAD_PX = 20;
// An axis narrower than this has nothing to scale (a horizontal arrow is flat).
const FLAT_PX = 0.5;
// Width of the grab band along each side of the frame, in screen px.
export const MOVE_FRAME_HIT_PX = 10;

const EDGES = ['n', 'e', 's', 'w'] as const;

// The selection frame of a free arrow (docs/specs/008-canvas/arrow-bending.md "Moving a free
// arrow"). It is a box's selection, on purpose: the same brand ring and the
// same corner and edge handles, from the same components. The handles scale
// the arrow; the ring moves it, since dragging the arrow's line bends it. Only
// the ring and the handles take presses: the inside stays click-through, so
// whatever sits within the frame is still reachable.
// Mounted in the canvas grips layer (SelectionGripsLayer), above every element.
export function FreeArrowSelection({
  arrowId,
  points,
  zoom,
  onBeginMove,
  onBeginScale,
}: {
  arrowId: string;
  // The arrow's drawn route; the frame hugs its bounding box.
  points: { x: number; y: number }[];
  zoom: number;
  onBeginMove: (e: ReactPointerEvent) => void;
  onBeginScale: (handle: FrameHandle, e: ReactPointerEvent) => void;
}) {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs) - MOVE_FRAME_PAD_PX;
  const top = Math.min(...ys) - MOVE_FRAME_PAD_PX;
  const width = Math.max(...xs) - Math.min(...xs) + MOVE_FRAME_PAD_PX * 2;
  const height = Math.max(...ys) - Math.min(...ys) + MOVE_FRAME_PAD_PX * 2;
  // Edge handles only where the axis has extent to scale.
  const flatX = Math.max(...xs) - Math.min(...xs) < FLAT_PX;
  const flatY = Math.max(...ys) - Math.min(...ys) < FLAT_PX;
  const edges = EDGES.filter((a) => (a === 'e' || a === 'w' ? !flatX : !flatY));
  // The handles report a box resize mode (`resize-se`); the arrow scales.
  const scale = (_id: string, mode: DragMode, e: ReactPointerEvent) =>
    onBeginScale(mode.replace('resize-', '') as FrameHandle, e);
  const band = MOVE_FRAME_HIT_PX / zoom;
  const bandStyle = {
    n: { left: 0, right: 0, top: -band / 2, height: band },
    s: { left: 0, right: 0, bottom: -band / 2, height: band },
    w: { top: 0, bottom: 0, left: -band / 2, width: band },
    e: { top: 0, bottom: 0, right: -band / 2, width: band },
  } as const;
  return (
    <div
      data-testid="arrow-move-frame"
      className="pointer-events-none absolute rounded ring-2 ring-brand-200"
      style={{ left, top, width, height }}
    >
      {EDGES.map((side) => (
        <div
          key={side}
          aria-label="Move arrow"
          role="button"
          className="pointer-events-auto absolute cursor-move"
          style={bandStyle[side]}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (handlePressStarts(arrowId, e)) onBeginMove(e);
          }}
        />
      ))}
      <ResizeHandles elementId={arrowId} zoom={zoom} onBeginDrag={scale} />
      {edges.map((a) => (
        <EdgeResizeHandle key={a} anchor={a} elementId={arrowId} zoom={zoom} onBeginDrag={scale} />
      ))}
    </div>
  );
}
