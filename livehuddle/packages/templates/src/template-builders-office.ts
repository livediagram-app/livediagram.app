// The Virtual Office template (docs/specs/012-collaboration/virtual-office-template.md): a whole office to walk
// round in Avatar mode, built from the office pieces (docs/specs/009-elements/office.md) and the furniture
// (docs/specs/009-elements/chair.md). A reception, a room of desks and a meeting room along the top of a corridor;
// a kitchen, a lounge and a quiet focus room along the bottom; every doorway onto the corridor, and an Avatar Pad
// in the middle of it. Every room has a reason to walk to it (Work Tracker 1076): the front desk's Welcome and bell,
// the desks, the meeting room's Screen, the kitchen's coffee and Suggestion Box, the lounge's Notice Board, jukebox and
// dog, and the focus room's Nap Pod and Phone Booth.
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], rooms first so they lie behind the furniture.

import { counterTopY, type Element } from '@livehuddle/document';
import { heading } from './template-session-parts';
import { arrival } from './template-arrival';
import type { TemplateNote } from './template-notes';
import { officePlan, type OfficePiece, type OfficeRoom } from './template-office-parts';

// The office's footprint: two rows of rooms either side of a corridor.
const ROW_H = 340;
// Deep enough for the Avatar Pad and the figure standing on it (see the test), without reaching a room.
const CORRIDOR = 270;
const GAP = 60;
const HEAD = 96;
const WIDTH = 1560;
const HEIGHT = HEAD + ROW_H * 2 + CORRIDOR;

type RoomSpec = Omit<OfficeRoom, 'h'>;

// The Kitchen's units stand with their feet level with the fridge's (36 + 136 = 84 + 88), the fridge's top clear of the
// room's name band like every tall piece at y 36.
const KITCHEN_UNIT_Y = 84;

// The Lounge's Notice Board, pinned when the office is made: how the office works, in four notes.
const OFFICE_NOTES: readonly TemplateNote[] = [
  {
    title: 'Welcome to the office',
    text: 'Walk up to someone to talk: voices fade as you walk away, and a room with walls keeps its call to itself.',
    color: 'yellow',
  },
  {
    title: 'Knock before you go in',
    text: 'The signs by the Meeting Room and the Focus Room show who is in. Press Knock on the sign, and they can let you in.',
    color: 'blue',
  },
  {
    title: 'Ideas welcome',
    text: 'The Suggestion Box in the Kitchen takes anonymous notes. Only Editors read them, and never who wrote them.',
    color: 'green',
  },
  {
    title: 'Make it yours',
    text: 'Rename the rooms, unpin these notes and pin your own. Everyone taking part can pin a note here.',
    color: 'purple',
  },
];

// Every room, its doorway onto the corridor, and what is in it, in room-relative px.
const ROOMS: RoomSpec[] = [
  {
    name: 'Reception',
    x: 0,
    y: 0,
    w: 420,
    door: 's',
    // Windows in its outside walls, the back and the left (docs/specs/009-elements/room-builder.md "Window").
    windows: [
      { side: 'n', at: 300 },
      { side: 'w', at: 140 },
    ],
    pieces: [
      // The front desk against the back wall, facing whoever walks in: its Welcome and its bell are the first thing
      // you reach (docs/specs/009-elements/workday-pieces.md "Reception Desk").
      { kind: 'reception-desk', x: 200, y: 48 },
      // The World Clock beside it, the team's time zones at a glance (docs/specs/009-elements/social-pieces.md).
      { kind: 'world-clock', x: 16, y: 44 },
      { kind: 'plant', x: 22, y: 124 },
      // A sofa to wait on, on its rug, left of the doorway's column.
      { kind: 'rug', x: 6, y: 196 },
      { kind: 'sofa', x: 8, y: 214, facing: 'n' },
      // A coat rack and an umbrella stand by the door (docs/specs/009-elements/office-amenities.md), clear of its way in.
      { kind: 'coat-rack', x: 300, y: 196 },
      { kind: 'umbrella-stand', x: 364, y: 260 },
    ],
  },
  {
    name: 'Desks',
    x: 420 + GAP,
    y: 0,
    w: 620,
    door: 's',
    windows: [
      { side: 'n', at: 200 },
      { side: 'n', at: 420 },
    ],
    pieces: [
      // One bench of desks, the near row facing the back row across it, so the floor round it is open aisle
      // (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
      { kind: 'desk', x: 20, y: 48, facing: 's' },
      { kind: 'desk', x: 140, y: 48, facing: 's' },
      { kind: 'desk', x: 260, y: 48, facing: 's' },
      { kind: 'bookshelf', x: 480, y: 40 },
      { kind: 'printer', x: 392, y: 56 },
      // The near row leaves the doorway's column (262..358) clear, so walking in never lands at a desk: two desks
      // on the left, and one on the right an aisle away.
      { kind: 'desk', x: 20, y: 160, facing: 'n' },
      { kind: 'desk', x: 140, y: 160, facing: 'n' },
      { kind: 'desk', x: 400, y: 190, facing: 'n' },
      { kind: 'plant', x: 540, y: 230 },
    ],
  },
  {
    name: 'Meeting Room',
    x: 420 + GAP + 620 + GAP,
    y: 0,
    w: 400,
    door: 's',
    // Glass, so you see from the corridor who is meeting (docs/specs/009-elements/office.md "Glass walls"), and a call
    // of its own behind them (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls").
    glass: true,
    pieces: [
      // A Screen on the back wall over the table: a share in the room shows on it
      // (docs/specs/009-elements/screen-and-room-sign.md "Screen").
      { kind: 'screen', x: 140, y: 4, w: 120 },
      { kind: 'meeting-table', x: 84, y: 80 },
      { kind: 'plant', x: 22, y: 52 },
      { kind: 'plant', x: 322, y: 52 },
    ],
  },
  {
    name: 'Kitchen',
    x: 0,
    y: ROW_H + CORRIDOR,
    w: 520,
    door: 'n',
    windows: [
      { side: 's', at: 130 },
      { side: 's', at: 390 },
      { side: 'w', at: 170 },
    ],
    pieces: [
      // A kitchenette along the back wall, either side of the door (docs/specs/009-elements/office-amenities.md
      // "Kitchenette"): a fridge and a counter with the microwave and the kettle on it, then the sink and the coffee
      // machine, their feet on one line.
      { kind: 'fridge', x: 20, y: 36 },
      { kind: 'kitchen-counter', x: 96, y: KITCHEN_UNIT_Y },
      { kind: 'microwave', x: 104, y: counterTopY('microwave', KITCHEN_UNIT_Y) },
      { kind: 'kettle', x: 170, y: counterTopY('kettle', KITCHEN_UNIT_Y) },
      { kind: 'kitchen-sink', x: 312, y: KITCHEN_UNIT_Y },
      { kind: 'coffee-machine', x: 432, y: 76 },
      { kind: 'water-cooler', x: 440, y: 196 },
      // The Suggestion Box by the kettle: a note dropped in it is anonymous, and only Editors read it
      // (docs/specs/009-elements/team-pieces.md "Suggestion Box").
      { kind: 'suggestion-box', x: 30, y: 210 },
      // Two chairs facing each other an aisle apart.
      { kind: 'chair', x: 150, y: 200, facing: 'w' },
      { kind: 'chair', x: 346, y: 200, facing: 'e' },
    ],
  },
  {
    name: 'Lounge',
    x: 520 + GAP,
    y: ROW_H + CORRIDOR,
    // 500 wide, so the bottom row is the top row's 1560.
    w: 500,
    door: 'n',
    windows: [
      { side: 's', at: 120 },
      { side: 's', at: 380 },
    ],
    pieces: [
      // The sofa on its rug, well inside: just behind the doorway it sat whoever walked in.
      { kind: 'rug', x: 150, y: 180 },
      { kind: 'bookshelf', x: 22, y: 40 },
      // The office's Notice Board on the back wall, right of the door, its notes pinned already (template-notes.ts).
      { kind: 'notice-board', x: 300, y: 40, notes: OFFICE_NOTES },
      { kind: 'sofa', x: 174, y: 200, facing: 'n' },
      // The chairs either side of the sofa, one seating group.
      { kind: 'chair', x: 86, y: 196, facing: 'w' },
      { kind: 'chair', x: 338, y: 196, facing: 'e' },
      // The Jukebox: its music plays in the Lounge, for whoever is in it (docs/specs/009-elements/social-pieces.md).
      { kind: 'jukebox', x: 420, y: 190 },
      // The office dog's bed (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"), off the doorway's
      // column, its dog wandering the Lounge.
      { kind: 'pet-bed', x: 8, y: 204 },
    ],
  },
  {
    name: 'Focus Room',
    x: 520 + GAP + 500 + GAP,
    y: ROW_H + CORRIDOR,
    w: 420,
    door: 'n',
    windows: [
      { side: 's', at: 110 },
      { side: 'e', at: 200 },
    ],
    pieces: [
      // Off the doorway's column, so walking in reaches the room before the desk.
      { kind: 'desk', x: 40, y: 120, facing: 's' },
      // A nap pod for a rest, which shows you as Focusing (docs/specs/009-elements/workday-pieces.md).
      { kind: 'nap-pod', x: 168, y: 190 },
      // A Phone Booth for a call away from everyone: a call of its own, and Busy while you sit in it.
      { kind: 'phone-booth', x: 296, y: 190 },
      { kind: 'plant', x: 20, y: 250 },
      // The shelf stands a little forward of the back wall, so the Room Sign on the wall's face clears it.
      { kind: 'bookshelf', x: 280, y: 52 },
    ],
  },
];

// A Room Sign 88 px wide (aspect locked) beside the doors people knock on (docs/specs/012-collaboration/knock.md): the
// Meeting Room's under its door in the corridor, the Focus Room's on the face of its back wall, each right of the
// doorway: a sign reads the room whose floor is within 64 px of it, and a back wall is too deep for one outside it
// (template-campus-parts.ts doorSign).
const SIGN_W = 88;
const SIGNS: OfficePiece[] = [
  { kind: 'room-sign', x: 1160 + 248 + 18, y: ROW_H + 10, w: SIGN_W },
  { kind: 'room-sign', x: 1140 + 258 + 18, y: ROW_H + CORRIDOR + 2, w: SIGN_W },
];

export function buildVirtualOffice(cx: number, cy: number): Element[] {
  const x0 = cx - WIDTH / 2;
  const y0 = cy - HEIGHT / 2;
  return officePlan(
    ROOMS.map((r) => ({ ...r, h: ROW_H })),
    x0,
    y0,
    HEAD,
    heading(
      x0,
      y0,
      WIDTH,
      'Our Office',
      210,
      'emoji-wave',
      'Walk in, find a desk, meet round the table and grab a coffee together. Rename the rooms to fit your team.',
    ),
    [
      // In the middle of the corridor every room opens onto, between the Desks' door and the Lounge's: the way in,
      // and what to do once you are.
      ...arrival({
        x: cx,
        y: cy + 48,
        hint: 'You arrive on the Avatar Pad. Ring the bell at Reception, grab a coffee in the Kitchen, or knock on the Meeting Room.',
      }),
    ],
    SIGNS,
  );
}
