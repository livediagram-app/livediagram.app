import { Glyph } from '@livehuddle/ui';
import type { ShapeKind } from '@livehuddle/document';
import type { PaletteTileDef } from './palette-tile-defs';

// The floor pieces' presets the Rooms category's tiles open (docs/specs/009-elements/office.md "Room presets" and "Rug
// types", corridor.md, room-builder.md "Door types"), as the Card's and the Badge's open theirs
// (palette-element-presets.tsx): each an ordinary tile carrying its variant, which places, drags and previews as its
// tile does. Not in PALETTE_TILES: they live under their tile, so the category's tile count and Search keep the one
// Room, Corridor, Door and Rug.

const preset =
  (kind: ShapeKind, id: string, noun: string) =>
  (
    variant: string | undefined,
    caption: string,
    blurb: string,
    description: string,
    icon: React.ReactNode,
  ): PaletteTileDef => ({
    id: `tools:${id}${variant ? `-${variant}` : ''}`,
    section: 'tools',
    toolGroup: 'behaviour',
    tileGroup: 'rooms',
    caption,
    label: `Add ${caption}${noun && !caption.endsWith(noun) ? ` ${noun}` : ''}`,
    blurb,
    description,
    filled: true,
    action: { type: 'shape', kind, ...(variant ? { variant } : {}) },
    icon: (
      <Glyph size={18} units={24}>
        {icon}
      </Glyph>
    ),
  });

const room = preset('room', 'room', '');

export const ROOM_PRESET_TILES: readonly PaletteTileDef[] = [
  room(
    undefined,
    'Room',
    'Four walls and a door, 480 by 320',
    'A room for a meeting or a team: four walls, a door in the front wall, and its name on the back wall.',
    <>
      <path d="M10 19H3V5h18v14h-7" />
      <path d="M3 8.5h18" />
    </>,
  ),
  room(
    'office',
    'Office',
    'A small room for one or two',
    'A small office for one or two desks: a room 280 by 220 with its door in the front wall.',
    <>
      <path d="M10.5 18H5V7h14v11h-5.5" />
      <path d="M5 9.5h14" />
      <rect x="8" y="12" width="5" height="2.5" rx="0.6" />
    </>,
  ),
  room(
    'boardroom',
    'Boardroom',
    'A long room round a big table',
    'A boardroom: a long room, 800 by 400, with space for a big table down the middle and its door in the front wall.',
    <>
      <path d="M9.5 18H1.5V7h21v11h-8" />
      <path d="M1.5 9.5h21" />
      <rect x="6" y="12" width="12" height="2.5" rx="1.25" />
    </>,
  ),
  room(
    'open-plan',
    'Open Plan',
    'An L of floor with a wing',
    'An open-plan floor shaped like an L: a wide space along the top and a wing down the left, its door in the wing.',
    <>
      <path d="M5.5 20H3V4h18v9H11v7H8.5" />
      <path d="M14 7h4M14 9.5h4" opacity="0.5" />
    </>,
  ),
  room(
    'kitchen',
    'Kitchen',
    'A corner cut at 45 degrees',
    'A kitchen with its front corner cut at 45 degrees and the door in the cut, ready for a counter along the back.',
    <>
      <path d="M16.5 18.5 15 20H3V4h18v10l-1.5 1.5" />
      <path d="M5.5 6.5h13v2.5h-13z" opacity="0.5" />
    </>,
  ),
  room(
    'lounge',
    'Lounge',
    'An octagon to gather in',
    'A lounge with eight equal walls, 440 across: a room to gather in, its door in the front wall.',
    <>
      <path d="M10 21H8.5L3 15.5v-7L8.5 3h7L21 8.5v7L15.5 21H14" />
      <circle cx="12" cy="12" r="3" opacity="0.5" />
    </>,
  ),
];

const corridor = preset('corridor', 'corridor', 'Corridor');

export const CORRIDOR_PRESET_TILES: readonly PaletteTileDef[] = [
  corridor(
    undefined,
    'Straight',
    'One run, open at both ends',
    'A straight corridor, open at both ends: walls down its long sides, doors snap onto them. Drag it tall to run up and down.',
    <>
      <path d="M2 7.5h20M2 16.5h20" />
      <path d="M6 12h12" strokeDasharray="2 2.5" opacity="0.5" />
    </>,
  ),
  corridor(
    'corner',
    'Corner',
    'Two arms round a corner',
    'A corridor turning a corner: open at both arms, walls round the outside and the inside of the bend. Rotate it to face any way.',
    <>
      <path d="M4 2v18h18M10 2v12h12" />
      <path d="M7 3.5V17h13" strokeDasharray="2 2.5" opacity="0.5" />
    </>,
  ),
  corridor(
    'tee',
    'T-Junction',
    'A run with an arm off it',
    'A T-junction: a run across the top, open at both ends, and an arm down the middle, open at its foot.',
    <>
      <path d="M2 4h20M2 10h7v12M22 10h-7v12" />
      <path d="M3.5 7h17M12 7v13.5" strokeDasharray="2 2.5" opacity="0.5" />
    </>,
  ),
  corridor(
    'cross',
    'Crossroads',
    'Two runs crossing',
    'A crossroads: two corridors crossing in the middle, open at all four ends, a wall round each inside corner.',
    <>
      <path d="M9 2v7H2M15 2v7h7M9 22v-7H2M15 22v-7h7" />
      <path d="M12 3.5v17M3.5 12h17" strokeDasharray="2 2.5" opacity="0.5" />
    </>,
  ),
];

const door = preset('door', 'wall-door', 'Door');

export const DOOR_PRESET_TILES: readonly PaletteTileDef[] = [
  door(
    undefined,
    'Door',
    'One leaf on a hinge',
    'A door on a hinge for any room or corridor wall: drop it on a wall and it snaps on and turns to match.',
    <>
      <path d="M2 15h4M16 15h6" />
      <path d="M6 15V5" />
      <path d="M6 5a10 10 0 0 1 10 10" strokeDasharray="2 2" />
    </>,
  ),
  door(
    'double',
    'Double Door',
    'Two leaves, a wide way in',
    'A double door, 144 wide: two leaves hinged at either side that meet in the middle, for a grand entrance or a hall.',
    <>
      <path d="M1 15h3M20 15h3" />
      <path d="M4 15V7M20 15V7" />
      <path d="M4 7a8 8 0 0 1 8 8M20 7a8 8 0 0 0-8 8" strokeDasharray="2 2" />
    </>,
  ),
  door(
    'sliding',
    'Sliding Door',
    'Glass panes that slide apart',
    'A sliding door, 120 wide: two glass panes on a track that slide into the wall either side as it opens.',
    <>
      <path d="M1 12h3M20 12h3" />
      <rect x="3" y="10.5" width="7.5" height="3" rx="0.8" />
      <rect x="13.5" y="10.5" width="7.5" height="3" rx="0.8" />
      <path d="M9 17.5H5l1.5-1.5M5 17.5 6.5 19M15 17.5h4L17.5 16M19 17.5 17.5 19" />
    </>,
  ),
  door(
    'revolving',
    'Revolving Door',
    'A glass drum with four wings',
    'A revolving door: a glass drum with four wings, for a lobby or an entrance. Open, its wings stand at an angle; shut, they square up and seal it.',
    <>
      <path d="M1 12h3.5M19.5 12H23" />
      <path d="M6.86 18.13A8 8 0 0 1 6.86 5.87M17.14 5.87A8 8 0 0 1 17.14 18.13" />
      <path d="M7.4 7.4l9.2 9.2M16.6 7.4l-9.2 9.2" />
    </>,
  ),
];

const rug = preset('rug', 'rug', 'Rug');

export const RUG_PRESET_TILES: readonly PaletteTileDef[] = [
  rug(
    undefined,
    'Oval',
    'An oval with rings',
    'An oval rug with rings, under a sofa or a coffee table. It lies on the floor under the furniture.',
    <>
      <ellipse cx="12" cy="12" rx="10" ry="6.5" />
      <ellipse cx="12" cy="12" rx="6" ry="3.5" />
    </>,
  ),
  rug(
    'round',
    'Round',
    'A circle with a braided edge',
    'A round rug with a braided edge and rings to the middle: a reading corner or under a round table.',
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="7.5" strokeDasharray="1.5 1.5" />
      <circle cx="12" cy="12" r="3.5" />
    </>,
  ),
  rug(
    'bordered',
    'Bordered',
    'A wide border round a plain field',
    'A rectangular rug with a wide border band round a plain field: the classic area rug for a lounge.',
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <rect x="6" y="8.5" width="12" height="7" rx="0.8" />
    </>,
  ),
  rug(
    'runner',
    'Runner',
    'Long and narrow, with a fringe',
    'A runner: a long narrow rug with banded ends, a row of diamonds and a fringe, for a hall or a corridor.',
    <>
      <rect x="3" y="9" width="18" height="6" rx="0.8" />
      <path d="M1 10.5h2M1 13.5h2M21 10.5h2M21 13.5h2" />
      <path d="M9 12l1.5-1.5L12 12l-1.5 1.5zM12 12l1.5-1.5L15 12l-1.5 1.5z" />
    </>,
  ),
  rug(
    'striped',
    'Striped',
    'Bold stripes across it',
    'A striped rug in bold bands across it, to brighten a breakout area.',
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1" />
      <path d="M6.5 5v14M10.5 5v14M14.5 5v14M18.5 5v14" />
    </>,
  ),
  rug(
    'persian',
    'Persian',
    'A medallion and a double border',
    'A Persian rug: a medallion in the middle, corner spandrels, a double border and a fringe, in crimson and navy.',
    <>
      <rect x="3" y="5" width="18" height="14" rx="0.8" />
      <rect x="5.5" y="7.5" width="13" height="9" rx="0.5" />
      <path d="M12 9l3 3-3 3-3-3z" />
      <path d="M1 7.5h2M1 12h2M1 16.5h2M21 7.5h2M21 12h2M21 16.5h2" />
    </>,
  ),
  rug(
    'kilim',
    'Kilim',
    'Rows of stepped diamonds',
    'A kilim: rows of woven diamonds in terracotta between banded edges.',
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="0.8" />
      <path d="M2.5 12l3-3.5 3 3.5 3-3.5 3 3.5 3-3.5 3 3.5" />
      <path d="M2.5 15.5h19" opacity="0.5" />
    </>,
  ),
  rug(
    'doormat',
    'Doormat',
    'A small coir mat for a door',
    'A small coir doormat, 120 by 72, for in front of a door or a reception.',
    <>
      <rect x="4" y="7" width="16" height="10" rx="2" />
      <path d="M7 10h10M7 12h10M7 14h10" />
    </>,
  ),
];
