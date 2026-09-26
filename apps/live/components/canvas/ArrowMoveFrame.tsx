import type { PointerEvent as ReactPointerEvent } from 'react';
import { BRAND_600 } from './arrow-handle-style';

// Clearance between the arrow's route and its frame, in canvas px.
export const MOVE_FRAME_PAD_PX = 12;
// Width of the grab band along the frame's edge.
export const MOVE_FRAME_HIT_PX = 10;

// The frame of a selected free arrow (docs/specs/008-canvas/arrow-bending.md "Moving a free
// arrow"). Dragging an arrow's line bends it, so an arrow attached to nothing
// moves by this frame instead. Only the frame's edge takes the press: its
// interior stays click-through, so whatever sits inside it is still reachable.
export function ArrowMoveFrame({
  points,
  onPress,
}: {
  // The arrow's drawn route; the frame hugs its bounding box.
  points: { x: number; y: number }[];
  onPress: (e: ReactPointerEvent) => void;
}) {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - MOVE_FRAME_PAD_PX;
  const y = Math.min(...ys) - MOVE_FRAME_PAD_PX;
  const width = Math.max(...xs) - Math.min(...xs) + MOVE_FRAME_PAD_PX * 2;
  const height = Math.max(...ys) - Math.min(...ys) + MOVE_FRAME_PAD_PX * 2;
  return (
    <g data-testid="arrow-move-frame">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill="none"
        stroke={BRAND_600}
        strokeWidth={1}
        strokeDasharray="4 3"
        style={{ pointerEvents: 'none' }}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill="none"
        stroke="transparent"
        strokeWidth={MOVE_FRAME_HIT_PX}
        aria-label="Move arrow"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          onPress(e);
        }}
        style={{ pointerEvents: 'stroke', cursor: 'move' }}
      />
    </g>
  );
}
