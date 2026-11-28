// Real 3D's chairs (docs/specs/008-canvas/3d-engine.md "Believable chairs"): the dining chair (the Chair), the office
// chair at a Desk and a Hot Desk, and the meeting chair round a Meeting Table, each built round a sitter at a seat
// point: padded seats rolled at their edges, shaped backs, turned or tapered legs, a gas lift and a five-star base.
// The owner (2026-11-27): "Improve the aesthetic of the single chair, they look a bit rubbish".
//
// Every seat's top is exactly `SEAT_Z`, and every back stands clear of the rays seat-surface.ts casts down for the
// seat (6, 11, 16 and 21 px behind the sitter's feet; feet are 2 px ahead of the hips): the dining chair's between
// 16 and 21, the smaller chairs' between 11 and 16, so a sitter rests on the cushion, never on the back, and the back
// is found behind them. Pure: no three.js, no DOM.
import type { Rgb, Vec3 } from '../mesh-builder';
import { mix, SEAT_Z, type Builder, type ModelContext } from './kit';
import { pillow, type PillowStep } from './pillow';

type Seat = ModelContext['seats'][number];

/** Which way a sitter faces, as a unit step in the model's frame. */
export const FORWARD: Record<string, readonly [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  right: [1, 0],
  left: [-1, 0],
};

/**
 * Where a seated figure's hips are, ahead of (+) or behind (-) its seat point along the way it faces: the seat is
 * built about this so the figure sits on it.
 */
export const HIP = -2;

const WOOD = 0xb98352;
const WOOD_LIGHT = 0xcf9d6b;
const WOOD_DEEP = 0x7c4f2c;
const CHROME = 0xb4bcc6;
const CASTER = 0x23272e;

type Frame = {
  /** A point in the sitter's frame: u across them, v toward where they face (0 at the hips), z up. */
  at: (u: number, v: number, z: number) => Vec3;
  across: Vec3;
  fwd: Vec3;
};

/** A sitter's frame as points, and its `across` and `fwd` directions. */
export function sitterFrame(s: Seat): Frame {
  const [fx, fy] = FORWARD[s.facing] ?? [0, 1];
  const hx = s.x + fx * HIP;
  const hy = s.y + fy * HIP;
  return {
    at: (u, v, z) => [hx + fy * u + fx * v, hy - fx * u + fy * v, z],
    across: [fy, -fx, 0],
    fwd: [fx, fy, 0],
  };
}

/** A bevelled box in the sitter's frame, corner to corner. */
function box(
  m: Builder,
  P: Frame,
  u0: number,
  v0: number,
  z0: number,
  u1: number,
  v1: number,
  z1: number,
  colour: Rgb,
  top?: Rgb,
): void {
  const a = P.at(u0, v0, z0);
  const b = P.at(u1, v1, z1);
  m.b(a[0], a[1], a[2], b[0], b[1], b[2], colour, { top });
}

/** A seat cushion `thick` deep, rolled at its edges, its top exactly `SEAT_Z`. */
function seatCushion(
  m: Builder,
  P: Frame,
  v: number,
  hw: number,
  hd: number,
  radius: number,
  thick: number,
  fabric: Rgb,
): void {
  const dark = mix(fabric, 0x000000, 0.2);
  const k = thick / 3.2;
  pillow(
    m,
    { o: P.at(0, v, SEAT_Z - thick), a: P.across, b: P.fwd, c: [0, 0, 1] },
    hw,
    hd,
    radius,
    [
      { inset: 1.6 * k, c: 0 },
      { inset: 0.35 * k, c: 0.5 * k },
      { inset: 0, c: 1.5 * k },
      { inset: 0.3 * k, c: 2.5 * k },
      { inset: 1.3 * k, c: 3.05 * k },
      { inset: 3.2 * k, c: thick },
    ],
    fabric,
    { colours: [dark, dark, fabric, fabric, fabric], startFace: false, endFace: fabric },
  );
}

/**
 * A chair's back: a padded panel `2hw` wide and `2hd` tall about `(v, z)` (its rear face's middle), tilted back by
 * `tiltDeg`, `thick` through, curved round the sitter by `bend`; `shell` behind, the fabric in front.
 */
function chairBack(
  m: Builder,
  P: Frame,
  o: {
    v: number;
    z: number;
    hw: number;
    hd: number;
    radius: number;
    thick: number;
    tiltDeg: number;
    bend: number;
    fabric: Rgb;
    shell: Rgb;
  },
): void {
  const t = (o.tiltDeg * Math.PI) / 180;
  const up: Vec3 = [-P.fwd[0] * Math.sin(t), -P.fwd[1] * Math.sin(t), Math.cos(t)];
  const toward: Vec3 = [P.fwd[0] * Math.cos(t), P.fwd[1] * Math.cos(t), Math.sin(t)];
  const k = o.thick / 2.4;
  const steps: PillowStep[] = [
    { inset: 1 * k, c: 0 },
    { inset: 0.15 * k, c: 0.45 * k },
    { inset: 0, c: 1 * k },
    { inset: 0.25 * k, c: 1.9 * k },
    { inset: 1.3 * k, c: o.thick },
  ];
  pillow(
    m,
    { o: P.at(0, o.v, o.z), a: P.across, b: up, c: toward },
    o.hw,
    o.hd,
    o.radius,
    steps,
    o.fabric,
    {
      colours: [o.shell, o.shell, mix(o.fabric, 0x000000, 0.2), o.fabric],
      startFace: o.shell,
      endFace: o.fabric,
      bend: o.bend,
      corner: 3,
    },
  );
}

/**
 * The Chair: a wooden dining chair. Four turned legs tapering to the floor, an H of stretchers, a rolled cushion on a
 * wooden apron, and a curved back (a wooden shell, upholstered in front) on raked posts with a ball on each.
 */
export function diningChair(m: Builder, s: Seat, fabric: Rgb): void {
  const P = sitterFrame(s);
  const legTop = SEAT_Z - 4.5;
  for (const su of [-1, 1]) {
    // A front leg; a back leg running on up into its post, raked back; a ball on the post's top.
    m.tube(P.at(su * 18.4, 13.4, 0), P.at(su * 17.4, 12, legTop), 1.05, WOOD, {
      r1: 1.65,
      segments: 8,
    });
    m.tube(P.at(su * 18.4, -17.6, 0), P.at(su * 17.4, -15.6, legTop), 1.05, WOOD, {
      r1: 1.65,
      segments: 8,
    });
    m.tube(P.at(su * 17.4, -15.6, legTop - 0.5), P.at(su * 16.9, -19.3, SEAT_Z + 21), 1.6, WOOD, {
      r1: 1.25,
      segments: 8,
    });
    const top = P.at(su * 16.9, -19.3, SEAT_Z + 21.2);
    m.sphere(top[0], top[1], top[2], 1.35, 1.35, 1.35, WOOD_LIGHT, { segments: 8, rings: 4 });
    // A side stretcher between its legs.
    m.tube(P.at(su * 18, 12.9, 5), P.at(su * 18, -16.7, 5), 0.62, WOOD_DEEP, { segments: 6 });
  }
  m.tube(P.at(-18, -2, 5), P.at(18, -2, 5), 0.62, WOOD_DEEP, { segments: 6 });
  // The apron the cushion rests on, then the cushion.
  box(m, P, -18.6, -16.4, SEAT_Z - 5.6, 18.6, 13.4, SEAT_Z - 2.8, WOOD, WOOD_DEEP);
  seatCushion(m, P, -1.4, 20.2, 15.6, 5.5, 3.2, fabric);
  // The back, 16.5 to 20.5 px behind the feet.
  chairBack(m, P, {
    v: -18.5,
    z: SEAT_Z + 12.6,
    hw: 15.6,
    hd: 7.6,
    radius: 4,
    thick: 2.4,
    tiltDeg: 6,
    bend: 1.8,
    fabric,
    shell: WOOD,
  });
}

/**
 * An office chair at a desk: a five-star base on casters, a gas lift in a sleeve, the seat's mechanism, a padded seat,
 * armrests on L-shaped stems, and a padded back on a curved spine.
 */
export function officeChair(m: Builder, s: Seat, fabric: Rgb, frame: Rgb): void {
  const P = sitterFrame(s);
  const shell = mix(fabric, 0x000000, 0.35);
  // The base: a hub, five tapering arms, a caster at each arm's end.
  const hub = P.at(0, -1, 0);
  m.cylinder(hub[0], hub[1], 1.4, 3.6, 2.2, 1.9, frame, { segments: 14 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const u = Math.cos(a) * 10.5;
    const v = -1 + Math.sin(a) * 10.5;
    m.tube(P.at(Math.cos(a) * 1.5, -1 + Math.sin(a) * 1.5, 2.6), P.at(u, v, 2.1), 1.1, frame, {
      r1: 0.7,
      segments: 6,
    });
    const c = P.at(u, v, 0);
    m.cylinder(c[0], c[1], 0, 2.1, 1.2, 1.05, CASTER, { segments: 6 });
  }
  // The gas lift: a dark sleeve and the chrome column rising out of it.
  m.cylinder(hub[0], hub[1], 3.6, 7.2, 1.55, 1.45, frame, { segments: 12 });
  m.cylinder(hub[0], hub[1], 7.2, SEAT_Z - 4.6, 0.95, 0.95, CHROME, { segments: 12, caps: false });
  // The mechanism under the seat.
  box(m, P, -5, -5, SEAT_Z - 5.4, 5, 3, SEAT_Z - 3.3, frame);
  seatCushion(m, P, -0.5, 11.5, 10.8, 4.5, 3.4, fabric);
  // The armrests: a stem from under the seat, up and forward to a padded rest.
  for (const su of [-1, 1]) {
    m.tube(P.at(su * 8, -4, SEAT_Z - 3.6), P.at(su * 12.4, -4, SEAT_Z - 3), 0.7, frame, {
      segments: 6,
    });
    m.tube(P.at(su * 12.4, -4.5, SEAT_Z - 3.2), P.at(su * 12.4, -3, SEAT_Z + 6), 0.75, frame, {
      segments: 6,
    });
    box(m, P, su * 11.2, -8, SEAT_Z + 6, su * 13.6, 3, SEAT_Z + 7.6, shell, fabric);
  }
  // The spine from the mechanism up behind the seat to the back, then the back, 12 to 15 px behind the feet.
  m.tube(P.at(0, -5, SEAT_Z - 4.4), P.at(0, -10.6, SEAT_Z - 3.8), 0.9, frame, { segments: 6 });
  m.tube(P.at(0, -10.6, SEAT_Z - 3.8), P.at(0, -11.8, SEAT_Z + 7), 0.9, frame, { segments: 6 });
  chairBack(m, P, {
    v: -13,
    z: SEAT_Z + 14,
    hw: 10.6,
    hd: 8.6,
    radius: 4.5,
    thick: 2.2,
    tiltDeg: 3,
    bend: 1.6,
    fabric,
    shell,
  });
}

/**
 * A meeting chair: a padded seat on a slim frame with four tapered legs, the back legs rising into posts that carry a
 * padded back.
 */
export function legChair(m: Builder, s: Seat, fabric: Rgb, legs: Rgb): void {
  const P = sitterFrame(s);
  const shell = mix(fabric, 0x000000, 0.35);
  const legTop = SEAT_Z - 4.2;
  for (const su of [-1, 1]) {
    m.tube(P.at(su * 10.2, 9.4, 0), P.at(su * 9.4, 8.2, legTop), 0.65, legs, {
      r1: 0.95,
      segments: 6,
    });
    m.tube(P.at(su * 10.2, -10.8, 0), P.at(su * 9.4, -9.6, legTop), 0.65, legs, {
      r1: 0.95,
      segments: 6,
    });
    // The post from the back leg up beside the back.
    m.tube(P.at(su * 9.4, -9.6, legTop - 0.4), P.at(su * 9.4, -12.6, SEAT_Z + 17), 0.85, legs, {
      r1: 0.75,
      segments: 6,
    });
  }
  // The seat frame, then the cushion.
  box(m, P, -10.4, -10.2, SEAT_Z - 4.6, 10.4, 9.2, SEAT_Z - 2.8, legs);
  seatCushion(m, P, -0.6, 11.4, 10.6, 4.5, 3, fabric);
  // The back, 12 to 15 px behind the feet.
  chairBack(m, P, {
    v: -13,
    z: SEAT_Z + 11.5,
    hw: 10.2,
    hd: 6.6,
    radius: 4,
    thick: 2.2,
    tiltDeg: 3,
    bend: 1.4,
    fabric,
    shell,
  });
}
