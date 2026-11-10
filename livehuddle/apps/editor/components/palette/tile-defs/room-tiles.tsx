import {
  CORRIDOR_PRESET_TILES,
  DOOR_PRESET_TILES,
  ROOM_PRESET_TILES,
} from '../palette-floor-presets';
import {
  AvatarModeIcon,
  ChairIcon,
  DeskIcon,
  FenceIcon,
  AvatarPadIcon,
  DirectoryIcon,
  ElevatorIcon,
  StairsIcon,
  RoomIcon,
  RoomBuilderIcon,
  DoorIcon,
  WindowIcon,
  StageIcon,
  MeetingTableIcon,
  SofaIcon,
} from '@/components/palette/palette-icons';
import { SignpostIcon } from '../palette-icons-team';
import { HotDeskIcon, StandingDeskIcon } from '../palette-icons-workday';
import { PodiumIcon, StageCurtainsIcon } from '../palette-icons-venue';
import { BeanBagIcon, ReadingNookIcon } from '../palette-icons-social';
import { Glyph } from '@livehuddle/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Space pieces for getting around, sitting and building rooms: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const ROOM_TILES: PaletteTileDef[] = [
  {
    // Portal (docs/specs/009-elements/portal-element.md): step in here, come out of the portal it is linked to.
    // The tile id keeps its original 'door' word: ids are stable, since palette layouts and
    // search address tiles by them.
    id: 'tools:door',
    tileGroup: 'travel',
    blurb: 'Step through to its linked portal',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Portal',
    caption: 'Portal',
    description:
      'Click it, or walk your Avatar character into it, and you come out of the portal it is linked to. Link a pair from the element menu.',
    filled: true,
    action: { type: 'shape', kind: 'portal' },
    icon: (
      <Glyph size={18} units={18}>
        {/* The standing oval ring, with the far side showing through it. */}
        <ellipse cx="9" cy="9" rx="4.6" ry="7" />
        <ellipse cx="9" cy="9" rx="2.1" ry="3.6" strokeWidth="1.1" opacity="0.6" />
      </Glyph>
    ),
  },
  {
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md): Navigate, beside Portal and Chair, because all
    // three take somebody somewhere. This is the one that takes everybody.
    id: 'tools:focus-button',
    tileGroup: 'travel',
    blurb: 'Ask everyone to look here',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bring Focus',
    caption: 'Bring Focus',
    description:
      'Bring Focus. Press it and everyone else in the room is offered a jump to it, on your tab.',
    filled: true,
    action: { type: 'shape', kind: 'focus-button' },
    icon: (
      <Glyph size={18} units={24} strokeLinejoin="miter">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
      </Glyph>
    ),
  },
  {
    // Chair (docs/specs/009-elements/chair.md): Behaviour, because what it does only happens when
    // somebody interacts with it — here by walking an Avatar-mode character
    // into it rather than by pressing it.
    id: 'tools:chair',
    tileGroup: 'seating',
    blurb: 'A chair for Avatars to sit in',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Chair',
    caption: 'Chair',
    description:
      'Furniture for Avatar mode: walk your character into one and it sits down. Give the room a seating plan.',
    filled: true,
    action: { type: 'shape', kind: 'chair' },
    icon: <ChairIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Desk (docs/specs/009-elements/chair.md "Desk and sofa"): a chair pulled up to a desk with a
    // computer on it; whoever sits faces the screen.
    id: 'tools:desk',
    tileGroup: 'seating',
    blurb: 'A desk with a computer for an Avatar to sit at',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Desk',
    caption: 'Desk',
    description:
      'A desk with a computer and a chair for Avatar mode: walk your character in and it sits down facing the screen.',
    filled: true,
    action: { type: 'shape', kind: 'desk' },
    icon: <DeskIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Sofa (docs/specs/009-elements/chair.md "Desk and sofa"): two seats side by side.
    id: 'tools:sofa',
    tileGroup: 'seating',
    blurb: 'A two-seater sofa for Avatars',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Sofa',
    caption: 'Sofa',
    description:
      'A two-seater sofa for Avatar mode: walk your character in and it sits on the nearer cushion, room for two.',
    filled: true,
    action: { type: 'shape', kind: 'sofa' },
    icon: <SofaIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Fence (docs/specs/009-elements/fence.md): Avatar-mode characters cannot walk through one.
    id: 'tools:fence',
    tileGroup: 'rooms',
    blurb: 'A barrier Avatars cannot walk through',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fence',
    caption: 'Fence',
    description:
      'A fence Avatar-mode characters cannot cross. Join fences end to end to wall off an area: people can walk round it, not into it.',
    filled: true,
    action: { type: 'shape', kind: 'fence' },
    icon: <FenceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Avatar Pad (docs/specs/009-elements/avatar-pad.md): where everyone entering Avatar mode starts.
    id: 'tools:avatar-pad',
    tileGroup: 'travel',
    blurb: 'Where Avatars arrive',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Avatar Pad',
    caption: 'Avatar Pad',
    description:
      "The board's entrance for Avatar mode: everyone who starts walking appears on the pad, beamed in, rather than wherever they were looking.",
    filled: true,
    action: { type: 'shape', kind: 'avatar-pad' },
    icon: <AvatarPadIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Directory (docs/specs/009-elements/directory.md): every room in the space and who is in each, to walk or jump to.
    id: 'tools:directory',
    tileGroup: 'travel',
    blurb: 'Every room and who is in it',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Directory',
    caption: 'Directory',
    description:
      "A stand listing the space's rooms, stages and pods on every tab, with who is in each right now. Walk There or Go from it.",
    filled: true,
    action: { type: 'shape', kind: 'directory' },
    icon: <DirectoryIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Team pieces (docs/specs/009-elements/team-pieces.md): arrows to the nearest rooms, each a Walk There.
    id: 'tools:signpost',
    tileGroup: 'travel',
    blurb: 'Arrows to the nearest rooms',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Signpost',
    caption: 'Signpost',
    description:
      'A wooden signpost whose arrows name the three nearest rooms, pods and stages. Click an arrow to walk there.',
    filled: true,
    action: { type: 'shape', kind: 'signpost' },
    icon: <SignpostIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Elevator (docs/specs/009-elements/elevator.md): a lift between the space's tabs, its floors.
    id: 'tools:elevator',
    tileGroup: 'travel',
    blurb: 'Ride between floors (tabs)',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Elevator',
    caption: 'Elevator',
    description:
      "A lift between this space's tabs. Click it, or walk your character in, pick a floor and you step out of that floor's Elevator.",
    filled: true,
    action: { type: 'shape', kind: 'elevator' },
    icon: <ElevatorIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Stairs (docs/specs/009-elements/stairs.md): a flight to the floor (tab) above or below.
    id: 'tools:stairs',
    tileGroup: 'travel',
    blurb: 'Walk up or down a floor (tab)',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stairs',
    caption: 'Stairs',
    description:
      "A flight between this space's tabs. Click it, or walk your character on, pick Up or Down and climb to the Stairs on the next floor.",
    filled: true,
    action: { type: 'shape', kind: 'stairs' },
    icon: <StairsIcon size={TILE_GLYPH_PX} />,
  },
  {
    // The Avatar Selection Mode button (docs/specs/009-elements/mode-button.md "Only Avatar"): the one mode button
    // livehuddle keeps, in Travel after the Avatar Pad because it is how people walk into a Space. The id is unchanged:
    // palette layouts and search address tiles by it.
    id: 'tools:mode-avatar',
    tileGroup: 'travel',
    blurb: 'Walk a character around the canvas',
    caption: 'Avatar Button',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Avatar Mode Button',
    description:
      'A button that switches whoever presses it into Avatar mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'avatar' },
    // Avatar's OWN glyph, the one the Edit | Walk toggle's Walk and Search's Walk show for it.
    icon: <AvatarModeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Room (docs/specs/009-elements/office.md).
    id: 'tools:room',
    tileGroup: 'rooms',
    blurb: 'A room with walls and a doorway',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Room',
    caption: 'Room',
    description:
      'A room for a virtual office: walls Avatar-mode characters walk round, a doorway they walk through, and its name on the back wall. It goes in behind everything, so furniture stands on its floor.',
    filled: true,
    action: { type: 'shape', kind: 'room' },
    // Room presets (docs/specs/009-elements/office.md "Room presets"): six rooms to start from.
    variants: ROOM_PRESET_TILES,
    variantsHint: 'Start from a room, then resize, rename or recolour it.',
    icon: <RoomIcon size={TILE_GLYPH_PX} />,
  },
  {
    // The Room Builder (docs/specs/009-elements/room-builder.md): a room of any shape, wall by wall.
    id: 'tools:room-builder',
    tileGroup: 'rooms',
    blurb: 'Draw a room of any shape',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Room Builder',
    caption: 'Room Builder',
    description:
      'Draw a room wall by wall: click to place each corner, every wall snapped to 45 degrees, and click the first corner to close it. Hold Cmd or Ctrl to place a corner freely.',
    filled: true,
    action: { type: 'room-walls' },
    icon: <RoomBuilderIcon size={TILE_GLYPH_PX} />,
  },
  {
    // The Corridor (docs/specs/009-elements/corridor.md): a passage between rooms, its types as presets.
    id: 'tools:corridor',
    tileGroup: 'rooms',
    blurb: 'A passage between rooms',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Corridor',
    caption: 'Corridor',
    description:
      'A corridor to join rooms: walls down its sides that Avatar-mode characters walk between, open ends, and doors that snap onto its walls. It goes in behind everything, like a room.',
    filled: true,
    action: { type: 'shape', kind: 'corridor' },
    variants: CORRIDOR_PRESET_TILES,
    variantsHint: 'Pick a shape, then resize or rotate it to fit.',
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M4 2v18h18M10 2v12h12" />
      </Glyph>
    ),
  },
  {
    // Door (docs/specs/009-elements/room-builder.md "Door"): snaps onto any wall and lets characters through. Not
    // 'tools:door': the Portal tile kept that id.
    id: 'tools:wall-door',
    tileGroup: 'rooms',
    blurb: 'A way through any wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Door',
    caption: 'Door',
    description:
      'A door for any room or corridor wall, at any angle: drop it on a wall and it snaps on and turns to match, and Avatar-mode characters walk through it. Drag it along the wall to move it.',
    filled: true,
    action: { type: 'shape', kind: 'door' },
    // Door types (docs/specs/009-elements/room-builder.md "Door types"): a swing, double, sliding or revolving door.
    variants: DOOR_PRESET_TILES,
    variantsHint: 'Pick a door, then drop it on any wall.',
    icon: <DoorIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Window (docs/specs/009-elements/room-builder.md "Window"): snaps onto a wall as a Door does, lets light in, never
    // a way through.
    id: 'tools:window',
    tileGroup: 'rooms',
    blurb: 'Light through any wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Window',
    caption: 'Window',
    description:
      'A window for any room or corridor wall: drop it on a wall and it snaps on, turns to face in and casts a patch of light on the floor. The wall still blocks walking. Drag it along the wall to move it.',
    filled: true,
    action: { type: 'shape', kind: 'window' },
    icon: <WindowIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Stage (docs/specs/009-elements/office.md "Stage", docs/specs/012-collaboration/meeting-rooms-and-stage.md).
    id: 'tools:stage',
    tileGroup: 'rooms',
    blurb: 'A platform the whole tab hears',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stage',
    caption: 'Stage',
    description:
      'A raised platform: whoever stands on it is heard by the whole tab. It goes in behind everything, so chairs stand in front of it; choose who may speak from it in its menu.',
    filled: true,
    action: { type: 'shape', kind: 'stage' },
    icon: <StageIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:stage-curtains',
    tileGroup: 'rooms',
    blurb: 'Velvet drapes to frame a stage',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stage Curtains',
    caption: 'Stage Curtains',
    description:
      'Red velvet drapes and a pelmet to hang over a stage, open in the middle. Characters walk between and in front of them.',
    filled: true,
    action: { type: 'shape', kind: 'stage-curtains' },
    icon: <StageCurtainsIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:podium',
    tileGroup: 'rooms',
    blurb: 'A lectern to speak from',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Podium',
    caption: 'Podium',
    description:
      'A wooden lectern with a microphone, to stand on a stage. Characters walk round its foot.',
    filled: true,
    action: { type: 'shape', kind: 'podium' },
    icon: <PodiumIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Meeting Table (docs/specs/009-elements/office.md).
    id: 'tools:meeting-table',
    tileGroup: 'seating',
    blurb: 'A table with six seats round it',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Meeting Table',
    caption: 'Meeting Table',
    description:
      'A meeting table with six chairs for Avatar mode: walk your character in and it sits on the nearest seat, facing the table.',
    filled: true,
    action: { type: 'shape', kind: 'meeting-table' },
    icon: <MeetingTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:bean-bag',
    tileGroup: 'seating',
    blurb: 'A slouchy seat for one',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bean Bag',
    caption: 'Bean Bag',
    description: 'A coral bean bag for a breakout corner. Walk onto it to sink in; it seats one.',
    filled: true,
    action: { type: 'shape', kind: 'bean-bag' },
    icon: <BeanBagIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:reading-nook',
    tileGroup: 'seating',
    blurb: 'An armchair, a lamp and books',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Reading Nook',
    caption: 'Reading Nook',
    description:
      'A wingback armchair on a rug, with a side table of books and a floor lamp that glows on dark paper. Walk onto it to sit.',
    filled: true,
    action: { type: 'shape', kind: 'reading-nook' },
    icon: <ReadingNookIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:hot-desk',
    tileGroup: 'seating',
    blurb: 'Your name while you sit',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hot Desk',
    caption: 'Hot Desk',
    description: 'A desk anyone can take: sit at it and its card shows your name until you get up.',
    filled: true,
    action: { type: 'shape', kind: 'hot-desk' },
    icon: <HotDeskIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:standing-desk',
    tileGroup: 'seating',
    blurb: 'Work on your feet',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Standing Desk',
    caption: 'Standing Desk',
    description: 'A tall desk with a monitor. Walk up to it to work standing.',
    filled: true,
    action: { type: 'shape', kind: 'standing-desk' },
    icon: <StandingDeskIcon size={TILE_GLYPH_PX} />,
  },
];
