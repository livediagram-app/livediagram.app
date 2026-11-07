'use client';

// The Space categories (docs/specs/010-palette/palette-top-level-categories.md "The Space categories"): the pieces a
// Space is built from, one top-level palette category per question somebody building one asks. This list is the one
// place a Space category is defined: its id, the `tileGroup` its tiles carry, its names and its glyph. The category
// catalogue (PALETTE_CATEGORIES), the tile-to-category map (COLLABORATE_CATEGORY_GROUPS), the meeting layout
// (palette-layouts) and the flyout's taglines all read it, so a new category is one entry here.
//
// A new piece of furniture joins its category by carrying the group (`tileGroup: 'seating'` on its tile in
// palette-tile-defs.tsx), and lands in catalogue order. A category with no tiles yet is left off the palette rather
// than opening onto nothing.
//
// No component imports beyond glyphs, so the identity list can import it without pulling in a category body.

import { Glyph, MoveGroupIcon, Prims } from '@livehuddle/ui';
import {
  lucideArmchair,
  lucideCoffee,
  lucidePanelsTopLeft,
  lucideTreePine,
  lucideWine,
} from '@liveworkspace/icons/lucide';
import { ScreenIcon } from './palette-icons-meeting';

export type SpaceTileGroup =
  'travel' | 'seating' | 'rooms' | 'amenities' | 'garden' | 'meeting' | 'recreation';

export type SpaceCategory = {
  id: `collab-${SpaceTileGroup}`;
  tileGroup: SpaceTileGroup;
  // One word: the category bar names every category in one (docs/specs/007-editor/toolbar-layout.md).
  label: string;
  // The picker's blurb.
  description: string;
  // The line under the flyout's name, short enough for one line.
  tagline: string;
  icon: React.ReactNode;
  // The palette band it sits in, when not the Meet band (MEET_BAND): the bar draws a divider between bands.
  band?: number;
};

// The bands the Space categories sit in: Meet for the pieces a Space is furnished with,
// Travel's own for Travel.
export const MEET_BAND = 6;
export const TRAVEL_BAND = 7;

const lucide = (prims: Parameters<typeof Prims>[0]['prims']) => (
  <Glyph size={18} units={24}>
    <Prims prims={prims} />
  </Glyph>
);

/** The Space categories, in palette order (docs/specs/010-palette/palette-top-level-categories.md "The strip's
 *  order"): building the floor first, then Travel apart. */
export const SPACE_CATEGORIES: readonly SpaceCategory[] = [
  {
    id: 'collab-rooms',
    tileGroup: 'rooms',
    label: 'Rooms',
    description:
      'What a floor is laid out with: a fence, rooms, the Room Builder, doors, a stage with curtains and a podium, rugs, an office pod, a phone booth, a nap pod, a reception desk, pillars and columns.',
    tagline: 'Lay out the floor: rooms, walls and a stage.',
    icon: lucide(lucidePanelsTopLeft),
  },
  {
    id: 'collab-seating',
    tileGroup: 'seating',
    label: 'Seats',
    description:
      'What people sit at: a chair, a desk, a sofa, a meeting table, a bean bag, a reading nook, a hot desk and a standing desk.',
    tagline: 'Somewhere to sit, alone or together.',
    icon: lucide(lucideArmchair),
  },
  {
    id: 'collab-amenities',
    tileGroup: 'amenities',
    label: 'Perks',
    description:
      'What makes a Space feel like a place: plants and shelves, a printer, a copier, lockers and a coat rack, a kitchen, and a restroom.',
    tagline: 'The touches that make it feel like a place.',
    icon: lucide(lucideCoffee),
  },
  {
    // The bar and the social pieces (docs/specs/009-elements/social-pieces.md), one category since Bar merged in
    // (docs/specs/010-palette/palette-top-level-categories.md "Play holds the Bar"). The wine glass is the
    // glyph Start a Space's Recreation templates wear.
    id: 'collab-recreation',
    tileGroup: 'recreation',
    label: 'Play',
    description:
      'Somewhere to unwind: a bar with stools, a drinks cabinet and a fridge, ping-pong, pool and foosball tables, an arcade machine, a dartboard, a treadmill, a weight bench, a jukebox, a fireplace and a pet bed.',
    tagline: 'A drink, a game, a seat by the fire.',
    icon: lucide(lucideWine),
  },
  {
    id: 'collab-garden',
    tileGroup: 'garden',
    label: 'Garden',
    description:
      'The outdoors: plants, trees, paths, grass, low fences, benches, a picnic table, a hammock, a parasol, a fountain, a pond, a swimming pool, a campfire, a car park and a bike rack.',
    tagline: 'Take the meeting outside.',
    icon: lucide(lucideTreePine),
  },
  {
    // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md, timer-and-stopwatch.md).
    id: 'collab-meeting',
    tileGroup: 'meeting',
    label: 'Meet',
    description:
      'What a meeting room and a team need: a screen on the wall, a sign by its door, a notice board, a world clock, a calendar wall, a suggestion box, a team photo wall, a timer and a stopwatch.',
    tagline: 'Share on the wall, knock at the door.',
    icon: <ScreenIcon size={18} />,
  },
  {
    // Travel's pieces take people somewhere rather than furnish a place: last, apart.
    id: 'collab-travel',
    tileGroup: 'travel',
    label: 'Travel',
    description:
      'What takes people somewhere: a portal, a bring-focus button, an avatar pad, a directory, a signpost, an elevator and stairs.',
    tagline: 'What takes people somewhere.',
    icon: <MoveGroupIcon />,
    // Its own band, so the category bar sets it apart between two dividers.
    band: TRAVEL_BAND,
  },
];
