import {
  CORRIDOR_PRESET_TILES,
  DOOR_PRESET_TILES,
  ROOM_PRESET_TILES,
  RUG_PRESET_TILES,
} from './palette-floor-presets';

import type { ComponentKind, SelectionMode, ShapeKind } from '@livehuddle/document';
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
  PlantIcon,
  BookshelfIcon,
  WaterCoolerIcon,
  CoffeeMachineIcon,
  RugIcon,
  SofaIcon,
} from '@/components/palette/palette-icons';
import { SPACE_CATEGORIES, type SpaceTileGroup } from './space-categories';
import {
  BarIcon,
  BarStoolIcon,
  DrinksCabinetIcon,
  DrinksFridgeIcon,
  GardenFenceIcon,
  GardenPathIcon,
  GrassIcon,
  OfficePodIcon,
  OutdoorPlantIcon,
  TreeIcon,
} from './palette-icons-garden';
import { RoomSignIcon, ScreenIcon } from './palette-icons-meeting';
import {
  CalendarWallIcon,
  PhotoWallIcon,
  SignpostIcon,
  SuggestionBoxIcon,
} from './palette-icons-team';
import {
  HotDeskIcon,
  NapPodIcon,
  PetBedIcon,
  PhoneBoothIcon,
  ReceptionDeskIcon,
  StandingDeskIcon,
  TreadmillIcon,
  WeightBenchIcon,
} from './palette-icons-workday';
import {
  BikeRackIcon,
  CarParkIcon,
  ColumnIcon,
  PillarIcon,
  PodiumIcon,
  StageCurtainsIcon,
  SwimmingPoolIcon,
} from './palette-icons-venue';
import {
  CoatRackIcon,
  CopierIcon,
  FridgeIcon,
  HandDryerIcon,
  KettleIcon,
  KitchenCounterIcon,
  KitchenSinkIcon,
  LockersIcon,
  MicrowaveIcon,
  PrinterIcon,
  RestroomIcon,
  ToiletCubicleIcon,
  UmbrellaStandIcon,
  WashbasinIcon,
} from './palette-icons-amenities';
import {
  ArcadeMachineIcon,
  BeanBagIcon,
  BenchIcon,
  CampfireIcon,
  DartboardIcon,
  FireplaceIcon,
  FoosballTableIcon,
  FountainIcon,
  GardenUmbrellaIcon,
  HammockIcon,
  JukeboxIcon,
  NoticeBoardIcon,
  PicnicTableIcon,
  PingPongTableIcon,
  PondIcon,
  PoolTableIcon,
  ReadingNookIcon,
  StopwatchIcon,
  TimerPieceIcon,
  VendingMachineIcon,
  WorldClockIcon,
} from './palette-icons-social';
import {
  lucideCircle,
  lucideDiamond,
  lucideImage,
  lucideSquare,
  lucideStickyNote,
  lucideType,
} from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livehuddle/ui';
import { tileCaption } from './tile-caption';

// Every palette tile glyph is drawn at this size (docs/specs/004-interface-design/iconography.md), so a strip of
// tiles reads as one set.
export const TILE_GLYPH_PX = 18;

// Lucide's sticky-note as its two paths: the note body takes the paper fill, the corner fold does not.
const pathD = (i: number) => {
  const p = lucideStickyNote[i];
  if (p?.t !== 'path') throw new Error('lucideStickyNote: expected a path');
  return p.d;
};
const lucideStickyNotePaths = { body: pathD(0), fold: pathD(1) };

// The shared palette tile catalogue: every creation tile across the categories as one data
// entry — label, glyph, tinting flags, and an action descriptor that PaletteTileGrid maps to the
// editor's add-handlers. Every category body, Popular, the Toolbar strip and the Search panel
// render from this one catalogue (arranged per mode by palette-layouts.ts), so a tile is defined
// once and can never drift between the places it shows.
//
// Pure data: a flat catalogue, exempt from the file-size target (see
// AGENTS.md) — extend it in place rather than splitting it.

export type PaletteTileSection =
  | 'shapes'
  | 'tools'
  // 'collaborate' is GONE (docs/specs/010-palette/palette-top-level-categories.md), and the collaboration elements
  // with it (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").
  | 'media'
  | 'stickers';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  // `mode` is a creation-time choice, not a separate kind: a Mode button is ONE kind with a field, and the palette
  // offers a tile per choice (docs/specs/009-elements/mode-button.md) the way Media does for embed providers.
  | {
      type: 'shape';
      kind: ShapeKind;
      mode?: SelectionMode;
      // A creation-time variant of the kind (packages/document shape-variants.ts): a room preset.
      variant?: string;
    }
  | { type: 'text' }
  | { type: 'sticker'; stickerId: string }
  // The Room Builder (docs/specs/009-elements/room-builder.md): walls placed corner by corner.
  | { type: 'room-walls' }
  | { type: 'sticky' }
  | { type: 'image' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind };

// Themed sub-groups within the Tools section (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"):
// the Tools tab renders one labelled grid per group instead of a flat
// sixteen-tile wall. Group membership is metadata on the tile — ids stay
// stable, so palette layouts and search are untouched.
export type ToolGroupId = 'write' | 'behaviour';

// Display order, headings, and a one-line "what's in here" for the Tools tab's
// groups. The description is what the category tile's hover card says: a count
// ("6 tools") tells you nothing you can act on, whereas naming the contents
// answers the actual question — is the thing I want in this box?
// Label + membership only. These groups render through PaletteToolRows /
// PaletteTileGroup, each carrying its own title, and a title shows a label
// rather than a blurb —
// the browsable category descriptions live in PALETTE_CATEGORIES. A
// `description` field here went unread for long enough to drift out of step
// with the live one for `behaviour`, which is why it is gone.
export const TOOL_GROUPS: { id: ToolGroupId; label: string }[] = [
  {
    id: 'write',
    label: 'Write',
  },
  // Behaviour (docs/specs/009-elements/mode-button.md): elements that DO something when someone interacts
  // with them, rather than elements that say something. Last, because a
  // diagram is drawn before it is wired up.
  {
    id: 'behaviour',
    label: 'Behaviour',
  },
];

export type PaletteTileDef = {
  // Stable id: palette layouts (palette-layouts.ts) and the Search panel address tiles by it, so
  // renaming one means renaming it there too.
  id: string;
  section: PaletteTileSection;
  // Which Tools-tab group the tile renders under. Required exactly when
  // `section === 'tools'` (a test pins this); meaningless elsewhere.
  toolGroup?: ToolGroupId;
  // Collapses this tile into a named group inside its category, rather than
  // showing it as a top-level row (docs/specs/009-elements/embed-providers.md). 'embed' = the Media tab's embed
  // providers; 'web' = the Components tab's website composites; and a
  // SpaceTileGroup the Space category the piece belongs in (space-categories.tsx).
  tileGroup?: 'embed' | 'web' | SpaceTileGroup;
  label: string;
  // Overrides the caption derived from `label` where that runs too long
  // for the tile (see IconButton).
  caption?: string;
  description: string;
  // A short line rendered UNDER the tile in list layouts (the Tools tab).
  // Separate from `description`, which is the fuller hover card / search text:
  // this one has to fit a palette-width row, so it is a clause, not a
  // sentence, and it says what the tool IS rather than how to use it.
  blurb?: string;
  icon: React.ReactNode;
  shortcut?: string;
  // IconButton flags (docs/specs/008-canvas/canvas-and-palette.md theme tinting): `filled` tiles preview the
  // theme's element fill; `noTint` tiles keep fixed colours.
  filled?: boolean;
  noTint?: boolean;
  // Tile only renders when the editor supplies onAddImage (image uploads
  // available) — the Image / Avatar / Hero / Header tiles.
  needsImage?: boolean;
  // Greyed out with its reason (no press, no drag, the reason in its hover card).
  disabled?: { reason: string };
  // Ends a group of related tiles in its category: a fixed divider follows it on the Toolbar
  // strip, between it and the next tile shown (docs/specs/007-editor/toolbar-layout.md "Fixed
  // dividers"). Never more than two per category.
  dividerAfter?: true;
  // Presets of this tile's element (docs/specs/009-elements/card.md "Card presets"): on the Toolbar strip the tile is
  // drawn as an opener (its glyph with a caret) whose popover offers them; elsewhere the tile places its own element.
  variants?: readonly PaletteTileDef[];
  // The line under the presets popover's title: what can still change after one is placed.
  variantsHint?: string;
  action: PaletteTileAction;
};

export const PALETTE_TILES: PaletteTileDef[] = [
  // --- Shapes -------------------------------------------------------------
  {
    id: 'shapes:square',
    section: 'shapes',
    label: 'Add Square',
    description: 'Drop a new square shape on the canvas.',
    shortcut: 'R',
    filled: true,
    action: { type: 'shape', kind: 'square' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideSquare} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:circle',
    section: 'shapes',
    label: 'Add Circle',
    description: 'Drop a new circle shape on the canvas.',
    shortcut: 'O',
    filled: true,
    action: { type: 'shape', kind: 'circle' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideCircle} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:diamond',
    section: 'shapes',
    label: 'Add Diamond',
    description: 'Diamond. Decision node.',
    shortcut: 'D',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'diamond' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideDiamond} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:cylinder',
    section: 'shapes',
    label: 'Add Cylinder',
    description: 'Cylinder. Flowchart database / storage.',
    shortcut: 'C',
    filled: true,
    action: { type: 'shape', kind: 'cylinder' },
    icon: (
      <Glyph size={18} units={18}>
        <path d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5" />
        <ellipse cx="9" cy="5" rx="6" ry="1.8" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:parallelogram',
    section: 'shapes',
    label: 'Add Parallelogram',
    description: 'Parallelogram. Flowchart input / output.',
    shortcut: 'G',
    filled: true,
    action: { type: 'shape', kind: 'parallelogram' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,3 16,3 13,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:hexagon',
    section: 'shapes',
    label: 'Add Hexagon',
    description: 'Hexagon. Preparation / milestone.',
    filled: true,
    action: { type: 'shape', kind: 'hexagon' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,3 13,3 16,9 13,15 5,15 2,9" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:document',
    section: 'shapes',
    label: 'Add Document',
    description: 'Document shape. Flowchart output.',
    filled: true,
    action: { type: 'shape', kind: 'document' },
    icon: (
      <Glyph size={18} units={18}>
        <path d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:stadium',
    section: 'shapes',
    label: 'Add Stadium',
    description: 'Stadium shape. Flowchart Start / End.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'stadium' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="1.5" y="6" width="15" height="6" rx="3" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:cloud',
    section: 'shapes',
    label: 'Add Cloud',
    description: 'Cloud. Networking / architecture.',
    filled: true,
    action: { type: 'shape', kind: 'cloud' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <path d="M5.5 13.5 C3.2 13.5 2 11.7 3.4 10.2 C2.4 8.7 4 7 5.5 7.7 C6 5.4 9.4 5.2 9.9 7.6 C11.9 6.7 13.5 8.6 12.2 10.2 C13.5 11.2 12.6 13.5 10.8 13.5 Z" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:triangle',
    section: 'shapes',
    label: 'Add Triangle',
    description: 'Triangle. A basic shape.',
    filled: true,
    action: { type: 'shape', kind: 'triangle' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="9,3 16,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:trapezoid',
    section: 'shapes',
    label: 'Add Trapezoid',
    description: 'Trapezoid. Flowchart manual operation.',
    filled: true,
    action: { type: 'shape', kind: 'trapezoid' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,4 13,4 16,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:star',
    section: 'shapes',
    label: 'Add Star',
    description: 'Star. Highlight or rating.',
    filled: true,
    action: { type: 'shape', kind: 'star' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="9,1.5 10.8,6.6 16.1,6.7 11.9,9.9 13.4,15.1 9,12 4.6,15.1 6.1,9.9 1.9,6.7 7.2,6.6" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:speech-bubble',
    section: 'shapes',
    label: 'Add Speech Bubble',
    caption: 'Bubble',
    description: 'Speech bubble. A callout with a tail.',
    filled: true,
    action: { type: 'shape', kind: 'speech-bubble' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <path d="M4 3 H14 a2 2 0 0 1 2 2 V10 a2 2 0 0 1 -2 2 H7 L4.5 15.5 L5.5 12 H4 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
      </Glyph>
    ),
  },
  {
    id: 'tools:text',
    blurb: 'A free-standing text label',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Text',
    description: 'Text element. Double-click to edit.',
    shortcut: 'T',
    action: { type: 'text' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideType} />
      </Glyph>
    ),
  },
  {
    id: 'tools:sticky',
    blurb: 'A coloured note card',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Sticky Note',
    caption: 'Note',
    description: 'Sticky note for short annotations.',
    shortcut: 'N',
    noTint: true,
    action: { type: 'sticky' },
    icon: (
      // The note keeps its paper colour (noTint): Lucide sticky-note, body filled.
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d={lucideStickyNotePaths.body} fill="rgb(254 243 199)" />
        <path d={lucideStickyNotePaths.fold} />
      </Glyph>
    ),
  },
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
  {
    // Plant (docs/specs/009-elements/office.md).
    id: 'tools:plant',
    tileGroup: 'amenities',
    blurb: 'A potted plant Avatars walk round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Plant',
    caption: 'Plant',
    description:
      'A potted plant to make an office feel lived in. Avatar-mode characters walk round its pot.',
    filled: true,
    action: { type: 'shape', kind: 'plant' },
    icon: <PlantIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bookshelf (docs/specs/009-elements/office.md).
    id: 'tools:bookshelf',
    tileGroup: 'amenities',
    blurb: 'Shelves of books Avatars walk round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bookshelf',
    caption: 'Bookshelf',
    description:
      'A bookshelf to stand against a wall. Avatar-mode characters walk along in front of it, not through it.',
    filled: true,
    action: { type: 'shape', kind: 'bookshelf' },
    icon: <BookshelfIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:printer',
    tileGroup: 'amenities',
    blurb: 'A desktop printer on a cabinet',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Printer',
    caption: 'Printer',
    description:
      'A desktop printer on a small cabinet, a printed page in its tray. Characters walk round its cabinet.',
    filled: true,
    action: { type: 'shape', kind: 'printer' },
    icon: <PrinterIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:copier',
    tileGroup: 'amenities',
    blurb: 'A floor-standing copier',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Copier',
    caption: 'Copier',
    description:
      'A copier with paper trays, a lit touch screen and a stack of copies. Characters walk round its base.',
    filled: true,
    action: { type: 'shape', kind: 'copier' },
    icon: <CopierIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:lockers',
    tileGroup: 'amenities',
    blurb: 'A bank of four lockers',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Lockers',
    caption: 'Lockers',
    description:
      'A bank of four lockers for an entrance, a gym or a hot-desk floor. Stand it against a wall: characters walk along in front of it.',
    filled: true,
    action: { type: 'shape', kind: 'lockers' },
    icon: <LockersIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:coat-rack',
    tileGroup: 'amenities',
    blurb: 'A coat stand by the door',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Coat Rack',
    caption: 'Coat Rack',
    description:
      'A wooden coat stand with two coats, a scarf and a hat, for an entrance. Characters walk round its foot.',
    filled: true,
    action: { type: 'shape', kind: 'coat-rack' },
    icon: <CoatRackIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:umbrella-stand',
    tileGroup: 'amenities',
    blurb: 'A stand of umbrellas',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Umbrella Stand',
    caption: 'Umbrella Stand',
    description:
      'A round stand of three furled umbrellas, for beside the door. Characters walk round it.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'umbrella-stand' },
    icon: <UmbrellaStandIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Water Cooler (docs/specs/009-elements/office.md).
    id: 'tools:water-cooler',
    tileGroup: 'amenities',
    blurb: 'Walk up for a cup of water',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Water Cooler',
    caption: 'Water Cooler',
    description:
      'A water cooler for Avatar mode: walk your character up to it and it gets a cup of water, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'water-cooler' },
    icon: <WaterCoolerIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Coffee Machine (docs/specs/009-elements/office.md).
    id: 'tools:coffee-machine',
    tileGroup: 'amenities',
    blurb: 'Walk up for a coffee',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Coffee Machine',
    caption: 'Coffee Machine',
    description:
      'A coffee machine for Avatar mode: walk your character up to it and it gets a steaming coffee, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'coffee-machine' },
    icon: <CoffeeMachineIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:vending-machine',
    tileGroup: 'amenities',
    blurb: 'A lit machine of snacks and cans',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Vending Machine',
    caption: 'Vending Machine',
    description:
      'A vending machine for a break room, its window lit and glowing on dark paper. Characters walk round its base.',
    filled: true,
    action: { type: 'shape', kind: 'vending-machine' },
    icon: <VendingMachineIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:kitchen-counter',
    tileGroup: 'amenities',
    blurb: 'A kitchen unit with a worktop',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Kitchen Counter',
    caption: 'Kitchen Counter',
    description:
      'A base unit with an oak worktop and a tiled splashback. Place units side by side for a run; a Microwave or a Kettle stands on its worktop.',
    filled: true,
    action: { type: 'shape', kind: 'kitchen-counter' },
    icon: <KitchenCounterIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:kitchen-sink',
    tileGroup: 'amenities',
    blurb: 'A kitchen unit with a sink',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Kitchen Sink',
    caption: 'Kitchen Sink',
    description:
      'A base unit with a steel sink and a tap, the same height as a Kitchen Counter so the two make one run.',
    filled: true,
    action: { type: 'shape', kind: 'kitchen-sink' },
    icon: <KitchenSinkIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:fridge',
    tileGroup: 'amenities',
    blurb: 'A tall fridge-freezer',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fridge',
    caption: 'Fridge',
    description:
      'A fridge-freezer with a drawing and a note on its door. Characters walk round its base.',
    filled: true,
    action: { type: 'shape', kind: 'fridge' },
    icon: <FridgeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:microwave',
    tileGroup: 'amenities',
    blurb: 'A microwave for the worktop',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Microwave',
    caption: 'Microwave',
    description:
      'A microwave to stand on a Kitchen Counter. Place it over the worktop; characters never bump into it.',
    filled: true,
    action: { type: 'shape', kind: 'microwave' },
    icon: <MicrowaveIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:kettle',
    tileGroup: 'amenities',
    blurb: 'A kettle for the worktop',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Kettle',
    caption: 'Kettle',
    description:
      'A red electric kettle to stand on a Kitchen Counter. Place it over the worktop; characters never bump into it.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'kettle' },
    icon: <KettleIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:restroom',
    tileGroup: 'amenities',
    blurb: 'A furnished restroom with its sign',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Restroom',
    caption: 'Restroom',
    description:
      'A room named Restroom, with its door, two toilet cubicles, a hand dryer, two washbasins and a sign outside that says when it is in use.',
    filled: true,
    action: { type: 'shape', kind: 'room', variant: 'restroom' },
    icon: <RestroomIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:toilet-cubicle',
    tileGroup: 'amenities',
    blurb: 'A toilet cubicle',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Toilet Cubicle',
    caption: 'Toilet Cubicle',
    description:
      'A toilet cubicle with its door open. Place several side by side for a row; characters walk along in front of them.',
    filled: true,
    action: { type: 'shape', kind: 'toilet-cubicle' },
    icon: <ToiletCubicleIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:washbasin',
    tileGroup: 'amenities',
    blurb: 'A basin under a mirror',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Washbasin',
    caption: 'Washbasin',
    description: 'A washbasin on a pedestal under a mirror. Characters walk round its pedestal.',
    filled: true,
    action: { type: 'shape', kind: 'washbasin' },
    icon: <WashbasinIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office amenities (docs/specs/009-elements/office-amenities.md).
    id: 'tools:hand-dryer',
    tileGroup: 'amenities',
    blurb: 'A dryer for the wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hand Dryer',
    caption: 'Hand Dryer',
    description: 'A hand dryer to hang on a wall. Characters walk past it.',
    filled: true,
    action: { type: 'shape', kind: 'hand-dryer' },
    icon: <HandDryerIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office Pod (docs/specs/009-elements/office.md).
    id: 'tools:office-pod',
    tileGroup: 'rooms',
    blurb: 'Two seats, a door that shuts',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Office Pod',
    caption: 'Office Pod',
    description:
      'A booth for two in Avatar mode: walk in and sit, and once both seats are taken its glass door slides shut and the pod becomes its own private call.',
    filled: true,
    action: { type: 'shape', kind: 'office-pod' },
    icon: <OfficePodIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:phone-booth',
    tileGroup: 'rooms',
    blurb: 'One seat, out of the room',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Phone Booth',
    caption: 'Phone Booth',
    description:
      "A booth for one in Avatar mode: sit in it to step out of the room's call, and its lamp shows Busy until you leave.",
    filled: true,
    action: { type: 'shape', kind: 'phone-booth' },
    icon: <PhoneBoothIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:nap-pod',
    tileGroup: 'rooms',
    blurb: 'Lie back, shown as Focusing',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Nap Pod',
    caption: 'Nap Pod',
    description:
      'A cocoon lounger for a quiet moment. Walk in to lie back; while you rest, people see you as Focusing.',
    filled: true,
    action: { type: 'shape', kind: 'nap-pod' },
    icon: <NapPodIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:reception-desk',
    tileGroup: 'rooms',
    blurb: 'A counter with a bell',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Reception Desk',
    caption: 'Reception Desk',
    description:
      'A front desk with a bell. Stand at it to see Welcome and ring the bell, and everyone in the room hears it.',
    filled: true,
    action: { type: 'shape', kind: 'reception-desk' },
    icon: <ReceptionDeskIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bar (docs/specs/009-elements/office.md). The bar pieces are Play's Bar group
    // (docs/specs/010-palette/palette-top-level-categories.md "Play holds the Bar").
    id: 'tools:bar',
    tileGroup: 'recreation',
    blurb: 'A counter to gather at',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bar',
    caption: 'Bar',
    description:
      'A bar counter with bottles on the shelf behind it. Avatar-mode characters stand at it and walk round its ends, not through it.',
    filled: true,
    action: { type: 'shape', kind: 'bar' },
    icon: <BarIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bar Stool (docs/specs/009-elements/office.md).
    id: 'tools:bar-stool',
    tileGroup: 'recreation',
    blurb: 'A seat at the bar',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bar Stool',
    caption: 'Bar Stool',
    description:
      'A stool for Avatar mode: walk onto it to sit, facing the bar. One sitter at a time, their name above it.',
    filled: true,
    action: { type: 'shape', kind: 'bar-stool' },
    icon: <BarStoolIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Drinks Cabinet (docs/specs/009-elements/office.md).
    id: 'tools:drinks-cabinet',
    tileGroup: 'recreation',
    blurb: 'Walk up for a juice',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Drinks Cabinet',
    caption: 'Drinks Cabinet',
    description:
      'A glass-fronted drinks cabinet for Avatar mode: walk your character up to it and it gets a juice, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'drinks-cabinet' },
    icon: <DrinksCabinetIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Drinks Fridge (docs/specs/009-elements/office.md).
    id: 'tools:drinks-fridge',
    tileGroup: 'recreation',
    blurb: 'Walk up for a soda',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Drinks Fridge',
    caption: 'Drinks Fridge',
    description:
      'A fridge of cans for Avatar mode: walk your character up to it and it gets a soda, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'drinks-fridge' },
    icon: <DrinksFridgeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Outdoor Plant (docs/specs/009-elements/office.md).
    id: 'tools:outdoor-plant',
    tileGroup: 'garden',
    blurb: 'A flowering shrub',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Outdoor Plant',
    caption: 'Outdoor Plant',
    description:
      'A leafy shrub in a stone planter. Avatar-mode characters walk round its planter, not through it.',
    filled: true,
    action: { type: 'shape', kind: 'outdoor-plant' },
    icon: <OutdoorPlantIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Tree (docs/specs/009-elements/office.md).
    id: 'tools:tree',
    tileGroup: 'garden',
    blurb: 'Shade for the garden',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Tree',
    caption: 'Tree',
    description:
      'A tree with a full canopy. Avatar-mode characters walk round its trunk and pass in front of its leaves.',
    filled: true,
    action: { type: 'shape', kind: 'tree' },
    icon: <TreeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Garden Path (docs/specs/009-elements/office.md).
    id: 'tools:garden-path',
    tileGroup: 'garden',
    blurb: 'Stepping stones to follow',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Garden Path',
    caption: 'Garden Path',
    description:
      'Stepping stones in gravel, lying on the ground under everything. Stretch it to any length; characters walk along it.',
    filled: true,
    action: { type: 'shape', kind: 'garden-path' },
    icon: <GardenPathIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Grass (docs/specs/009-elements/office.md).
    id: 'tools:grass',
    tileGroup: 'garden',
    blurb: 'A patch of lawn',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Grass',
    caption: 'Grass',
    description:
      'A patch of lawn lying on the ground under everything. Stretch it to any size; characters walk across it.',
    filled: true,
    action: { type: 'shape', kind: 'grass' },
    icon: <GrassIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Garden Fence (docs/specs/009-elements/office.md).
    id: 'tools:garden-fence',
    tileGroup: 'garden',
    blurb: 'A low picket fence',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Garden Fence',
    caption: 'Garden Fence',
    description:
      'A low white picket fence. Avatar-mode characters cannot walk through it, just as with a fence.',
    filled: true,
    action: { type: 'shape', kind: 'garden-fence' },
    icon: <GardenFenceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:jukebox',
    tileGroup: 'recreation',
    blurb: 'Background music in its room',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Jukebox',
    caption: 'Jukebox',
    description:
      'Plays a music link to everyone standing in its room once they press Play on it. Set the link from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'jukebox' },
    icon: <JukeboxIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:ping-pong-table',
    tileGroup: 'recreation',
    blurb: 'A table for two players',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Ping-Pong Table',
    caption: 'Ping-Pong Table',
    description:
      'A game for two: sit at each end and play a rally to 11, moving your paddle with the mouse, a finger or W and S.',
    filled: true,
    action: { type: 'shape', kind: 'ping-pong-table' },
    icon: <PingPongTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:pool-table',
    tileGroup: 'recreation',
    blurb: 'A table racked for a game',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Pool Table',
    caption: 'Pool Table',
    description:
      'A pool table with the balls racked and a cue on the cloth. Characters walk round it.',
    filled: true,
    action: { type: 'shape', kind: 'pool-table' },
    icon: <PoolTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:foosball-table',
    tileGroup: 'recreation',
    blurb: 'A table football game',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Foosball Table',
    caption: 'Foosball Table',
    description: 'A foosball table with its rods, players and ball. Characters walk round it.',
    filled: true,
    action: { type: 'shape', kind: 'foosball-table' },
    icon: <FoosballTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:arcade-machine',
    tileGroup: 'recreation',
    blurb: 'A glowing arcade cabinet',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Arcade Machine',
    caption: 'Arcade Machine',
    description:
      'A cabinet with a glowing screen. Characters walk round it; walk up to it and it asks for a coin.',
    filled: true,
    action: { type: 'shape', kind: 'arcade-machine' },
    icon: <ArcadeMachineIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:dartboard',
    tileGroup: 'recreation',
    blurb: 'A board for the wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Dartboard',
    caption: 'Dartboard',
    description: 'A dartboard with three darts in it, to hang on a wall. Characters walk past it.',
    filled: true,
    action: { type: 'shape', kind: 'dartboard' },
    icon: <DartboardIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:fireplace',
    tileGroup: 'recreation',
    blurb: 'A fire to gather round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fireplace',
    caption: 'Fireplace',
    description:
      'A brick fireplace with a flickering fire, for a lounge. Characters walk round its hearth.',
    filled: true,
    action: { type: 'shape', kind: 'fireplace' },
    icon: <FireplaceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:treadmill',
    tileGroup: 'recreation',
    blurb: 'Walk on, shown On a Break',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Treadmill',
    caption: 'Treadmill',
    description:
      'A treadmill whose belt runs while you walk on it; while you do, people see you as On a Break.',
    filled: true,
    action: { type: 'shape', kind: 'treadmill' },
    icon: <TreadmillIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:weight-bench',
    tileGroup: 'recreation',
    blurb: 'Lift, shown On a Break',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Weight Bench',
    caption: 'Weight Bench',
    description:
      'A bench with a barbell on its rack. Sit to lift; while you do, people see you as On a Break.',
    filled: true,
    action: { type: 'shape', kind: 'weight-bench' },
    icon: <WeightBenchIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Workday pieces (docs/specs/009-elements/workday-pieces.md).
    id: 'tools:pet-bed',
    tileGroup: 'recreation',
    blurb: 'An office dog',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Pet Bed',
    caption: 'Pet Bed',
    description:
      'A dog bed with a bone, and the office dog that naps in it and wanders the room. Click the dog to pat it.',
    filled: true,
    action: { type: 'shape', kind: 'pet-bed' },
    icon: <PetBedIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:bench',
    tileGroup: 'garden',
    blurb: 'Two seats outdoors',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bench',
    caption: 'Bench',
    description: 'A wooden garden bench. Walk onto it to sit; it seats two side by side.',
    filled: true,
    action: { type: 'shape', kind: 'bench' },
    icon: <BenchIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:picnic-table',
    tileGroup: 'garden',
    blurb: 'Six seats round a table',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Picnic Table',
    caption: 'Picnic Table',
    description:
      'A wooden picnic table with a bench each side. Walk onto it to sit, facing the table; it seats six.',
    filled: true,
    action: { type: 'shape', kind: 'picnic-table' },
    icon: <PicnicTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:hammock',
    tileGroup: 'garden',
    blurb: 'A hammock for one',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hammock',
    caption: 'Hammock',
    description: 'A striped hammock between two posts. Walk onto it to lie back in it.',
    filled: true,
    action: { type: 'shape', kind: 'hammock' },
    icon: <HammockIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:garden-umbrella',
    tileGroup: 'garden',
    blurb: 'A striped parasol',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Garden Umbrella',
    caption: 'Garden Umbrella',
    description:
      'A striped parasol to stand beside or over a picnic table. Only its base gets in the way.',
    filled: true,
    action: { type: 'shape', kind: 'garden-umbrella' },
    icon: <GardenUmbrellaIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:fountain',
    tileGroup: 'garden',
    blurb: 'A stone fountain',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fountain',
    caption: 'Fountain',
    description: 'A stone fountain with gently moving water. Characters walk round its basin.',
    filled: true,
    action: { type: 'shape', kind: 'fountain' },
    icon: <FountainIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:pond',
    tileGroup: 'garden',
    blurb: 'Water to walk round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Pond',
    caption: 'Pond',
    description: 'A pond with lily pads. Stretch it to any size; characters walk round the water.',
    filled: true,
    action: { type: 'shape', kind: 'pond' },
    icon: <PondIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:swimming-pool',
    tileGroup: 'garden',
    blurb: 'A pool with lanes',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Swimming Pool',
    caption: 'Swimming Pool',
    description:
      'A swimming pool with lanes and a ladder. Stretch it to any size; characters stop at the water and walk round on its deck.',
    filled: true,
    action: { type: 'shape', kind: 'swimming-pool' },
    icon: <SwimmingPoolIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:campfire',
    tileGroup: 'garden',
    blurb: 'A fire in a ring of stones',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Campfire',
    caption: 'Campfire',
    description:
      'A campfire with a flicker, to gather round in the garden. Characters walk round its stones.',
    filled: true,
    action: { type: 'shape', kind: 'campfire' },
    icon: <CampfireIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:car-park',
    tileGroup: 'garden',
    blurb: 'Bays with parked cars',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Car Park',
    caption: 'Car Park',
    description:
      'Three parking bays, two cars parked, for a campus gate. Place several side by side for a longer row; characters walk round it.',
    filled: true,
    action: { type: 'shape', kind: 'car-park' },
    icon: <CarParkIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:bike-rack',
    tileGroup: 'garden',
    blurb: 'Two bikes at their stands',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bike Rack',
    caption: 'Bike Rack',
    description: 'Two hoop stands with a bike locked to each. Characters walk round it.',
    filled: true,
    action: { type: 'shape', kind: 'bike-rack' },
    icon: <BikeRackIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Screen (docs/specs/009-elements/screen-and-room-sign.md "Screen").
    id: 'tools:screen',
    tileGroup: 'meeting',
    blurb: "Shows the room's screen share",
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Screen',
    caption: 'Screen',
    description:
      'A wall screen. When someone in its room shares their screen in the call, it shows for everyone in the room; otherwise it plays a video link set from its menu. Click it to open it large.',
    filled: true,
    action: { type: 'shape', kind: 'screen' },
    icon: <ScreenIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Room Sign (docs/specs/009-elements/screen-and-room-sign.md "Room Sign").
    id: 'tools:room-sign',
    tileGroup: 'meeting',
    blurb: 'Free, In Use, or Knock',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Room Sign',
    caption: 'Room Sign',
    description:
      "A sign by a room's door with its name and whether it is free, in use (how many, how long) or Do Not Disturb. Knock from it to ask the people inside to let you in.",
    filled: true,
    action: { type: 'shape', kind: 'room-sign' },
    icon: <RoomSignIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:notice-board',
    tileGroup: 'meeting',
    blurb: 'Pinned notes on the wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Notice Board',
    caption: 'Notice Board',
    description:
      'A cork board for the wall. Editors and participants pin short notes on it and unpin their own; the four newest show on the board.',
    filled: true,
    action: { type: 'shape', kind: 'notice-board' },
    icon: <NoticeBoardIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:world-clock',
    tileGroup: 'meeting',
    blurb: 'Clocks for several time zones',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add World Clock',
    caption: 'World Clock',
    description:
      'A wall clock with a dial per time zone. It shows each viewer their own time until you add zones from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'world-clock' },
    icon: <WorldClockIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Team pieces (docs/specs/009-elements/team-pieces.md).
    id: 'tools:calendar-wall',
    tileGroup: 'meeting',
    blurb: 'A month with notes on its days',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Calendar Wall',
    caption: 'Calendar Wall',
    description:
      'A month planner for the wall. Editors and participants pin notes to its days; it shows each viewer this month, with today circled.',
    filled: true,
    action: { type: 'shape', kind: 'calendar-wall' },
    icon: <CalendarWallIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Team pieces (docs/specs/009-elements/team-pieces.md).
    id: 'tools:suggestion-box',
    tileGroup: 'meeting',
    blurb: 'Anonymous ideas, read by Editors',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Suggestion Box',
    caption: 'Suggestion Box',
    description:
      'A box anyone taking part drops an idea into, with no name on it. Only Editors read them, and never who wrote them.',
    filled: true,
    action: { type: 'shape', kind: 'suggestion-box' },
    icon: <SuggestionBoxIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Team pieces (docs/specs/009-elements/team-pieces.md).
    id: 'tools:photo-wall',
    tileGroup: 'meeting',
    blurb: 'Portraits of who is here',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Team Photo Wall',
    caption: 'Team Photo Wall',
    description:
      'A wall of eight frames showing the characters of the people in this Space right now, you first.',
    filled: true,
    action: { type: 'shape', kind: 'photo-wall' },
    icon: <PhotoWallIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Timer (docs/specs/009-elements/timer-and-stopwatch.md).
    id: 'tools:timer',
    tileGroup: 'meeting',
    blurb: 'A countdown for the room',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Timer',
    caption: 'Timer',
    description:
      'A countdown on the wall. Set its length, then start, pause and reset it from its face; everyone sees the same time, and the room hears a chime at zero.',
    filled: true,
    action: { type: 'shape', kind: 'timer' },
    icon: <TimerPieceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
    id: 'tools:stopwatch',
    tileGroup: 'meeting',
    blurb: 'Count up how long it takes',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stopwatch',
    caption: 'Stopwatch',
    description:
      'A stopwatch on the wall that counts up. Start, pause and reset it from its face; everyone sees the same time.',
    filled: true,
    action: { type: 'shape', kind: 'stopwatch' },
    icon: <StopwatchIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Rug (docs/specs/009-elements/office.md).
    id: 'tools:rug',
    tileGroup: 'rooms',
    blurb: 'A rug on the floor',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Rug',
    caption: 'Rug',
    description:
      'A rug that lies on the floor under the furniture, to mark out a lounge or a reception.',
    filled: true,
    action: { type: 'shape', kind: 'rug' },
    // Rug types (docs/specs/009-elements/office.md "Rug types"): eight shapes, sizes and patterns.
    variants: RUG_PRESET_TILES,
    variantsHint: 'Pick a rug, then resize or recolour it; its pattern stays.',
    icon: <RugIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:pillar',
    tileGroup: 'rooms',
    blurb: 'A square pillar',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Pillar',
    caption: 'Pillar',
    description:
      'A plain square pillar to give a hall or a lobby its structure. Characters walk round its base.',
    filled: true,
    action: { type: 'shape', kind: 'pillar' },
    icon: <PillarIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Venue pieces (docs/specs/009-elements/venue-pieces.md).
    id: 'tools:column',
    tileGroup: 'rooms',
    blurb: 'A classical stone column',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Column',
    caption: 'Column',
    description:
      'A fluted stone column with a scrolled capital, for a grand lobby. Characters walk round its plinth.',
    filled: true,
    action: { type: 'shape', kind: 'column' },
    icon: <ColumnIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:image',
    blurb: 'Place an uploaded picture',
    section: 'media',
    label: 'Add Image',
    // Write's third tile (docs/specs/002-project-scope/not-in-livehuddle.md "Images are back"), only where uploads work
    // (`needsImage`). No `9` key.
    description: 'Place a frame, then upload a picture or pick one from your gallery.',
    noTint: true,
    needsImage: true,
    action: { type: 'image' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideImage} />
      </Glyph>
    ),
  },
  {
    id: 'tools:avatar',
    blurb: 'A circular photo of a person',
    section: 'media',
    label: 'Add Avatar',
    description:
      'Avatar. A circular image. Click to drop or drag to size; double-click it to pick / upload a photo.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'avatar' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9.5" r="3" />
        <path d="M6.5 19a6 6 0 0 1 11 0" />
      </Glyph>
    ),
  },
  {
    id: 'tools:link-card',
    blurb: 'A clickable preview of a link',
    // Offered by no category (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card"): kept
    // so a stored link card still finds its name and glyph. It left Travel with the Media category.
    section: 'media',
    label: 'Add Link Card',
    description: "Link card. A bookmark preview with the page's title, favicon, and image.",
    noTint: true,
    action: { type: 'link-card' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
      </Glyph>
    ),
  },
];

export function tilesInSection(section: PaletteTileSection): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === section);
}

// The Tools tab's grouped view (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"): the tools-section
// tiles carrying the given group, in catalogue order.
export function tilesInToolGroup(group: ToolGroupId): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === 'tools' && t.toolGroup === group);
}

export function tileById(id: string): PaletteTileDef | undefined {
  return PALETTE_TILES.find((t) => t.id === id);
}

// The tile's short human name: the explicit caption where one is set,
// otherwise derived from the action label the same way IconButton derives
// its tile caption ("Add Web Browser" → "Web Browser", "Pencil (freehand)"
// → "Pencil"). Used by the Search panel's add-to-canvas entries.
export function tileDisplayName(def: PaletteTileDef): string {
  return tileCaption(def.label, def.caption);
}

// The meeting elements' categories (docs/specs/012-collaboration/workshop-mode.md "The palette"): each holds the
// `behaviour` tool group's tiles of one `tileGroup`, in catalogue order. The Space categories come from their one
// list (space-categories.tsx).
export const COLLABORATE_CATEGORY_GROUPS: Readonly<
  Record<string, NonNullable<PaletteTileDef['tileGroup']>>
> = {
  ...Object.fromEntries(SPACE_CATEGORIES.map((c) => [c.id, c.tileGroup])),
};

/** The palette category a tile renders under by default: its section, its tool group inside
 *  Tools, or for a Collaborate element its group's category. The inverse of tilesForCategory. */
export function tileCategoryId(tile: PaletteTileDef): string {
  if (tile.section !== 'tools') return tile.section;
  if (tile.toolGroup === 'behaviour' && tile.tileGroup) {
    const id = Object.keys(COLLABORATE_CATEGORY_GROUPS).find(
      (c) => COLLABORATE_CATEGORY_GROUPS[c] === tile.tileGroup,
    );
    if (id) return id;
  }
  return tile.toolGroup ?? 'tools';
}

/**
 * The tiles a palette CATEGORY holds by default, which is not the same thing as a
 * section id. A mode's palette layout (palette-layouts.ts) starts from these and may
 * re-fill a category for that mode; ask the layout (paletteCategoriesFor) for what a
 * palette actually shows.
 *
 * Most categories are a section. Write and Draw are not: they are tool GROUPS
 * inside the tools section, and the six Collaborate categories are `tileGroup`s of
 * the Behaviour tool group (docs/specs/010-palette/palette-top-level-categories.md), so `tilesInSection('write')`
 * is empty and a caller that assumed otherwise silently showed nothing (the
 * since-removed Edit Favourites dialog did exactly that and dropped all three).
 *
 * Returns [] for the open-ended catalogues (Icons / Stickers / Technology),
 * whose contents are async data rather than fixed tiles — callers handle
 * those through their own search.
 */
export function tilesForCategory(categoryId: string): PaletteTileDef[] {
  const collaborate = COLLABORATE_CATEGORY_GROUPS[categoryId];
  if (collaborate) {
    return tilesInToolGroup('behaviour').filter((t) => t.tileGroup === collaborate);
  }
  if (TOOL_GROUPS.some((g) => g.id === categoryId)) {
    return tilesInToolGroup(categoryId as ToolGroupId);
  }
  return PALETTE_TILES.filter((t) => t.section === categoryId);
}
