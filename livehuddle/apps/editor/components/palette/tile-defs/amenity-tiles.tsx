import {
  PlantIcon,
  BookshelfIcon,
  WaterCoolerIcon,
  CoffeeMachineIcon,
} from '@/components/palette/palette-icons';
import { OfficePodIcon } from '../palette-icons-garden';
import { NapPodIcon, PhoneBoothIcon, ReceptionDeskIcon } from '../palette-icons-workday';
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
} from '../palette-icons-amenities';
import { VendingMachineIcon } from '../palette-icons-social';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Space amenities, pods and reception: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const AMENITY_TILES: PaletteTileDef[] = [
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
];
