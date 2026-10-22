'use client';

import {
  DEFAULT_ROOM_DOOR,
  FURNITURE_FACE_SHADE,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  roomParts,
  type ShapeElement,
} from '@livepages/document';

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
  const parts = roomParts(width, height, element.roomDoor ?? DEFAULT_ROOM_DOOR);
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`Room${element.label ? `, ${element.label}` : ''}`}
      >
        {parts.map((p, i) => {
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
