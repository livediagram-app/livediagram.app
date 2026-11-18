'use client';

import {
  DEFAULT_ROOM_DOOR,
  isGlassRoom,
  rectPath,
  roomFloorArea,
  roomFloorOf,
  ROOM_BACK_FACE,
  roomBackParts,
  roomSideParts,
  roomParts,
  type FurniturePart,
  type ShapeElement,
} from '@livehuddle/document';
import { LitParts } from './furniture-paint';
import { useRoomBackDoors } from './back-wall-doors-store';
import { OutlinedRoomView } from './RoomBuilderViews';
import { GlassRoomView } from './WindowView';
import { RoomFloorPattern } from './RoomFloorPattern';

// A room (docs/specs/009-elements/office.md "Room"): a floor in the element's fill, the back wall standing up
// with the room's name on it (the element's own label, which sits in the wall's face), the side and front walls
// as bars, and a doorway with a mat. Drawn at the element's own size, never scaled, so the walls keep their
// thickness however big the room is. The walls also block Avatar-mode walking (lib/avatar-fence.ts). A Door on the back
// wall breaks its band at the doorway while open and stands in its face while shut (room-builder.md "On a back wall").
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
  const backDoors = useRoomBackDoors(element.id);
  // A room with glass walls (docs/specs/009-elements/office.md "Glass walls"), whatever its shape.
  if (isGlassRoom(element))
    return (
      <GlassRoomView
        element={element}
        stroke={stroke}
        floor={floor}
        animClass={animClass}
        backDoors={backDoors}
      />
    );
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
  // Its floor type (office.md "Floors"): Floorboards are its own parts, another type a pattern laid on its floor.
  const type = roomFloorOf(element);
  const area = roomFloorArea(width, height);
  return (
    <SizedPieceView
      parts={roomParts(
        width,
        height,
        element.roomDoor ?? DEFAULT_ROOM_DOOR,
        backDoors,
        type === 'boards',
        false,
      )}
      width={width}
      height={height}
      stroke={stroke}
      floor={floor}
      animClass={animClass}
      label={`Room${element.label ? `, ${element.label}` : ''}`}
      onFloor={<RoomFloorPattern floor={type} d={rectPath(area.x, area.y, area.w, area.h)} />}
      after={
        <>
          {/* Its walls as the plan draws them, which the 3D view stands up instead: there, plain floor lies under the
            back wall's face, so every wall is the same and none pokes past the standing ones (3d-view.md "What it
            shows"). */}
          <g data-room-back="">
            <LitParts
              parts={[
                ...roomBackParts(width, element.roomDoor ?? DEFAULT_ROOM_DOOR, backDoors),
                ...roomSideParts(width, height, element.roomDoor ?? DEFAULT_ROOM_DOOR),
              ]}
              seat={floor}
              stroke={stroke}
            />
          </g>
          <rect
            data-room-back-floor=""
            x={0}
            y={0}
            width={width}
            height={ROOM_BACK_FACE}
            fill={floor}
          />
        </>
      }
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
  onFloor,
  after,
}: {
  parts: readonly FurniturePart[];
  width: number;
  height: number;
  stroke: string;
  floor: string;
  animClass?: string;
  label: string;
  // What lies on its floor, drawn over its first part (a room's floor pattern).
  onFloor?: React.ReactNode;
  // What is drawn over every part (a room's back wall).
  after?: React.ReactNode;
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
        {onFloor ? (
          <>
            <LitParts parts={parts.slice(0, 1)} seat={floor} stroke={stroke} />
            {onFloor}
            <LitParts parts={parts.slice(1)} seat={floor} stroke={stroke} />
          </>
        ) : (
          <LitParts parts={parts} seat={floor} stroke={stroke} />
        )}
        {after}
      </svg>
    </div>
  );
}
