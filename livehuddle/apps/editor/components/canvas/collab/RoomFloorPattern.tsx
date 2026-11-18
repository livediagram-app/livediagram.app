'use client';

import { useId } from 'react';
import { FLOOR_TILES, type RoomFloor } from '@livehuddle/document';

/**
 * A room's floor pattern over its floor area (docs/specs/009-elements/office.md "Floors"): the tile room-floors.ts
 * describes, as an SVG pattern in the room's own px, laid over its fill; nothing for Floorboards (the room's own
 * boards). The export draws the same (roomFloorSvg).
 */
export function RoomFloorPattern({ floor, d }: { floor: RoomFloor; d: string }) {
  const id = useId();
  if (floor === 'boards' || !d) return null;
  const t = FLOOR_TILES[floor];
  return (
    <>
      <defs>
        <pattern id={id} width={t.w} height={t.h} patternUnits="userSpaceOnUse">
          {t.marks.map((m, i) => (
            <path key={i} d={m.d} fill={m.light ? '#fff' : '#000'} fillOpacity={m.opacity} />
          ))}
        </pattern>
      </defs>
      <path d={d} fill={`url(#${id})`} data-room-floor={floor} />
    </>
  );
}
