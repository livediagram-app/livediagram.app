// Real 3D's doors (docs/specs/008-canvas/3d-view.md "Doorways", room-builder.md "Door types" and "Opening on their
// own"): each door type's model standing in its doorway, its moving parts built apart about their pivots so the view
// can swing, slide or turn them, and the rule that opens a door while a character is near it and shuts it behind them.
// Pure: no three.js, no DOM. The frame and lintel round a doorway are scene-walls.ts's.

import { pieceVariant } from '@livehuddle/document';
import { SPACE_DOOR_HEIGHT, type SpaceWall } from '@/lib/space-3d/space-3d-walls';
import { MeshBuilder, mix, type Rgb } from './mesh-builder';
import type { WallPalette } from './scene-walls';

/** How near (canvas px, to the door's opening) a character's feet open a door, on either side. */
export const DOOR_OPEN_REACH = 80;
/** How long a door stays open once nobody is near it. */
export const DOOR_CLOSE_DELAY_MS = 600;
/** How long a door takes to open, and to close. */
export const DOOR_OPEN_MS = 350;
export const DOOR_CLOSE_MS = 500;
/** How far a swinging leaf opens, out of the wall to the side the plan's arc shows. */
export const DOOR_SWING = (85 * Math.PI) / 180;
/** How fast a revolving door's wings turn while anyone is near (radians a second): a quarter turn in about 1.6 s. */
export const DOOR_SPIN_SPEED = 1;

/** The frame's width at each jamb and over the head (scene-walls.ts draws it). */
export const DOOR_FRAME = 4;
const LEAF_T = 3;
const BRASS = 0xc9a227;
const METAL = 0xcbd5e1;
const STEEL = 0x8a96a8;

/**
 * One part of a door in its doorway: its blocks built about its own pivot (x along the wall from `a` to `b`, y across
 * it toward the side the plan's arc shows, z up), placed at `pivot` turned `angle` (radians) to the wall. `move` says
 * what the opening does to it: `swing` turns it about the pivot by `open` radians at full open, `slide` slides it
 * `open` px along the wall, `spin` turns it on and on (a revolving door's wings), `fixed` leaves it standing.
 */
export type DoorPart = {
  builder: MeshBuilder;
  pivot: { x: number; y: number };
  angle: number;
  move: 'swing' | 'slide' | 'spin' | 'fixed';
  open: number;
};

type P = { x: number; y: number };

/** A builder that cuts every block at `cap` and caps it, as a cut-down wall is (scene-walls.ts `wallMesh`). */
function cappedSlab(m: MeshBuilder, p: WallPalette, cap: number) {
  return (
    a: P,
    b: P,
    t: number,
    z0: number,
    z1: number,
    colour: Rgb,
    opts: { top?: Rgb; glass?: boolean; bare?: boolean } = {},
  ) => {
    if (z0 >= cap) return;
    if (z1 <= cap) return m.slab(a, b, t, z0, z1, colour, opts);
    m.slab(a, b, t, z0, cap, opts.glass ? mix(p.glass, 0x94a3b8, 0.7) : colour, { top: p.wallTop });
  };
}

type Slab = ReturnType<typeof cappedSlab>;

// A leaf in its own px: from x0 to x1 along the wall (either way round), floor to `h`.
type Leaf = { x0: number; x1: number; h: number };

const at = (x: number, y = 0): P => ({ x, y });

/** A wooden leaf with two raised panels and a brass handle on both faces near its free edge (`handleAt`). */
function woodLeaf(s: Slab, p: WallPalette, { x0, x1, h }: Leaf, handleAt: number): void {
  const wood = p.door;
  s(at(x0), at(x1), LEAF_T, 0, h, wood, { top: mix(wood, 0xffffff, 0.2) });
  const w = x1 - x0;
  const inset = Math.sign(w) * Math.min(6, Math.abs(w) / 6);
  const panel = mix(wood, 0xffffff, 0.14);
  s(at(x0 + inset), at(x1 - inset), LEAF_T + 1.4, 8, h * 0.44, panel, { top: panel });
  s(at(x0 + inset), at(x1 - inset), LEAF_T + 1.4, h * 0.52, h - 8, panel, { top: panel });
  handle(s, handleAt, h * 0.47, BRASS);
}

/** A wooden leaf glazed above a raised panel, as each leaf of a Double Door is. */
function glazedLeaf(s: Slab, p: WallPalette, { x0, x1, h }: Leaf, handleAt: number): void {
  const wood = p.door;
  const top = { top: mix(wood, 0xffffff, 0.2) };
  const w = x1 - x0;
  const rail = Math.sign(w) * Math.min(6, Math.abs(w) / 6);
  const sill = h * 0.48;
  // Stiles, rails and the lower panel in wood; the upper light in glass.
  s(at(x0), at(x0 + rail), LEAF_T, 0, h, wood, top);
  s(at(x1 - rail), at(x1), LEAF_T, 0, h, wood, top);
  s(at(x0), at(x1), LEAF_T, 0, sill, wood, top);
  s(at(x0), at(x1), LEAF_T, h - 6, h, wood, top);
  const panel = mix(wood, 0xffffff, 0.14);
  s(at(x0 + rail * 1.6), at(x1 - rail * 1.6), LEAF_T + 1.4, 8, sill - 8, panel, { top: panel });
  s(at(x0 + rail), at(x1 - rail), 1.2, sill, h - 6, p.glass, { glass: true, bare: true });
  // A glazing bar across the light's middle.
  s(
    at(x0 + rail),
    at(x1 - rail),
    LEAF_T,
    (sill + h - 6) / 2 - 1,
    (sill + h - 6) / 2 + 1,
    wood,
    top,
  );
  handle(s, handleAt, h * 0.45, BRASS);
}

/** A glass leaf in a slim metal frame, with a bar handle (a glass wall's door, a Sliding Door's panel). */
function glassLeaf(
  s: Slab,
  p: WallPalette,
  { x0, x1, h }: Leaf,
  handleAt: number,
  frame: Rgb,
): void {
  const w = x1 - x0;
  const f = Math.sign(w) * 3;
  s(at(x0), at(x0 + f), LEAF_T + 0.6, 0, h, frame);
  s(at(x1 - f), at(x1), LEAF_T + 0.6, 0, h, frame);
  s(at(x0), at(x1), LEAF_T + 0.6, 0, 5, frame);
  s(at(x0), at(x1), LEAF_T + 0.6, h - 3, h, frame);
  s(at(x0 + f), at(x1 - f), 1.2, 5, h - 3, p.glass, { glass: true, bare: true });
  // The bar: an upright pull standing off both faces.
  s(at(handleAt - 1), at(handleAt + 1), LEAF_T + 7, h * 0.3, h * 0.66, frame);
}

/** A handle: a small block through the leaf, standing off both faces. */
function handle(s: Slab, x: number, z: number, colour: Rgb): void {
  s(at(x - 2.5), at(x + 2.5), LEAF_T + 5, z - 1.4, z + 1.4, colour, { top: colour });
}

/**
 * A doorway's door, part by part, for the door's type (room-builder.md "Door types"); with `cap`, cut down to that
 * height and capped, as the wall it stands in is when it is cut away. Nothing for a wall that is not a doorway.
 */
export function doorParts(wall: SpaceWall, p: WallPalette, cap = Infinity): DoorPart[] {
  if (wall.kind !== 'doorway') return [];
  const { a, b } = wall;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 2 * DOOR_FRAME + 4) return [];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // The opening between the jambs, along the wall.
  const ia = { x: a.x + ux * DOOR_FRAME, y: a.y + uy * DOOR_FRAME };
  const ib = { x: b.x - ux * DOOR_FRAME, y: b.y - uy * DOOR_FRAME };
  const w = len - 2 * DOOR_FRAME;
  const h = SPACE_DOOR_HEIGHT - DOOR_FRAME;
  const glass = wall.glass === true;
  const out: DoorPart[] = [];
  const part = (pivot: P, move: DoorPart['move'], open: number, draw: (s: Slab) => void) => {
    const m = new MeshBuilder();
    draw(cappedSlab(m, p, cap));
    out.push({ builder: m, pivot, angle, move, open });
  };
  const type = pieceVariant({ shape: 'door', variant: wall.variant });
  if (type === 'double') {
    // Two leaves hinged at the jambs, meeting in the middle, both swinging to the arc's side.
    const half = w / 2;
    part(ia, 'swing', DOOR_SWING, (s) =>
      glass
        ? glassLeaf(s, p, { x0: 0, x1: half - 0.5, h }, half - 8, METAL)
        : glazedLeaf(s, p, { x0: 0, x1: half - 0.5, h }, half - 7),
    );
    part(ib, 'swing', -DOOR_SWING, (s) =>
      glass
        ? glassLeaf(s, p, { x0: 0, x1: -(half - 0.5), h }, -(half - 8), METAL)
        : glazedLeaf(s, p, { x0: 0, x1: -(half - 0.5), h }, -(half - 7)),
    );
  } else if (type === 'sliding') {
    // Two framed glass panels hanging from a track, meeting in the middle; open, each slides into the wall beside it.
    const half = w / 2;
    part(ia, 'fixed', 0, (s) => {
      // The track along the head, over the opening and the wall either side where the panels run.
      s(at(-half), at(w + half), LEAF_T + 4, h - 5, h, STEEL, { top: mix(STEEL, 0xffffff, 0.3) });
    });
    part(ia, 'slide', -(half - 2), (s) =>
      glassLeaf(s, p, { x0: 0, x1: half, h: h - 5 }, half - 7, STEEL),
    );
    part(ib, 'slide', half - 2, (s) =>
      glassLeaf(s, p, { x0: 0, x1: -half, h: h - 5 }, -(half - 7), STEEL),
    );
  } else if (type === 'revolving') {
    // A glass drum (its curved walls toward the wall's two runs, open to either side) under a metal canopy, and four
    // glass wings on a post turning inside it.
    const r = w / 2;
    const centre = { x: (ia.x + ib.x) / 2, y: (ia.y + ib.y) / 2 };
    part(centre, 'fixed', 0, (s) => {
      for (const mid of [0, Math.PI]) {
        const n = 6;
        for (let i = 0; i < n; i++) {
          const t0 = mid - 0.9 + (1.8 * i) / n;
          const t1 = mid - 0.9 + (1.8 * (i + 1)) / n;
          const q0 = { x: r * Math.cos(t0), y: r * Math.sin(t0) };
          const q1 = { x: r * Math.cos(t1), y: r * Math.sin(t1) };
          s(q0, q1, 1.5, 3, h, p.glass, { glass: true, bare: true });
          s(q0, q1, 2.5, 0, 3, STEEL);
        }
      }
      // The canopy: a ring of metal round the drum's top, as a flat many-sided slab band.
      const n = 16;
      for (let i = 0; i < n; i++) {
        const t0 = (2 * Math.PI * i) / n;
        const t1 = (2 * Math.PI * (i + 1)) / n;
        s(
          { x: (r + 1) * Math.cos(t0), y: (r + 1) * Math.sin(t0) },
          { x: (r + 1) * Math.cos(t1), y: (r + 1) * Math.sin(t1) },
          4,
          h - 5,
          h,
          STEEL,
          { top: mix(STEEL, 0xffffff, 0.3) },
        );
      }
    });
    part(centre, 'spin', 0, (s) => {
      s(at(-1.5), at(1.5), 3, 0, h - 5, STEEL);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const from = { x: dx * 2, y: dy * 2 };
        const to = { x: dx * (r - 2), y: dy * (r - 2) };
        s(from, to, 1.5, 4, h - 6, p.glass, { glass: true, bare: true });
        s(from, to, 2.5, 3, 5, METAL);
        s({ x: to.x - dx * 1.5, y: to.y - dy * 1.5 }, to, 2.5, 4, h - 6, METAL);
      }
    });
  } else if (wall.hinge === 'end') {
    // One leaf, hinged at the face's far jamb.
    part(ib, 'swing', -DOOR_SWING, (s) =>
      glass
        ? glassLeaf(s, p, { x0: 0, x1: -w, h }, -(w - 10), METAL)
        : woodLeaf(s, p, { x0: 0, x1: -w, h }, -(w - 9)),
    );
  } else {
    part(ia, 'swing', DOOR_SWING, (s) =>
      glass
        ? glassLeaf(s, p, { x0: 0, x1: w, h }, w - 10, METAL)
        : woodLeaf(s, p, { x0: 0, x1: w, h }, w - 9),
    );
  }
  return out;
}

/** How far (canvas px) a point is from the segment a..b. */
function distToSegment(q: P, a: P, b: P): number {
  const wx = b.x - a.x;
  const wy = b.y - a.y;
  const len2 = wx * wx + wy * wy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * wx + (q.y - a.y) * wy) / len2));
  return Math.hypot(q.x - (a.x + wx * t), q.y - (a.y + wy * t));
}

/** Whether any character's feet stand within DOOR_OPEN_REACH of the door's opening (`a` to `b`), on either side. */
export function someoneNear(a: P, b: P, feet: readonly P[]): boolean {
  for (const f of feet) if (distToSegment(f, a, b) <= DOOR_OPEN_REACH) return true;
  return false;
}

/** A door's motion between frames: how open (0 shut, 1 open), when someone was last near (ms), its wings' turn. */
export type DoorState = { open: number; seen: number; spin: number };

export const SHUT_DOOR: DoorState = { open: 0, seen: -Infinity, spin: 0 };

const QUARTER = Math.PI / 2;

/**
 * One frame of a door: open while someone is near or was within DOOR_CLOSE_DELAY_MS, easing at DOOR_OPEN_MS open and
 * DOOR_CLOSE_MS shut; a revolving door's wings turn while it is open and then on to the next square rest. Under
 * reduced motion it jumps: open or shut, its wings at 45 degrees open and squared shut. Returns a new state (the same
 * one when nothing moves).
 */
export function stepDoor(
  s: DoorState,
  near: boolean,
  now: number,
  dtMs: number,
  reduced = false,
): DoorState {
  const seen = near ? now : s.seen;
  const want = now - seen < DOOR_CLOSE_DELAY_MS ? 1 : 0;
  if (reduced) {
    const spin = want ? QUARTER / 2 : 0;
    return s.open === want && s.spin === spin && s.seen === seen ? s : { open: want, seen, spin };
  }
  let open = s.open;
  if (want > open) open = Math.min(1, open + dtMs / DOOR_OPEN_MS);
  else if (want < open) open = Math.max(0, open - dtMs / DOOR_CLOSE_MS);
  let spin = s.spin;
  const turn = (DOOR_SPIN_SPEED * dtMs) / 1000;
  if (want) spin += turn;
  else {
    // On to the next square rest, never back.
    const rest = Math.ceil(spin / QUARTER - 1e-9) * QUARTER;
    spin = Math.min(rest, spin + turn);
  }
  // Keep the angle small: a whole turn is the same pose.
  if (spin >= 2 * Math.PI) spin -= 2 * Math.PI;
  if (open === s.open && spin === s.spin && seen === s.seen) return s;
  return { open, seen, spin };
}

/** The eased share of a part's travel at openness `t` (smoothstep), as the walls' cut-away eases. */
export function doorEase(t: number): number {
  return t * t * (3 - 2 * t);
}
