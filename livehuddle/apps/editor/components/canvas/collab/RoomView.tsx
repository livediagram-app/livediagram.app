'use client';

import {
  DEFAULT_ROOM_DOOR,
  FURNITURE_FACE_SHADE,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  roomParts,
  type FurniturePart,
  type ShapeElement,
} from '@livehuddle/document';
import { OutlinedRoomView } from './RoomBuilderViews';

// A room (docs/specs/009-elements/office.md "Room"): a floor in the element's fill, the back wall standing up
// with the room's name on it (the element's own label, which sits in the wall's face), the side and front walls
// as bars, and a doorway with a mat. Drawn at the element's own size, never scaled, so the walls keep their
// thickness however big the room is. The walls also block Avatar-mode walking (lib/avatar-fence.ts).
export function RoomView({
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
  // A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md) is its outline.
  if (element.roomOutline && element.roomOutline.length >= 3)
    return (
      <OutlinedRoomView
        element={element}
        outline={element.roomOutline}
        stroke={stroke}
        floor={floor}
        animClass={animClass}
      />
    );
  return (
    <SizedPieceView
      parts={roomParts(width, height, element.roomDoor ?? DEFAULT_ROOM_DOOR)}
      width={width}
      height={height}
      stroke={stroke}
      floor={floor}
      animClass={animClass}
      label={`Room${element.label ? `, ${element.label}` : ''}`}
    />
  );
}

/**
 * An office piece drawn at its own size (a room, a stage): its parts in its own px, the floor and panels in the
 * element's fill, outlines and rails in its stroke, a face shaded with the stroke so it reads as standing up.
 */
export function SizedPieceView({
  parts,
  width,
  height,
  stroke,
  floor,
  animClass,
  label,
}: {
  parts: readonly FurniturePart[];
  width: number;
  height: number;
  stroke: string;
  floor: string;
  animClass?: string;
  label: string;
}) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        {parts.map((p, i) => {
          if (p.tag === 'path') {
            // A plank line: a rail, never filled.
            return (
              <path
                key={i}
                d={p.d}
                fill="none"
                stroke={stroke}
                strokeWidth={FURNITURE_RAIL_STROKE}
                opacity={FURNITURE_RAIL_OPACITY}
                strokeLinecap="round"
              />
            );
          }
          if (p.tag !== 'rect') return null;
          const box = { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx };
          if (p.role === 'floor') return <rect key={i} {...box} fill={floor} />;
          if (p.role === 'rail')
            return (
              <rect
                key={i}
                {...box}
                fill="none"
                stroke={stroke}
                strokeWidth={FURNITURE_RAIL_STROKE}
                opacity={FURNITURE_RAIL_OPACITY}
              />
            );
          return (
            <g key={i}>
              <rect {...box} fill={floor} stroke={stroke} strokeWidth={FURNITURE_PANEL_STROKE} />
              {p.role === 'face' ? (
                <rect {...box} fill={stroke} opacity={FURNITURE_FACE_SHADE} />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
