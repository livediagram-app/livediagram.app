// The Conference Venue and the Startup HQ (docs/specs/012-collaboration/virtual-office-template.md "Campus Spaces"),
// the Company Campus's siblings, built with campusPlan (template-campus-parts.ts).
//
// - Conference Venue: a main hall with a Stage across the top between a foyer bar and a speakers' green room, a row of
//   breakout rooms and a quiet room along the bottom, and a formal courtyard between them: a promenade with a path to
//   every door, crossing the main path at a round fountain plaza, a cafe terrace, ponds and benches.
// - Startup HQ: a studio of desks, a town hall with a Stage and a kitchen bar along the top, a games room below, and a
//   garden to work in between them: a path along the front meeting the main path at a small round junction, a campfire
//   circle, a pond, a hammock and two Office Pods out on the lawn.
//
// Spacious by the same rule as the Company Campus: seats are one row or an aisle (120 px) apart. campusPlan runs a path
// out from every door to the walk it names and stands the door's sign beside it; paths join as the Company Campus's do.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import type { TemplateNote } from './template-notes';
import {
  campusPlan,
  fencedLawn,
  JUNCTION,
  PATH,
  plaza,
  plazaReach,
  run,
  type CampusRoom,
} from './template-campus-parts';

const GATE = 72;

// A row of chairs facing a stage up the room.
const seats = (xs: readonly number[], ys: readonly number[]): OfficePiece[] =>
  ys.flatMap((y) => xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })));

// A row of bar stools in front of a bar along the back wall.
const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));

// --- Conference Venue -----------------------------------------------------------------

const CV_W = 2120;
const CV_H = 1460;
const CV_MID = CV_W / 2;
const PROMENADE_Y = 896;
const BREAKOUT_Y = 1100;
const BREAKOUT_H = 320;
// The top row's walls, and how far each door's path runs to the promenade (or up from the breakouts to it).
const TOP_WALL = 680;
const DOWN_TO_PROMENADE = PROMENADE_Y - TOP_WALL;
const UP_TO_PROMENADE = BREAKOUT_Y - PROMENADE_Y - PATH;
// The fountain plaza where the promenade crosses the main path.
const CV_PLAZA_Y = PROMENADE_Y + PATH / 2;
const CV_PLAZA = 300;
const CV_PLAZA_IN = plazaReach(CV_PLAZA);

// A breakout room: a table to work round, a screen on the wall and a plant, its door in the back wall.
function breakout(name: string, x: number, w: number, sign: -1 | 1): CampusRoom {
  const at = w / 2;
  return {
    name,
    x,
    y: BREAKOUT_Y,
    w,
    h: BREAKOUT_H,
    door: { side: 'n', at, sign, reach: UP_TO_PROMENADE },
    // A window in the back wall, onto the garden (docs/specs/009-elements/room-builder.md "Window").
    windows: [{ side: 's', at }],
    pieces: [
      // The sign hangs right of the door, clear of the room's name on the left of the back wall.
      { kind: 'screen', x: 24, y: 44, w: 110 },
      { kind: 'meeting-table', x: at - 116, y: 140 },
      { kind: 'plant', x: w - 80, y: 50 },
    ],
  };
}

const CV_ROOMS: CampusRoom[] = [
  {
    name: 'Foyer Bar',
    x: 40,
    y: 40,
    // A wall's width over the Main Hall's, so the two share one wall (office.md "Rooms line up").
    w: 470,
    h: 640,
    door: { side: 's', at: 235, sign: 1, reach: DOWN_TO_PROMENADE },
    windows: [
      { side: 'w', at: 200 },
      { side: 'w', at: 480 },
    ],
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'drinks-fridge', x: 300, y: 36 },
      ...stools([60, 120, 180, 240], 170),
      { kind: 'jukebox', x: 12, y: 260, facing: 'w' },
      { kind: 'drinks-cabinet', x: 380, y: 250, facing: 'e' },
      { kind: 'rug', x: 150, y: 380 },
      { kind: 'sofa', x: 174, y: 400, facing: 'n' },
      { kind: 'chair', x: 92, y: 400, facing: 'w' },
      { kind: 'plant', x: 330, y: 540 },
      // Somewhere to hang a coat, by the bar's door (docs/specs/009-elements/office-amenities.md).
      { kind: 'coat-rack', x: 30, y: 480 },
      { kind: 'umbrella-stand', x: 96, y: 560 },
    ],
  },
  {
    name: 'Main Hall',
    x: 500,
    y: 40,
    w: 1120,
    h: 640,
    // Its door's path runs down onto the fountain plaza.
    door: { side: 's', at: 560, sign: 1, reach: CV_PLAZA_Y - CV_PLAZA_IN - TOP_WALL - PATH / 2 },
    windows: [
      { side: 'w', at: 400 },
      { side: 'e', at: 400 },
    ],
    pieces: [
      { kind: 'stage', x: 320, y: 48, w: 480, h: 150, stageCameras: true },
      // Its curtains and the speaker's podium (docs/specs/009-elements/venue-pieces.md "In the templates").
      { kind: 'stage-curtains', x: 320, y: 14, w: 480 },
      { kind: 'podium', x: 680, y: 80 },
      { kind: 'screen', x: 60, y: 44, w: 176 },
      { kind: 'screen', x: 960, y: 44, w: 140 },
      // Two rows of five either side of a 160 px aisle up from the door, 120 px between the rows.
      ...seats([92, 170, 248, 326, 404], [290, 494]),
      ...seats([640, 718, 796, 874, 952], [290, 494]),
    ],
  },
  {
    name: 'Green Room',
    x: 1610,
    y: 40,
    w: 470,
    h: 360,
    door: { side: 's', at: 235, sign: -1, reach: PROMENADE_Y - 400 },
    windows: [{ side: 'e', at: 200 }],
    pieces: [
      // A sofa on its rug and a chair beside it, back from the door, and coffee for the speakers.
      { kind: 'water-cooler', x: 20, y: 40 },
      { kind: 'coffee-machine', x: 90, y: 50 },
      { kind: 'rug', x: 180, y: 150 },
      { kind: 'sofa', x: 204, y: 170, facing: 'n' },
      { kind: 'chair', x: 122, y: 168, facing: 'w' },
      { kind: 'plant', x: 330, y: 44 },
    ],
  },
  // Breakouts 1 and 2 share a wall, as Breakout 3 and the Quiet Room do; the main path runs between the pairs.
  breakout('Breakout 1', 40, 490, 1),
  breakout('Breakout 2', 520, 420, 1),
  breakout('Breakout 3', 1180, 470, 1),
  {
    name: 'Quiet Room',
    x: 1640,
    y: BREAKOUT_Y,
    w: 440,
    h: BREAKOUT_H,
    door: { side: 'n', at: 220, sign: 1, reach: UP_TO_PROMENADE },
    windows: [
      { side: 's', at: 220 },
      { side: 'e', at: 160 },
    ],
    pieces: [
      { kind: 'office-pod', x: 40, y: 150 },
      { kind: 'office-pod', x: 224, y: 150 },
      { kind: 'plant', x: 380, y: 44 },
    ],
  },
];

const CV_COURTYARD: OfficePiece[] = [
  ...fencedLawn(CV_W, CV_H, CV_MID - GATE, CV_MID + GATE),
  // The promenade in two halves, each ending at the plaza's rim (every door's path ends under it), the main path from
  // the plaza to the gate, and the plaza over their ends with the fountain in its middle.
  run('garden-path', 160, PROMENADE_Y, CV_MID - CV_PLAZA_IN - 160, PATH),
  run('garden-path', CV_MID + CV_PLAZA_IN, PROMENADE_Y, 1960 - CV_MID - CV_PLAZA_IN, PATH),
  run(
    'garden-path',
    CV_MID - PATH / 2,
    CV_PLAZA_Y + CV_PLAZA_IN,
    PATH,
    CV_H - CV_PLAZA_Y - CV_PLAZA_IN,
  ),
  plaza(CV_MID, CV_PLAZA_Y, CV_PLAZA),
  { kind: 'fountain', x: CV_MID - 68, y: CV_PLAZA_Y - 60 },
  // The cafe terrace outside the foyer bar: garden benches under the umbrellas (an indoor chair never stands outside).
  { kind: 'garden-umbrella', x: 470, y: 696 },
  { kind: 'bench', x: 596, y: 744, facing: 'w' },
  { kind: 'garden-umbrella', x: 700, y: 696 },
  { kind: 'bench', x: 826, y: 744, facing: 'e' },
  // Trees and benches along the promenade's far side, and a tree by the green room.
  { kind: 'tree', x: 1240, y: 696, w: 112 },
  { kind: 'bench', x: 1400, y: 772 },
  { kind: 'bench', x: 1660, y: 772 },
  { kind: 'tree', x: 1700, y: 520 },
  { kind: 'tree', x: 1990, y: 470, w: 64 },
  // Between the breakouts: two ponds, benches and trees.
  { kind: 'tree', x: 140, y: 966, w: 64 },
  { kind: 'pond', x: 420, y: 966, w: 160, h: 70 },
  { kind: 'bench', x: 770, y: 970, facing: 'e' },
  { kind: 'bench', x: 1250, y: 970, facing: 'w' },
  { kind: 'pond', x: 1540, y: 966, w: 180, h: 70 },
  { kind: 'tree', x: 1990, y: 966, w: 64 },
  // The Directory just inside the gate.
  { kind: 'directory', x: 950, y: 1300 },
];

export function buildConferenceVenue(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: CV_W,
    height: CV_H,
    rooms: CV_ROOMS,
    open: CV_COURTYARD,
    // In the Main Hall, where the keynote is, in the aisle between its first two rows, facing the stage.
    arrival: {
      dx: 0,
      dy: -308,
    },
  });
}

// --- Startup HQ ------------------------------------------------------------------------

const HQ_W = 2100;
const HQ_H = 1340;
const HQ_GATE = 1200;
// The path along the front of the building, a junction where the main path meets it below the town hall's door.
const HQ_PATH_Y = 776;
const HQ_JOIN_Y = HQ_PATH_Y + PATH / 2;
const HQ_JOIN_IN = plazaReach(JUNCTION);
const GAMES_Y = HQ_PATH_Y + PATH + 72;

// The Studio's Notice Board, pinned when the HQ is made (template-notes.ts): how the week runs.
const HQ_NOTES: readonly TemplateNote[] = [
  {
    title: 'Friday demo',
    text: 'Show what you shipped this week in the Town Hall, Friday at 4. Five minutes each, and the Screen is yours.',
    color: 'pink',
  },
  {
    title: 'Calls go outside',
    text: 'Take a call in an Office Pod on the lawn. Its door shuts once both seats are taken, so knock first.',
    color: 'green',
  },
  {
    title: 'Got an idea?',
    text: 'Drop it in the Suggestion Box in the Kitchen Bar. It is anonymous, and only Editors read it.',
    color: 'blue',
  },
  {
    title: 'This week',
    text: 'Pin what you are working on, and unpin it when it ships.',
    color: 'yellow',
  },
];

// An island of four desks, two facing two.
const island = (x: number, y: number): OfficePiece[] => [
  { kind: 'desk', x, y, facing: 'n' },
  { kind: 'desk', x: x + 136, y, facing: 'n' },
  { kind: 'desk', x, y: y + 112, facing: 's' },
  { kind: 'desk', x: x + 136, y: y + 112, facing: 's' },
];

const HQ_ROOMS: CampusRoom[] = [
  {
    name: 'Studio',
    x: 60,
    y: 60,
    // The three buildings along the top share their walls (office.md "Rooms line up").
    w: 770,
    h: 480,
    door: { side: 's', at: 385, sign: 1, reach: HQ_PATH_Y - 540 },
    // Windows in its outside walls (docs/specs/009-elements/room-builder.md "Window").
    windows: [{ side: 'w', at: 240 }],
    pieces: [
      // Two islands of desks, 120 px apart, and the studio's shelf, coffee and team board along the front.
      ...island(30, 100),
      // The second island's back row stands, at two Standing Desks level with the desks they back onto, and the
      // office dog's bed lies in the aisle between the islands (docs/specs/009-elements/workday-pieces.md).
      { kind: 'standing-desk', x: 446, y: 108, facing: 'n' },
      { kind: 'standing-desk', x: 574, y: 108, facing: 'n' },
      { kind: 'desk', x: 446, y: 212, facing: 's' },
      { kind: 'desk', x: 582, y: 212, facing: 's' },
      { kind: 'pet-bed', x: 340, y: 300 },
      { kind: 'bookshelf', x: 30, y: 360 },
      { kind: 'coffee-machine', x: 220, y: 380, facing: 's' },
      { kind: 'notice-board', x: 470, y: 330, notes: HQ_NOTES },
    ],
  },
  {
    name: 'Town Hall',
    x: 820,
    y: 60,
    w: 760,
    h: 600,
    door: { side: 's', at: 380, sign: 1, reach: HQ_JOIN_Y - HQ_JOIN_IN - 660 - PATH / 2 },
    windows: [
      { side: 'w', at: 380 },
      { side: 'e', at: 380 },
    ],
    pieces: [
      { kind: 'stage', x: 200, y: 48, stageCameras: true },
      { kind: 'screen', x: 40, y: 44, w: 140 },
      ...seats([68, 146, 224], [280, 484]),
      ...seats([460, 538, 616], [280, 484]),
    ],
  },
  {
    name: 'Kitchen Bar',
    x: 1570,
    y: 60,
    w: 490,
    h: 560,
    door: { side: 's', at: 245, sign: -1, reach: HQ_PATH_Y - 620 },
    windows: [
      { side: 'e', at: 200 },
      { side: 'e', at: 420 },
    ],
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'drinks-fridge', x: 300, y: 36 },
      ...stools([60, 120, 180, 240], 170),
      { kind: 'coffee-machine', x: 420, y: 170, facing: 'e' },
      { kind: 'chair', x: 40, y: 360, facing: 'w' },
      { kind: 'chair', x: 124, y: 360, facing: 'e' },
      { kind: 'water-cooler', x: 420, y: 320, facing: 'e' },
      // The Suggestion Box between the stools and the chairs, for an idea over a coffee
      // (docs/specs/009-elements/team-pieces.md "Suggestion Box").
      { kind: 'suggestion-box', x: 230, y: 250 },
      { kind: 'plant', x: 330, y: 460 },
    ],
  },
  {
    name: 'Games Room',
    x: 1380,
    y: GAMES_Y,
    w: 500,
    h: 380,
    door: { side: 'n', at: 250, sign: -1, reach: GAMES_Y - HQ_PATH_Y - PATH },
    windows: [
      { side: 's', at: 250 },
      { side: 'e', at: 190 },
    ],
    pieces: [
      // A Dartboard on the left wall (docs/specs/009-elements/social-pieces.md), the way in's Room Sign on the back
      // wall left of the door.
      { kind: 'dartboard', x: 12, y: 220 },
      { kind: 'ping-pong-table', x: 90, y: 160 },
      // The two arcade machines side by side against the back wall right of the door, facing the room, their full
      // depth on the floor (3d-engine.md "Block models"); the jukebox on the front wall.
      { kind: 'arcade-machine', x: 340, y: 40 },
      { kind: 'arcade-machine', x: 416, y: 40 },
      { kind: 'jukebox', x: 120, y: 300, facing: 's' },
      { kind: 'plant', x: 20, y: 50 },
    ],
  },
];

const HQ_GARDEN: OfficePiece[] = [
  ...fencedLawn(HQ_W, HQ_H, HQ_GATE - GATE, HQ_GATE + GATE),
  // The path along the front in two halves, each ending at the junction's rim (every door's path ends under it), the
  // main path from the junction to the gate, and the junction over their ends.
  run('garden-path', 300, HQ_PATH_Y, HQ_GATE - HQ_JOIN_IN - 300, PATH),
  run('garden-path', HQ_GATE + HQ_JOIN_IN, HQ_PATH_Y, 1960 - HQ_GATE - HQ_JOIN_IN, PATH),
  run(
    'garden-path',
    HQ_GATE - PATH / 2,
    HQ_JOIN_Y + HQ_JOIN_IN,
    PATH,
    HQ_H - HQ_JOIN_Y - HQ_JOIN_IN,
  ),
  plaza(HQ_GATE, HQ_JOIN_Y, JUNCTION),
  // Trees in the garden's far corner, a planter by the studio.
  { kind: 'tree', x: 1960, y: 1190, w: 64 },
  { kind: 'tree', x: 1320, y: 1200, w: 64 },
  { kind: 'outdoor-plant', x: 640, y: 580 },
  // The garden to work in: a pond, trees, a campfire circle, two Office Pods for calls and a hammock.
  { kind: 'pond', x: 80, y: 860, w: 260, h: 150 },
  { kind: 'tree', x: 40, y: 1040 },
  { kind: 'tree', x: 370, y: 870 },
  { kind: 'bench', x: 470, y: 914, facing: 'w' },
  { kind: 'campfire', x: 620, y: 920 },
  { kind: 'bench', x: 744, y: 914, facing: 'e' },
  { kind: 'bench', x: 590, y: 1070, facing: 's' },
  { kind: 'office-pod', x: 940, y: 870 },
  { kind: 'office-pod', x: 160, y: 1050 },
  { kind: 'hammock', x: 480, y: 1210 },
  { kind: 'outdoor-plant', x: 960, y: 1040 },
  { kind: 'outdoor-plant', x: 1290, y: 870 },
  // A bike rack by the gate (docs/specs/009-elements/venue-pieces.md "In the templates").
  { kind: 'bike-rack', x: HQ_GATE - PATH / 2 - 190, y: 1222 },
  // Beside the games room: a garden umbrella.
  { kind: 'garden-umbrella', x: 1920, y: 880 },
  { kind: 'outdoor-plant', x: 1940, y: 1060 },
  // The Directory just inside the gate, and across the main path a Signpost whose arrows walk you to the nearest
  // rooms (docs/specs/009-elements/team-pieces.md "Signpost").
  { kind: 'directory', x: 1080, y: 1080 },
  { kind: 'signpost', x: 1260, y: 1080 },
];

export function buildStartupHq(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: HQ_W,
    height: HQ_H,
    rooms: HQ_ROOMS,
    open: HQ_GARDEN,
    // In the Town Hall, where the Friday demo is, in the aisle between its first two rows, facing the stage.
    arrival: {
      dx: 150,
      dy: -238,
    },
  });
}
