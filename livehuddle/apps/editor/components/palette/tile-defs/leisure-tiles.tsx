import {
  BarIcon,
  BarStoolIcon,
  DrinksCabinetIcon,
  DrinksFridgeIcon,
  GardenFenceIcon,
  GardenPathIcon,
  GrassIcon,
  OutdoorPlantIcon,
  TreeIcon,
} from '../palette-icons-garden';
import { PetBedIcon, TreadmillIcon, WeightBenchIcon } from '../palette-icons-workday';
import { BikeRackIcon, CarParkIcon, SwimmingPoolIcon } from '../palette-icons-venue';
import {
  ArcadeMachineIcon,
  BenchIcon,
  CampfireIcon,
  DartboardIcon,
  FireplaceIcon,
  FoosballTableIcon,
  FountainIcon,
  GardenUmbrellaIcon,
  HammockIcon,
  JukeboxIcon,
  PicnicTableIcon,
  PingPongTableIcon,
  PondIcon,
  PoolTableIcon,
} from '../palette-icons-social';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Space recreation and garden pieces: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const LEISURE_TILES: PaletteTileDef[] = [
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
];
