// The Living Prism as a real box, so the mark can turn in 3D on hover
// (docs/specs/004-interface-design/brand-mark.md, "Size and motion").
//
// The box's corners sit at X, Z = ±1 in plan, its top and bottom at the mark's
// two diamond centres, and it is drawn in the artwork's isometric projection:
// screen x = (X - Z) * 65, screen y = (X + Z) * 37.5 + the face's centre y.
// Turned by 0 degrees and closed, every path equals the static artwork.

// Half the cube's projected width and height per plan unit.
const ISO_X = 65;
const ISO_Y = 37.5;
// Screen y of the top plate's and bottom fold's centres.
const TOP_Y = -75;
const BOTTOM_Y = 25;

// How far each face drifts out when the prism is fully open: the lid and the
// bottom fold in viewBox units, the sides as a share of the cube's half-width.
// Large enough to read as "opened up" at the 28px header size (about 4px).
export const PRISM_EXPLODE = { top: 40, bottom: 30, side: 0.36 } as const;

type Plan = readonly [number, number];

// The four side faces, as plan corners A and B and an outward normal. The
// corner order (top A, bottom A, bottom B, top B) matches the artwork's paths.
const SIDES: readonly { a: Plan; b: Plan; normal: Plan }[] = [
  { a: [-1, 1], b: [1, 1], normal: [0, 1] }, // front left at rest
  { a: [1, -1], b: [1, 1], normal: [1, 0] }, // front right at rest
  { a: [-1, -1], b: [1, -1], normal: [0, -1] },
  { a: [-1, -1], b: [-1, 1], normal: [-1, 0] },
];
// The diamonds' corners, in the artwork's order: the lid runs left, back,
// right, front at rest; the bottom fold left, front, right, back.
const TOP_CORNERS: readonly Plan[] = [
  [-1, 1],
  [-1, -1],
  [1, -1],
  [1, 1],
];
const BOTTOM_CORNERS: readonly Plan[] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

export type PrismPose = {
  // Turn about the vertical axis, in degrees.
  turn: number;
  // How open the prism is, 0 (closed) to 1.
  open: number;
};

export type PrismSide = {
  // Empty while the face points away from the viewer.
  d: string;
  // Opacity of the face's left-lit and right-lit layers: a face facing
  // screen-left wears the front-left gradient, one facing right the rear-right
  // gradient, and a face turning between them crossfades.
  left: number;
  right: number;
};

export type PrismFrame = { top: string; bottom: string; sides: PrismSide[] };

// "-130", "37.5", "0": two decimals at most, no trailing zeros, no "-0".
const num = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
const path = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${num(x)} ${num(y)}`).join('') + 'Z';

export function prismFrame({ turn, open }: PrismPose): PrismFrame {
  const rad = (turn * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotate = ([x, z]: Plan): Plan => [x * cos - z * sin, x * sin + z * cos];
  const project = ([x, z]: Plan, cy: number): [number, number] => [
    (x - z) * ISO_X,
    (x + z) * ISO_Y + cy,
  ];
  const topY = TOP_Y - open * PRISM_EXPLODE.top;
  const bottomY = BOTTOM_Y + open * PRISM_EXPLODE.bottom;
  const diamond = (corners: readonly Plan[], cy: number) =>
    path(corners.map((c) => project(rotate(c), cy)));

  const sides = SIDES.map(({ a, b, normal }) => {
    const [nx, nz] = rotate(normal);
    // The viewer looks along plan (-1, -1), so a face is seen while its
    // normal points toward (1, 1).
    if (nx + nz <= 1e-9) return { d: '', left: 0, right: 0 };
    const push = open * PRISM_EXPLODE.side;
    const out = ([x, z]: Plan): Plan => {
      const [rx, rz] = rotate([x, z]);
      return [rx + nx * push, rz + nz * push];
    };
    const [ta, tb] = [out(a), out(b)];
    const d = path([
      project(ta, TOP_Y),
      project(ta, BOTTOM_Y),
      project(tb, BOTTOM_Y),
      project(tb, TOP_Y),
    ]);
    // 1 facing fully screen-left, 0 fully screen-right.
    const leftness = Math.min(1, Math.max(0, (1 - (nx - nz)) / 2));
    // Rounded so float dust from the rotation never leaves a 1e-16 ghost layer.
    const fade = (v: number) => Math.round(Math.min(1, v) * 1000) / 1000;
    return { d, left: fade(2 * leftness), right: fade(2 * (1 - leftness)) };
  });
  return { top: diamond(TOP_CORNERS, topY), bottom: diamond(BOTTOM_CORNERS, bottomY), sides };
}

// The turn's pace (docs/specs/004-interface-design/motion.md lists it beside
// the hover stories): a slow, readable revolution, not a hover flick.
export const PRISM_SPIN_DEG_PER_S = 60;
// The spin eases up to pace over this long, so it never starts with a jolt.
export const PRISM_SPIN_RAMP_MS = 400;
// Opening, and settling back to rest once the pointer leaves.
export const PRISM_OPEN_MS = 700;
export const PRISM_SETTLE_MS = 450;

export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

// The settle: a cubic Hermite from the current turn, still moving at `velocity`
// (degrees per ms), to `target` at rest. Carrying the velocity in gives a small
// follow-through instead of a stop-and-reverse.
export function settleTurn(from: number, velocity: number, target: number, t: number): number {
  const s = Math.min(1, Math.max(0, t));
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  return h00 * from + h10 * PRISM_SETTLE_MS * velocity + h01 * target;
}

// The box looks the same every quarter turn, so the nearest one is home.
export const restingTurn = (turn: number) => Math.round(turn / 90) * 90;
