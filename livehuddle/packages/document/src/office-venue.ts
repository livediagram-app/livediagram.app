// The venue pieces (docs/specs/009-elements/venue-pieces.md): the Pillar and Column, the Car Park and Bike Rack, the
// Swimming Pool, and the Stage Curtains and Podium that pair with the Stage. Drawings in the furniture's vocabulary
// (seating.ts), upright from the room's camera like the rest of the office, which both renderers paint (the editor's
// views and svg-render-faces). The grid pieces join OFFICE_ART (office.ts); the pool is drawn to its own size, as the
// pond is. The footprints (and the pool's deck) are @liveworkspace/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import { poolDeck } from '@liveworkspace/avatar/office-geometry';

// Fixed colours, as SOCIAL_TONES: stone, tarmac and paint, the cars, steel, water and tile, velvet, gold and wood. A
// pillar's body has none: it takes the piece's own colour, else a wash of the theme's stroke.
export const VENUE_TONES = {
  stone: '#ece7df',
  stoneShade: '#d6cfc4',
  stoneDeep: '#a8a29e',
  tarmac: '#525a66',
  kerb: '#d6d3d1',
  paint: '#f8fafc',
  carRed: '#dc2626',
  carRedDeep: '#991b1b',
  carBlue: '#2563eb',
  carBlueDeep: '#1e3a8a',
  glass: '#bfdbfe',
  lamp: '#fef9c3',
  tyre: '#1f2937',
  steel: '#94a3b8',
  rim: '#cbd5e1',
  bikeRed: '#ef4444',
  bikeTeal: '#14b8a6',
  concrete: '#d6d3d1',
  tile: '#d4c19c',
  lane: '#0284c7',
  float: '#ef4444',
  floatWhite: '#ffffff',
  velvet: '#b91c1c',
  velvetDeep: '#7f1d1d',
  gold: '#eab308',
  wood: '#b7793f',
  woodDeep: '#7c4a2a',
  paper: '#ffffff',
  brass: '#e0b232',
  mic: '#1f2937',
  live: '#ef4444',
} as const;

const T = VENUE_TONES;

/** A swimming pool's water when it has no fill of its own, and its deep twin on dark paper. */
export const POOL_FILL = '#38bdf8';
export const POOL_FILL_DARK = '#0e5a7e';

// --- Structure ------------------------------------------------------------------------------------------------------

// A square modern pillar: a cap a little wider than the shaft, the shaft with its lit face and a shaded side, a plinth.
const PILLAR_VIEW: FurnitureDrawing = {
  width: 48,
  height: 152,
  parts: [
    ellipse('shadow', 24, 149, 23, 3),
    rect('panel', 2, 134, 44, 16, 2),
    path('rail', 'M5 139H43'),
    rect('panel', 7, 14, 34, 122, 1),
    rect('face', 31, 16, 10, 118, 0),
    path('glint', 'M12 24V126'),
    rect('face', 4, 13, 40, 5, 1),
    rect('panel', 2, 3, 44, 11, 2),
  ],
  seats: [],
  ring: { cx: 24, cy: 142, rx: 22, ry: 6 },
};

// A classical stone column: a stepped plinth, a round base, a fluted shaft that tapers a little, and a capital with a
// scroll at each corner under a square slab.
const COLUMN_VIEW: FurnitureDrawing = {
  width: 64,
  height: 168,
  parts: [
    ellipse('shadow', 32, 165, 31, 3),
    rect('panel', 2, 154, 60, 11, 1.5, T.stone),
    rect('panel', 6, 146, 52, 9, 1.5, T.stone),
    rect('panel', 11, 138, 42, 9, 4.5, T.stone),
    path('panel', 'M15 139L17 30H47L49 139Z', T.stone),
    path('mark', 'M41.5 137.5L42.5 32H46.2L47.6 137.5Z', T.stoneShade),
    path('rail', 'M21 135L22 35M26.5 135L27 35M32 135V35M37.5 135L37 35M43 135L42 35'),
    path('glint', 'M19.5 128L20.5 42'),
    rect('panel', 14, 22, 36, 10, 3, T.stone),
    ellipse('panel', 13, 25, 6.5, 6.5, T.stone),
    ellipse('panel', 51, 25, 6.5, 6.5, T.stone),
    ellipse('mark', 13, 25, 2.4, 2.4, T.stoneDeep),
    ellipse('mark', 51, 25, 2.4, 2.4, T.stoneDeep),
    rect('panel', 6, 11, 52, 10, 1.5, T.stone),
  ],
  seats: [],
  ring: { cx: 32, cy: 156, rx: 30, ry: 7 },
};

// --- Arrivals -------------------------------------------------------------------------------------------------------

// The car park's bays: three, 76 px apart, each between two painted lines.
const BAY_LINES = [4, 80, 156, 232] as const;

// A car parked nose to the viewer in the bay centred on `cx`: wheels, the body and bonnet, the cabin and windscreen,
// wing mirrors, headlights, a grille and a number plate.
function car(cx: number, body: string, deep: string): FurniturePart[] {
  const at = (d: number) => cx + d;
  return [
    ellipse('shadow', cx, 117, 33, 4),
    rect('mark', at(-28), 102, 10, 15, 3, T.tyre),
    rect('mark', at(18), 102, 10, 15, 3, T.tyre),
    path(
      'panel',
      `M${at(-22)} 69L${at(-17)} 50Q${at(-16)} 46 ${at(-12)} 46H${at(12)}Q${at(16)} 46 ${at(17)} 50L${at(22)} 69Z`,
      body,
    ),
    path('mark', `M${at(-18)} 67L${at(-14)} 52H${at(14)}L${at(18)} 67Z`, T.glass),
    path('glint', `M${at(-10)} 64L${at(-6)} 55`),
    path(
      'panel',
      `M${at(-29)} 79Q${at(-30)} 69 ${at(-23)} 68H${at(23)}Q${at(30)} 69 ${at(29)} 79V107Q${at(29)} 111 ${at(25)} 111H${at(-25)}Q${at(-29)} 111 ${at(-29)} 107Z`,
      body,
    ),
    rect('mark', at(-31), 62, 7, 5, 2, deep),
    rect('mark', at(24), 62, 7, 5, 2, deep),
    path('rail', `M${at(-21)} 81Q${cx} 76 ${at(21)} 81`),
    ellipse('mark', at(-19), 90, 6, 3.5, T.lamp),
    ellipse('mark', at(19), 90, 6, 3.5, T.lamp),
    rect('mark', at(-11), 86.5, 22, 7, 2, T.tyre),
    rect('mark', at(-9), 98, 18, 5, 1, T.paint),
    path('rail', `M${at(-26)} 104H${at(26)}`),
  ];
}

// A strip of tarmac with a kerb along its back, three bays marked in white: a red car on the left, a blue one on the
// right, and the middle bay empty with its wheel stop.
const CAR_PARK_VIEW: FurnitureDrawing = {
  width: 240,
  height: 128,
  parts: [
    rect('panel', 0, 28, 240, 98, 3, T.tarmac),
    path('mark', BAY_LINES.map((x) => `M${x} 34h4v86h-4z`).join(''), T.paint),
    rect('panel', 0, 18, 240, 11, 2, T.kerb),
    rect('face', 0, 26, 240, 5, 1, T.kerb),
    rect('panel', 98, 40, 44, 6, 3, T.kerb),
    ...car(44, T.carRed, T.carRedDeep),
    ...car(196, T.carBlue, T.carBlueDeep),
  ],
  seats: [],
  ring: { cx: 120, cy: 84, rx: 118, ry: 40 },
};

// A car seen from behind in the bay centred on `cx`, its tail toward the kerb: wheels, the roof and rear window, the
// boot and its lid line, mirrors, tail lights, a number plate and the bumper.
function carRear(cx: number, body: string, deep: string): FurniturePart[] {
  const at = (d: number) => cx + d;
  return [
    ellipse('shadow', cx, 101, 33, 4),
    rect('mark', at(-28), 86, 10, 15, 3, T.tyre),
    rect('mark', at(18), 86, 10, 15, 3, T.tyre),
    path(
      'panel',
      `M${at(-22)} 55L${at(-17)} 36Q${at(-16)} 32 ${at(-12)} 32H${at(12)}Q${at(16)} 32 ${at(17)} 36L${at(22)} 55Z`,
      body,
    ),
    path('mark', `M${at(-18)} 53L${at(-14)} 40H${at(14)}L${at(18)} 53Z`, T.glass),
    path('glint', `M${at(6)} 50L${at(10)} 43`),
    path(
      'panel',
      `M${at(-29)} 65Q${at(-30)} 55 ${at(-23)} 54H${at(23)}Q${at(30)} 55 ${at(29)} 65V91Q${at(29)} 95 ${at(25)} 95H${at(-25)}Q${at(-29)} 95 ${at(-29)} 91Z`,
      body,
    ),
    rect('mark', at(-31), 48, 7, 5, 2, deep),
    rect('mark', at(24), 48, 7, 5, 2, deep),
    path('rail', `M${at(-22)} 64Q${cx} 60 ${at(22)} 64`),
    rect('panel', at(-26), 70, 11, 6, 2, T.live),
    rect('panel', at(15), 70, 11, 6, 2, T.live),
    rect('mark', at(-9), 76, 18, 5, 1, T.paint),
    path('rail', `M${at(-26)} 87H${at(26)}`),
  ];
}

// From behind: the kerb along the near edge, the bays open at the far edge, the cars backed up to the kerb so their
// tails face you, the blue one now on the left and the red on the right, the wheel stop by the kerb.
const CAR_PARK_BACK: FurnitureDrawing = {
  width: 240,
  height: 128,
  parts: [
    rect('panel', 0, 4, 240, 108, 3, T.tarmac),
    path('mark', BAY_LINES.map((x) => `M${x} 8h4v94h-4z`).join(''), T.paint),
    rect('panel', 98, 92, 44, 6, 3, T.kerb),
    ...carRear(44, T.carBlue, T.carBlueDeep),
    ...carRear(196, T.carRed, T.carRedDeep),
    rect('panel', 0, 106, 240, 12, 2, T.kerb),
    rect('face', 0, 116, 240, 6, 1, T.kerb),
  ],
  seats: [],
  ring: { cx: 120, cy: 60, rx: 118, ry: 40 },
};

// A car side on in the bay centred on `cy`, its nose to the left: the body and cabin, two windows, the door seam, a
// headlight and a tail light, and its two wheels.
function carSide(cy: number, body: string, deep: string): FurniturePart[] {
  const y = (d: number) => cy + d;
  return [
    ellipse('shadow', 54, y(24), 42, 4),
    path(
      'panel',
      `M30 ${y(-8)}L38 ${y(-24)}Q39 ${y(-26)} 42 ${y(-26)}H68Q71 ${y(-26)} 72 ${y(-24)}L82 ${y(-8)}Z`,
      body,
    ),
    path(
      'mark',
      `M35 ${y(-9)}L41 ${y(-22)}H54V${y(-9)}ZM57 ${y(-9)}V${y(-22)}H69L76 ${y(-9)}Z`,
      T.glass,
    ),
    path('glint', `M43 ${y(-12)}L47 ${y(-19)}`),
    rect('panel', 12, y(-10), 82, 24, 8, body),
    path('rail', `M55 ${y(-8)}V${y(12)}M16 ${y(6)}H90`),
    ellipse('mark', 15.5, y(-2), 2.5, 4, T.lamp),
    rect('mark', 89, y(-5), 4, 7, 1.5, T.live),
    rect('mark', 60, y(-6), 6, 2.5, 1, deep),
    ellipse('panel', 31, y(15), 8, 8, T.tyre),
    ellipse('panel', 76, y(15), 8, 8, T.tyre),
    ellipse('mark', 31, y(15), 4, 4, T.rim),
    ellipse('mark', 76, y(15), 4, 4, T.rim),
  ];
}

// Facing left: the strip of tarmac runs down the canvas, the kerb down its right, the three bays one above the other,
// the red car side on in the top bay and the blue in the bottom one, both nose out to the left, the wheel stop in the
// middle bay by the kerb.
const CAR_PARK_SIDE_LINES = [4, 80, 156, 232] as const;
const CAR_PARK_SIDE: FurnitureDrawing = {
  width: 128,
  height: 240,
  parts: [
    rect('panel', 0, 0, 114, 240, 3, T.tarmac),
    path('mark', CAR_PARK_SIDE_LINES.map((y) => `M4 ${y}h100v4h-100z`).join(''), T.paint),
    rect('face', 108, 0, 8, 240, 1, T.kerb),
    rect('panel', 112, 0, 14, 240, 2, T.kerb),
    rect('panel', 96, 98, 6, 44, 3, T.kerb),
    ...carSide(46, T.carRed, T.carRedDeep),
    ...carSide(198, T.carBlue, T.carBlueDeep),
  ],
  seats: [],
  ring: { cx: 60, cy: 120, rx: 58, ry: 118 },
};

// A tube of a bike's frame, `w` thick, from one point to another, as a closed quad for a 'mark' path.
function tube(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  const r = (v: number) => Math.round(v * 100) / 100;
  return `M${r(x1 + nx)} ${r(y1 + ny)}L${r(x2 + nx)} ${r(y2 + ny)}L${r(x2 - nx)} ${r(y2 - ny)}L${r(x1 - nx)} ${r(y1 - ny)}Z`;
}

// A bike side on, its back wheel at `ox`, facing right (or left when `dir` is -1): two wheels with spokes, a frame of tubes in its colour, a saddle, handlebars.
function bike(ox: number, colour: string, dir: 1 | -1 = 1): FurniturePart[] {
  const back = { x: ox + 11 * dir, y: 60 };
  const front = { x: ox + 45 * dir, y: 60 };
  const crank = { x: ox + 26 * dir, y: 60 };
  const seat = { x: ox + 21 * dir, y: 41 };
  const head = { x: ox + 40 * dir, y: 43 };
  const wheel = (c: { x: number; y: number }): FurniturePart[] => [
    ellipse('panel', c.x, c.y, 11, 11, T.tyre),
    ellipse('mark', c.x, c.y, 8.5, 8.5, T.rim),
    path('rail', `M${c.x - 8} ${c.y}H${c.x + 8}M${c.x} ${c.y - 8}V${c.y + 8}`),
    ellipse('mark', c.x, c.y, 1.6, 1.6, T.tyre),
  ];
  return [
    ...wheel(back),
    ...wheel(front),
    path(
      'mark',
      [
        tube(back.x, back.y, crank.x, crank.y, 2.6),
        tube(back.x, back.y, seat.x, seat.y, 2.4),
        tube(crank.x, crank.y, seat.x, seat.y, 3),
        tube(crank.x, crank.y, head.x, head.y, 3.2),
        tube(seat.x, seat.y, head.x, head.y, 3),
      ].join(''),
      colour,
    ),
    path('mark', tube(head.x, head.y - 3, front.x, front.y, 2.4), T.steel),
    ellipse('mark', crank.x, crank.y, 3, 3, T.tyre),
    rect('mark', seat.x - 6, seat.y - 5, 12, 3.5, 1.75, T.tyre),
    path('line', `M${head.x} ${head.y - 2}L${head.x + dir} ${head.y - 8}H${head.x + 6 * dir}`),
  ];
}

// A Sheffield stand side on: an inverted U of steel tube, 4 px thick, from x0 to x1, its feet in the pad.
const hoop = (x0: number, x1: number): string =>
  `M${x0} 68V44Q${x0} 34 ${x0 + 10} 34H${x1 - 10}Q${x1} 34 ${x1} 44V68H${x1 - 4}V44Q${x1 - 4} 38 ${x1 - 10} 38H${x0 + 10}Q${x0 + 4} 38 ${x0 + 4} 44V68Z`;

// A concrete pad with two steel hoop stands, a red bike and a teal bike locked to them, side on.
const BIKE_RACK_VIEW: FurnitureDrawing = {
  width: 136,
  height: 80,
  parts: [
    ellipse('shadow', 68, 77, 65, 3),
    rect('panel', 2, 62, 132, 14, 3, T.concrete),
    rect('face', 2, 72, 132, 4, 1, T.concrete),
    path('panel', hoop(10, 62) + hoop(74, 126), T.steel),
    path('glint', 'M13 64V45M77 64V45'),
    ...bike(6, T.bikeRed),
    ...bike(72, T.bikeTeal),
  ],
  seats: [],
  ring: { cx: 68, cy: 66, rx: 64, ry: 10 },
};

// From behind: the stands nearest you, the bikes beyond them facing left, the teal one now on the left.
const BIKE_RACK_BACK: FurnitureDrawing = {
  width: 136,
  height: 80,
  parts: [
    ellipse('shadow', 68, 77, 65, 3),
    rect('panel', 2, 62, 132, 14, 3, T.concrete),
    rect('face', 2, 72, 132, 4, 1, T.concrete),
    ...bike(130, T.bikeRed, -1),
    ...bike(64, T.bikeTeal, -1),
    path('panel', hoop(10, 62) + hoop(74, 126), T.steel),
    path('glint', 'M13 64V45M77 64V45'),
  ],
  seats: [],
  ring: { cx: 68, cy: 66, rx: 64, ry: 10 },
};

// A bike seen nose on, coming toward you down the canvas, its front wheel on the ground at (x, y): its back wheel
// beyond, the frame in its colour, the saddle, the fork, and the handlebars across with their grips. Seen nose on
// its wheels are nearly edge on, cheated a little wider so they read as wheels.
function bikeNoseOn(x: number, y: number, colour: string): FurniturePart[] {
  return [
    ellipse('panel', x, y - 34, 3.5, 11, T.tyre),
    ellipse('mark', x, y - 34, 1.4, 8, T.rim),
    path('mark', `M${x - 2} ${y - 40}h4v22h-4z`, colour),
    rect('mark', x - 4.5, y - 44, 9, 5, 2.5, T.tyre),
    ellipse('panel', x, y - 11, 3.5, 11, T.tyre),
    ellipse('mark', x, y - 11, 1.4, 8, T.rim),
    path('mark', `M${x - 1.2} ${y - 30}h2.4v18h-2.4z`, T.steel),
    path('line', `M${x - 10} ${y - 29}H${x + 10}`),
    rect('mark', x - 13, y - 30.5, 4, 3, 1.5, T.tyre),
    rect('mark', x + 9, y - 30.5, 4, 3, 1.5, T.tyre),
  ];
}

// A Sheffield stand seen from its end, cheated a little toward you so it reads: a narrow loop of tube, its far leg
// standing at y0 and its near leg at y1.
const hoopEndOn = (x: number, y0: number, y1: number): string =>
  `M${x - 6} ${y1}V${y0 - 20}Q${x - 6} ${y0 - 28} ${x} ${y0 - 28}Q${x + 6} ${y0 - 28} ${x + 6} ${y0 - 20}V${y0}H${x + 2}V${y0 - 20}Q${x + 2} ${y0 - 24} ${x} ${y0 - 24}Q${x - 2} ${y0 - 24} ${x - 2} ${y0 - 20}V${y1}Z`;

// Facing left: the pad runs down the canvas, the two stands one above the other along it, each bike beside its stand
// on the near (left) side, nose on to you.
const BIKE_RACK_SIDE: FurnitureDrawing = {
  width: 56,
  height: 152,
  parts: [
    ellipse('shadow', 28, 148, 25, 3),
    rect('panel', 4, 20, 48, 124, 3, T.concrete),
    rect('face', 4, 140, 48, 4, 1, T.concrete),
    path('panel', hoopEndOn(40, 56, 84) + hoopEndOn(40, 112, 138), T.steel),
    ...bikeNoseOn(22, 84, T.bikeRed),
    ...bikeNoseOn(22, 140, T.bikeTeal),
  ],
  seats: [],
  ring: { cx: 28, cy: 80, rx: 26, ry: 66 },
};

// --- The stage's pieces ---------------------------------------------------------------------------------------------

// One drape, its gathered folds and its gold tie-back, on the left; `m` mirrors an x across the piece for the right.
function drape(m: (x: number) => number): FurniturePart[] {
  const d = (s: string) => s.replace(/X(-?[\d.]+)/g, (_, x: string) => String(m(Number(x))));
  return [
    path('panel', d('MX0 6LX68 6CX61 38 X42 62 X36 75CX42 92 X54 107 X60 118LX0 118Z'), T.velvet),
    path(
      'mark',
      d(
        'MX18 8CX18 48 X14 68 X14 76CX16 94 X20 108 X22 118LX27 118CX25 108 X21 94 X20 76CX20 68 X23 48 X23 8Z',
      ),
      T.velvetDeep,
    ),
    path(
      'mark',
      d(
        'MX40 8CX38 40 X30 62 X27 76CX31 94 X38 108 X41 118LX45 118CX42 108 X35 94 X31 76CX35 62 X43 40 X45 8Z',
      ),
      T.velvetDeep,
    ),
    path('glint', d('MX7 14CX7 40 X6 60 X6 70')),
    path('panel', d('MX0 71LX38 73LX38 79LX0 79Z'), T.gold),
    ellipse('mark', m(36), 86, 3, 5, T.gold),
  ];
}

// The pelmet's lower edge: a scallop every 30 px across the width.
const PELMET = (() => {
  let d = 'M0 4H360V22';
  for (let x = 360; x > 0; x -= 30) d += `Q${x - 15} 34 ${x - 30} 22`;
  return `${d}Z`;
})();

// A proscenium of deep red velvet: a drape at each side gathered by a gold tie-back, open in the middle, under a
// scalloped pelmet with a gold band and a tassel at each scallop.
const STAGE_CURTAINS_VIEW: FurnitureDrawing = {
  width: 360,
  height: 120,
  parts: [
    ...drape((x) => x),
    ...drape((x) => 360 - x),
    path('panel', PELMET, T.velvet),
    rect('panel', 0, 0, 360, 7, 2, T.velvetDeep),
    rect('mark', 0, 12, 360, 3, 0, T.gold),
    path(
      'mark',
      Array.from({ length: 12 }, (_, i) => `M${i * 30 + 13} 28h4v5h-4z`).join(''),
      T.gold,
    ),
  ],
  seats: [],
  ring: { cx: 180, cy: 110, rx: 170, ry: 8 },
};

// A wooden lectern: a sloping top with a page of notes, a gooseneck microphone with a red light, a front panel with a
// brass emblem, on a foot.
const PODIUM_VIEW: FurnitureDrawing = {
  width: 56,
  height: 88,
  parts: [
    ellipse('shadow', 28, 85, 25, 3),
    rect('panel', 6, 76, 44, 9, 2, T.woodDeep),
    path('panel', 'M10 30H46L44 78H12Z', T.wood),
    path('mark', 'M38 31H45.4L43.5 77H37Z', T.woodDeep),
    path('glint', 'M15 36L16 70'),
    ellipse('mark', 26, 52, 6.5, 6.5, T.brass),
    ellipse('mark', 26, 52, 3.2, 3.2, T.woodDeep),
    path('panel', 'M13 23L16 15H38L41 23Z', T.paper),
    path('rail', 'M18 18.5H33M17 21H36'),
    rect('panel', 3, 22, 50, 9, 2, T.wood),
    path('line', 'M42 22C42 13 46 10 47 6'),
    ellipse('mark', 47.5, 5, 2.6, 3.2, T.mic),
    ellipse('mark', 42, 25.5, 1.4, 1.4, T.live),
  ],
  seats: [],
  ring: { cx: 28, cy: 80, rx: 24, ry: 6 },
};

// From behind, where the speaker stands: the sloping top tipped toward you with its page of notes, the microphone
// beyond it, the plain back panel with a shelf for papers, on its foot.
const PODIUM_BACK: FurnitureDrawing = {
  width: 56,
  height: 88,
  parts: [
    ellipse('shadow', 28, 85, 25, 3),
    rect('panel', 6, 76, 44, 9, 2, T.woodDeep),
    path('line', 'M14 14C14 9 10 6 9 3'),
    ellipse('mark', 8.5, 3, 2.6, 3.2, T.mic),
    path('panel', 'M3 16H53L50 30H6Z', T.wood),
    path('panel', 'M13 18L15 13H41L43 18L41 27H15Z', T.paper),
    path('rail', 'M18 18H38M18 21.5H35M18 25H37'),
    path('panel', 'M10 30H46L44 78H12Z', T.wood),
    path('mark', 'M11 30.6H18.6L17 77H12.5Z', T.woodDeep),
    rect('face', 14, 42, 28, 6, 1.5, T.woodDeep),
    path('rail', 'M16 60H40'),
  ],
  seats: [],
  ring: { cx: 28, cy: 80, rx: 24, ry: 6 },
};

// Facing left: the lectern's side, its top sloping down toward the speaker on the right, a strip of the front panel
// with the edge of its brass emblem down the left, the microphone curving back over the top, on its foot.
const PODIUM_SIDE: FurnitureDrawing = {
  width: 44,
  height: 88,
  parts: [
    ellipse('shadow', 22, 85, 20, 3),
    rect('panel', 4, 76, 36, 9, 2, T.woodDeep),
    path('panel', 'M14 28L36 34L35 78H15Z', T.wood),
    path('glint', 'M31 40V72'),
    path('panel', 'M7 28H15V78H10Z', T.wood),
    ellipse('mark', 11.5, 52, 2, 6.5, T.brass),
    path('panel', 'M5 20L40 29V35L5 26Z', T.wood),
    path('panel', 'M12 20.5L32 25.6L31 27.2L12 22.4Z', T.paper),
    path('line', 'M10 22C10 13 14 10 19 7'),
    ellipse('mark', 20, 6.4, 3.2, 2.6, T.mic),
    ellipse('mark', 10, 24.5, 1.4, 1.4, T.live),
  ],
  seats: [],
  ring: { cx: 22, cy: 80, rx: 20, ry: 6 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_VENUE_ART = {
  pillar: allSides(PILLAR_VIEW),
  column: allSides(COLUMN_VIEW),
  'car-park': { front: CAR_PARK_VIEW, back: CAR_PARK_BACK, side: CAR_PARK_SIDE },
  'bike-rack': { front: BIKE_RACK_VIEW, back: BIKE_RACK_BACK, side: BIKE_RACK_SIDE },
  'stage-curtains': allSides(STAGE_CURTAINS_VIEW),
  podium: { front: PODIUM_VIEW, back: PODIUM_BACK, side: PODIUM_SIDE },
} as const;

// --- The swimming pool ----------------------------------------------------------------------------------------------

// The pool's lane floats: one every 12 px, red and white in turn, and the length a pool needs before it has a lane.
const FLOAT_EVERY = 12;
const LANE_FROM = 200;

/**
 * A swimming pool's drawing, in its own px: a tiled deck round the box (its band is the walk's poolDeck, so the water
 * drawn is the water that blocks), the water in the element's fill (the floor), the inside of the back wall, two lane
 * stripes on the floor, a lane of floats down the middle of a long pool, a steel ladder at the back right and a glint.
 * A fixed handful of shapes however big the pool.
 */
export function swimmingPoolParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  const n = (v: number) => Math.round(v * 100) / 100;
  const d = poolDeck(width, height);
  const parts: FurniturePart[] = [rect('panel', 0, 0, width, height, 6, T.tile)];
  // The deck is at most a tenth of the shorter side, so there is always water inside it.
  const ww = width - 2 * d;
  const wh = height - 2 * d;
  parts.push(rect('floor', n(d), n(d), n(ww), n(wh), 3));
  // The coping's inner joint, half way across the deck.
  parts.push(
    path('rail', `M${n(d / 2)} ${n(d / 2)}H${n(width - d / 2)}V${n(height - d / 2)}H${n(d / 2)}Z`),
  );
  const wall = n(Math.min(10, wh * 0.15));
  if (wall >= 2) parts.push(rect('face', n(d), n(d), n(ww), wall, 0));
  // Along the pool's long side: the lane stripes on its floor at a quarter and three quarters, the floats between.
  const across = ww >= wh;
  const length = across ? ww : wh;
  const breadth = across ? wh - wall : ww;
  const inset = length * 0.1;
  const stripe = (at: number) =>
    across
      ? `M${n(d + inset)} ${n(at - 1.5)}h${n(length - 2 * inset)}v3h${n(-(length - 2 * inset))}z`
      : `M${n(at - 1.5)} ${n(d + inset)}v${n(length - 2 * inset)}h3v${n(-(length - 2 * inset))}z`;
  const origin = across ? d + wall : d;
  if (breadth >= 24)
    parts.push(
      path('mark', stripe(origin + breadth * 0.25) + stripe(origin + breadth * 0.75), T.lane),
    );
  if (length >= LANE_FROM && breadth >= 40) {
    const mid = origin + breadth / 2;
    const count = Math.floor((length - 8) / FLOAT_EVERY);
    const float = (i: number) => {
      const t = d + 4 + i * FLOAT_EVERY;
      return across ? `M${n(t)} ${n(mid - 2.5)}h8v5h-8z` : `M${n(mid - 2.5)} ${n(t)}h5v8h-5z`;
    };
    const red: string[] = [];
    const white: string[] = [];
    for (let i = 0; i < count; i += 1) (i % 2 ? white : red).push(float(i));
    parts.push(path('mark', red.join(''), T.float));
    parts.push(path('mark', white.join(''), T.floatWhite));
  }
  // The ladder down the back wall at the right, its handrails curving over the coping.
  if (ww >= 80 && wh >= 48) {
    const x = n(width - d - 34);
    const foot = n(d + wall + 12);
    parts.push(
      path(
        'line',
        `M${x} ${foot}V${n(d - 1)}Q${x} ${n(d - 7)} ${n(x - 6)} ${n(d - 7)}M${n(x + 12)} ${foot}V${n(d - 1)}Q${n(x + 12)} ${n(d - 7)} ${n(x + 6)} ${n(d - 7)}`,
      ),
    );
    parts.push(path('rail', `M${x} ${n(d + wall + 2)}h12M${x} ${n(d + wall + 8)}h12`));
  }
  parts.push(
    path(
      'glint',
      `M${n(d + ww * 0.08)} ${n(height - d - wh * 0.18)}q${n(ww * 0.06)} ${n(-wh * 0.05)} ${n(ww * 0.14)} 0`,
    ),
  );
  return parts;
}
