'use client';

import {
  DEFAULT_ROOM_DOOR,
  isGlassRoom,
  roomParts,
  type FurniturePart,
  type ShapeElement,
} from '@livehuddle/document';
import { FurniturePartView } from './FurnitureView';
import { OutlinedRoomView } from './RoomBuilderViews';
import { GlassRoomView } from './WindowView';

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
  // A room with glass walls (docs/specs/009-elements/office.md "Glass walls"), whatever its shape.
  if (isGlassRoom(element))
    return <GlassRoomView element={element} stroke={stroke} floor={floor} animClass={animClass} />;
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
 * An office piece drawn at its own size (a room, a stage): its parts in its own px through the furniture's painter
 * (FurniturePartView), the floor and uncoloured panels in the element's fill, a part's own colour where it has one (a
 * stage's nosing, skirt and footlights), outlines and rails in its stroke, a face shaded with the stroke.
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
        {parts.map((p, i) => (
          <FurniturePartView key={i} part={p} seat={floor} stroke={stroke} />
        ))}
      </svg>
    </div>
  );
}
