'use client';

// A Room's Walls and Floor as large picture tiles (docs/specs/009-elements/office.md "Glass walls", "Floors";
// docs/specs/008-canvas/space-quick-style.md): each a picture of that wall or floor big enough to read its pattern,
// with its name under it. The owner (2026-11-27): "Make the floor type items larger so I can actually see them, same
// with walls". Shared by the room's settings dialog, its element menu sections and the Quick Style panel.
//
// Walls sit in the same three columns as the floor types, so every tile is one size. The five floor types page three at a time in the workbench's PagedCarousel, as
// livedocuments' Page Design picker pages its designs, so every surface stays one height.

import { useId, type ReactNode } from 'react';
import {
  FLOOR_TILES,
  ROOM_FLOOR_COLOURS,
  ROOM_FLOOR_LABELS,
  ROOM_FLOORS,
  ROOM_WALLS,
  ROOM_WALLS_LABELS,
  type RoomFloor,
  type RoomWalls,
} from '@livehuddle/document';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';

const TILE =
  'group flex min-w-0 cursor-pointer flex-col gap-1 rounded-lg p-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const FRAME =
  'relative block aspect-[4/3] w-full overflow-hidden rounded-md ring-1 ring-slate-200 transition-shadow group-hover:ring-slate-400 dark:ring-slate-700 dark:group-hover:ring-slate-500';
const CHOSEN = 'ring-2 ring-brand-500 group-hover:ring-brand-500 dark:ring-brand-400';

/** How many floor types one carousel page shows. */
export const FLOOR_TILES_PER_PAGE = 3;

function LookTile({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={TILE}>
      <span className={`${FRAME} ${active ? CHOSEN : ''}`}>{children}</span>
      <span
        className={`truncate px-0.5 text-[11px] font-medium ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'}`}
      >
        {label}
      </span>
    </button>
  );
}

// --- Floor ------------------------------------------------------------------------------------------------------

// The picture's box, in the canvas px the floor's tiles are measured in, then each type scaled so two or more of its
// repeats show: a 32 px tile three or four times across, a 128 px concrete panel and a half.
const W = 120;
const H = 90;
export const FLOOR_SWATCH_LG_SCALE: Record<Exclude<RoomFloor, 'boards'>, number> = {
  tiles: 0.9,
  carpet: 1.5,
  stone: 0.7,
  concrete: 0.55,
};
// The canvas draws its marks faint over a whole room; at this size they need a little more to read.
const MARK_BOOST = 1.8;
// Floorboards: rows of planks, each row's seams offset from the last.
const PLANK_H = 15;
const BOARD_SEAMS = [34, 82, 18, 64, 108, 46];

/** A floor type in the room's own colour (its fill), drawn large. */
export function FloorPicture({ floor, fill }: { floor: RoomFloor; fill: string }) {
  const id = useId();
  const tile = floor === 'boards' ? null : FLOOR_TILES[floor];
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      data-floor-picture={floor}
    >
      <rect width={W} height={H} fill={fill} />
      {tile ? (
        <>
          <defs>
            <pattern
              id={id}
              width={tile.w}
              height={tile.h}
              patternUnits="userSpaceOnUse"
              patternTransform={`scale(${FLOOR_SWATCH_LG_SCALE[floor as Exclude<RoomFloor, 'boards'>]})`}
            >
              {tile.marks.map((m, i) => (
                <path
                  key={i}
                  d={m.d}
                  fill={m.light ? '#fff' : '#000'}
                  fillOpacity={Math.min(1, m.opacity * MARK_BOOST)}
                />
              ))}
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#${id})`} />
        </>
      ) : (
        <g>
          {Array.from({ length: Math.ceil(H / PLANK_H) }, (_, row) => {
            const y = row * PLANK_H;
            const seam = BOARD_SEAMS[row % BOARD_SEAMS.length]!;
            return (
              <g key={row}>
                <rect x={0} y={y} width={W} height={1} fill="#fff" fillOpacity={0.25} />
                <rect
                  x={0}
                  y={y + PLANK_H - 1}
                  width={W}
                  height={1}
                  fill="#000"
                  fillOpacity={0.22}
                />
                <rect x={seam} y={y} width={1} height={PLANK_H} fill="#000" fillOpacity={0.22} />
                <rect
                  x={(seam + 58) % W}
                  y={y}
                  width={1}
                  height={PLANK_H}
                  fill="#000"
                  fillOpacity={0.22}
                />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

export function RoomFloorTiles({
  floor,
  fill,
  heading,
  onSetFloor,
}: {
  floor: RoomFloor;
  fill: string | undefined;
  // The row's heading, beside the carousel's arrows.
  heading: ReactNode;
  onSetFloor: (floor: RoomFloor) => void;
}) {
  const colour = fill ?? ROOM_FLOOR_COLOURS[0]!.hex;
  return (
    <div data-room-floor-tiles="">
      <PagedCarousel
        items={ROOM_FLOORS}
        perPage={FLOOR_TILES_PER_PAGE}
        label="Floor types"
        heading={heading}
        gridClass="grid grid-cols-3 gap-1.5"
        initialIndex={ROOM_FLOORS.indexOf(floor)}
        renderItem={(f) => (
          <LookTile
            key={f}
            label={ROOM_FLOOR_LABELS[f]}
            active={floor === f}
            onClick={() => onSetFloor(f)}
          >
            <FloorPicture floor={f} fill={colour} />
          </LookTile>
        )}
      />
    </div>
  );
}

// --- Walls ------------------------------------------------------------------------------------------------------

/**
 * A corner of a room with the wall drawn large: Solid a cream wall you cannot see past, Glass panes in a frame with
 * somebody standing behind them, which is the point of glass (you see who is in the meeting).
 */
export function WallsPicture({ walls, fill }: { walls: RoomWalls; fill: string }) {
  const glass = walls === 'glass';
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      data-walls-picture={walls}
    >
      {/* Beyond the walls: a pale room, and somebody in it, hidden by a solid wall. */}
      <rect width={W} height={H} fill="#eef2f6" />
      {glass ? (
        <g fill="#64748b">
          <circle cx={70} cy={26} r={6} />
          <path d="M60 56 c0-12 4-20 10-20 s10 8 10 20z" />
        </g>
      ) : null}
      {/* The floor in the room's colour. */}
      <path d={`M0 ${H} L0 72 L22 56 L${W} 56 L${W} ${H} Z`} fill={fill} />
      {/* The back wall and the side wall. */}
      {glass ? (
        <g>
          <path d={`M22 10 H${W} V56 H22 Z`} fill="#bae6fd" fillOpacity={0.35} />
          <path d="M0 22 L22 10 L22 56 L0 72 Z" fill="#bae6fd" fillOpacity={0.45} />
          <g stroke="#5b7f93" strokeWidth={1.6} fill="none">
            <path d={`M22 10 H${W} M22 56 H${W} M22 10 V56 M54 10 V56 M86 10 V56`} />
            <path d="M0 22 L22 10 M0 72 L22 56 M11 16 V64" />
          </g>
          <g stroke="#fff" strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round">
            <path d="M30 44 L44 20 M36 48 L46 31 M94 44 L106 22" />
          </g>
        </g>
      ) : (
        <g>
          <path d={`M22 10 H${W} V56 H22 Z`} fill="#ece5d8" />
          <path d="M0 22 L22 10 L22 56 L0 72 Z" fill="#d9d0bf" />
          <path d={`M22 10 H${W} V14 H22 Z`} fill="#c9bfab" />
          <path d={`M22 52 H${W} V56 H22 Z`} fill="#b9ae98" />
          <path d={`M22 10 V56`} stroke="#a89d86" strokeWidth={1} />
        </g>
      )}
    </svg>
  );
}

export function RoomWallsTiles({
  walls,
  fill,
  onSetWalls,
}: {
  walls: RoomWalls;
  fill: string | undefined;
  onSetWalls: (walls: RoomWalls) => void;
}) {
  const colour = fill ?? ROOM_FLOOR_COLOURS[0]!.hex;
  return (
    <div className="grid grid-cols-3 gap-1.5 p-1" data-room-walls-tiles="">
      {ROOM_WALLS.map((w) => (
        <LookTile
          key={w}
          label={ROOM_WALLS_LABELS[w]}
          active={walls === w}
          onClick={() => onSetWalls(w)}
        >
          <WallsPicture walls={w} fill={colour} />
        </LookTile>
      ))}
    </div>
  );
}
