'use client';

import {
  doorParts,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  outlinedRoomPaths,
  ROOM_WALL,
  type ShapeElement,
} from '@livehuddle/document';

// A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md "The custom room"): the floor polygon
// in the element's fill and the walls a fixed ROOM_WALL thick along the outline, outlined in the stroke and mitred at
// the corners. Drawn at the element's own size so the walls keep their thickness. The walls also block walking
// (@liveworkspace/avatar collision, broken where a Door stands).
export function OutlinedRoomView({
  element,
  outline,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  outline: readonly { x: number; y: number }[];
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  const { floor: area, walls } = outlinedRoomPaths({ width, height, roomOutline: outline });
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`Room${element.label ? `, ${element.label}` : ''}`}
      >
        <path d={area} fill={floor} />
        <path
          d={walls}
          fill="none"
          stroke={stroke}
          strokeWidth={ROOM_WALL + 2 * FURNITURE_PANEL_STROKE}
          strokeLinejoin="miter"
        />
        <path d={walls} fill="none" stroke={floor} strokeWidth={ROOM_WALL} strokeLinejoin="miter" />
      </svg>
    </div>
  );
}

// A Door (docs/specs/009-elements/room-builder.md "Door"): the gap it paints over its wall in the floor's colour, a
// jamb at each end, the leaf standing open and its swing arc. Turned onto its wall by the element's rotation.
export function DoorView({
  element,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  const { gap, jambs, leaf, swing } = doorParts(width, height);
  const box = (b: { x: number; y: number; w: number; h: number }) => ({
    x: b.x,
    y: b.y,
    width: b.w,
    height: b.h,
  });
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label="Door"
      >
        <rect {...box(gap)} fill={floor} />
        {jambs.map((j, i) => (
          <rect
            key={i}
            {...box(j)}
            fill={floor}
            stroke={stroke}
            strokeWidth={FURNITURE_PANEL_STROKE}
          />
        ))}
        <path
          d={swing}
          fill="none"
          stroke={stroke}
          strokeWidth={FURNITURE_RAIL_STROKE}
          opacity={FURNITURE_RAIL_OPACITY}
          strokeDasharray="4 4"
        />
        <rect
          {...box(leaf)}
          rx={1}
          fill={floor}
          stroke={stroke}
          strokeWidth={FURNITURE_PANEL_STROKE}
        />
      </svg>
    </div>
  );
}
