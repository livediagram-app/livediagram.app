import { RUG_PRESET_TILES } from '../palette-floor-presets';
import { RugIcon } from '@/components/palette/palette-icons';
import { RoomSignIcon, ScreenIcon } from '../palette-icons-meeting';
import { CalendarWallIcon, PhotoWallIcon, SuggestionBoxIcon } from '../palette-icons-team';
import { ColumnIcon, PillarIcon } from '../palette-icons-venue';
import {
  NoticeBoardIcon,
  StopwatchIcon,
  TimerPieceIcon,
  WorldClockIcon,
} from '../palette-icons-social';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Space meeting pieces and room fixtures: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const MEETING_TILES: PaletteTileDef[] = [
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
];
