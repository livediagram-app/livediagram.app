// The Outdoor Spaces (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Garden Retreat and a City
// Park, open-air floors of Grass and Garden Paths with Trees and Outdoor Plants, built with spacePlan's open pieces
// (template-office-parts.ts): the lawn and the paths lie under everything, a room (the Garden Retreat's summer house)
// over them. With no walls round them, a Garden Fence or the trees hold the edge, and the Avatar Pad waits under the
// gate or the path, so walking in is walking up it.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { arrival } from './template-arrival';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';

// A garden fence or path of the given size: they are drawn to their own size, never aspect locked.
const run = (
  kind: 'garden-fence' | 'garden-path',
  x: number,
  y: number,
  w: number,
  h: number,
): OfficePiece => ({ kind, x, y, w, h });

// --- Garden Retreat ----------------------------------------------------------------

const GARDEN_W = 1200;
const GARDEN_H = 640;
const FENCE = 28;
// The gateway in the bottom fence, and the path up from it to the summer house's door.
const GATE_FROM = 520;
const GATE_TO = 680;
const PATH_W = 64;
const PATH_X = GARDEN_W / 2 - PATH_W / 2;
const HOUSE = { x: 440, y: 40, w: 320, h: 320 };

export function buildGardenRetreat(cx: number, cy: number): Element[] {
  const width = GARDEN_W;
  const height = SPACE_HEAD + GARDEN_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const open: OfficePiece[] = [
    { kind: 'grass', x: 0, y: 0, w: GARDEN_W, h: GARDEN_H },
    // From the gate to the summer house, and either side to somewhere to sit.
    run('garden-path', PATH_X, HOUSE.y + HOUSE.h, PATH_W, GARDEN_H - HOUSE.y - HOUSE.h),
    run('garden-path', 200, 420, PATH_X - 200, PATH_W),
    run('garden-path', PATH_X + PATH_W, 420, 1000 - PATH_X - PATH_W, PATH_W),
    // The fence round the garden, open at the gate.
    run('garden-fence', 0, 0, GARDEN_W, FENCE),
    run('garden-fence', 0, FENCE, FENCE, GARDEN_H - 2 * FENCE),
    run('garden-fence', GARDEN_W - FENCE, FENCE, FENCE, GARDEN_H - 2 * FENCE),
    run('garden-fence', 0, GARDEN_H - FENCE, GATE_FROM, FENCE),
    run('garden-fence', GATE_TO, GARDEN_H - FENCE, GARDEN_W - GATE_TO, FENCE),
    { kind: 'tree', x: 60, y: 60 },
    { kind: 'tree', x: 230, y: 150 },
    { kind: 'tree', x: 900, y: 60 },
    { kind: 'tree', x: 1030, y: 190 },
    { kind: 'outdoor-plant', x: 360, y: 250 },
    { kind: 'outdoor-plant', x: 780, y: 250 },
    // A pond on the lawn under the trees (docs/specs/009-elements/social-pieces.md "Pond").
    { kind: 'pond', x: 40, y: 312, w: 200, h: 100 },
    // A bench at the end of the left path; two chairs round a campfire at the end of the right one.
    { kind: 'bench', x: 134, y: 500 },
    // A dog's bed on the lawn beside the bench (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog").
    { kind: 'pet-bed', x: 292, y: 516 },
    // The chairs an aisle apart round the fire (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
    { kind: 'chair', x: 776, y: 500, facing: 'w' },
    { kind: 'campfire', x: 884, y: 500 },
    { kind: 'chair', x: 996, y: 500, facing: 'e' },
    // A planter either side of the gate.
    { kind: 'outdoor-plant', x: 440, y: 530 },
    { kind: 'outdoor-plant', x: 688, y: 530 },
  ];
  const rooms: OfficeRoom[] = [
    {
      name: 'Summer House',
      ...HOUSE,
      door: 's',
      // Windows in its side walls, onto the garden (docs/specs/009-elements/room-builder.md "Window").
      windows: [
        { side: 'w', at: 170 },
        { side: 'e', at: 170 },
      ],
      pieces: [
        { kind: 'meeting-table', x: 44, y: 40 },
        { kind: 'plant', x: 16, y: 224 },
        { kind: 'plant', x: 248, y: 224 },
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    width,
    rooms,
    {
      text: 'Garden Retreat',
      width: 320,
      sticker: 'emoji-blossom',
      subtitle:
        'Step outside: walk the paths, meet round the table in the summer house, or sit by the campfire.',
    },
    // On the lawn beside the summer house, its door and the campfire in view.
    arrival({
      x: cx + 336,
      y: cy - 4,
      hint: 'You arrive on the Avatar Pad. Meet in the summer house, or sit by the campfire.',
    }),
    open,
  );
}

// --- City Park ---------------------------------------------------------------------

const PARK_W = 1200;
const PARK_H = 700;
const PARK_PATH = 64;
const CROSS_X = PARK_W / 2 - PARK_PATH / 2;
const CROSS_Y = 318;
// The plaza where the paths meet: big enough for the fountain inside its ring of setts.
const PARK_MID_X = PARK_W / 2;
const PARK_MID_Y = CROSS_Y + PARK_PATH / 2;
const PARK_PLAZA = 300;
// How far from the plaza's middle each arm ends: where its straight sides meet the rim.
const PLAZA_IN = Math.sqrt((PARK_PLAZA / 2) ** 2 - (PARK_PATH / 2) ** 2) - PARK_PATH / 2;

export function buildCityPark(cx: number, cy: number): Element[] {
  const width = PARK_W;
  const height = SPACE_HEAD + PARK_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const open: OfficePiece[] = [
    { kind: 'grass', x: 0, y: 0, w: PARK_W, h: PARK_H },
    // Two paths meeting at a round plaza in the middle (docs/specs/009-elements/office.md "Garden Path": paths never
    // cross), each arm ending at its rim, the plaza over their ends and a fountain in its middle.
    run('garden-path', 0, CROSS_Y, PARK_MID_X - PLAZA_IN, PARK_PATH),
    run('garden-path', PARK_MID_X + PLAZA_IN, CROSS_Y, PARK_W - PARK_MID_X - PLAZA_IN, PARK_PATH),
    run('garden-path', CROSS_X, 0, PARK_PATH, PARK_MID_Y - PLAZA_IN),
    run('garden-path', CROSS_X, PARK_MID_Y + PLAZA_IN, PARK_PATH, PARK_H - PARK_MID_Y - PLAZA_IN),
    run(
      'garden-path',
      PARK_MID_X - PARK_PLAZA / 2,
      PARK_MID_Y - PARK_PLAZA / 2,
      PARK_PLAZA,
      PARK_PLAZA,
    ),
    { kind: 'fountain', x: PARK_MID_X - 68, y: PARK_MID_Y - 60 },
    // The bandstand, a Stage in the open: whoever stands on it is heard across the park.
    { kind: 'stage', x: 780, y: 420, stageCameras: true },
    // Top left and top right: trees, and a bench facing the plaza (docs/specs/009-elements/social-pieces.md).
    { kind: 'tree', x: 40, y: 40 },
    // A Ping-Pong Table on the lawn beside the first tree, as a city park has
    // (docs/specs/009-elements/social-pieces.md "Ping-Pong Table"), the bench below it moved along towards the path.
    { kind: 'ping-pong-table', x: 184, y: 60 },
    { kind: 'bench', x: 376, y: 200 },
    { kind: 'tree', x: 1040, y: 40 },
    { kind: 'tree', x: 900, y: 90 },
    { kind: 'bench', x: 734, y: 200 },
    // Bottom left: a picnic table under a tree.
    { kind: 'picnic-table', x: 140, y: 460 },
    { kind: 'tree', x: 420, y: 480 },
    { kind: 'outdoor-plant', x: 40, y: 420 },
    { kind: 'outdoor-plant', x: 40, y: 600 },
    // Bottom right: four seats facing the bandstand.
    ...[790, 870, 950, 1030].map((x) => ({
      kind: 'chair' as const,
      x,
      y: 596,
      facing: 's' as const,
    })),
  ];
  return spacePlan(
    x0,
    y0,
    width,
    [],
    {
      text: 'City Park',
      width: 240,
      sticker: 'emoji-sun',
      subtitle:
        'Take the meeting outside: stroll the paths, sit on a bench, or gather round the bandstand.',
    },
    // On the open lawn above the fountain plaza, between the north path and the trees, off the paths and the
    // bandstand, its line under it clear of the path stones and the bench.
    arrival({
      x: cx + 165,
      y: cy - 255,
      hintW: 260,
      hint: 'You arrive on the Avatar Pad. A bench seats two, the picnic table six.',
    }),
    open,
  );
}
