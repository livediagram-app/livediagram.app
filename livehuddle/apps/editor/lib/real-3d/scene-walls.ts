// Real 3D's walls, doors, windows, fences and roofs (docs/specs/008-canvas/3d-engine.md "The scene"): the walls the
// 3D view stands up (spaceWalls, the same lines a walk is stopped by) built as boxes with a thickness, each its own
// mesh so the ones in front of you can fade. Pure: no three.js, no DOM.

import { SPACE_DOOR_HEIGHT, type SpaceWall } from '@/lib/space-3d/space-3d-walls';
import { roofShape, type SpaceRoof } from '@/lib/space-3d/space-3d-roofs';
import { MeshBuilder, mix, parseColour, shade, type Rgb } from './mesh-builder';

/** The wall colours, read from the 3D view's tokens (a tab's wall colour and the evening light included). */
export type WallPalette = {
  wall: Rgb;
  wallTop: Rgb;
  skirting: Rgb;
  door: Rgb;
  doorFrame: Rgb;
  glass: Rgb;
  fence: Rgb;
  picket: Rgb;
  roof: Rgb;
  grass: Rgb;
};

export function wallPalette(read: (name: string) => string): WallPalette {
  const c = (name: string, fallback: string) => parseColour(read(name).trim() || fallback);
  return {
    wall: c('--space-wall', '#ddd3c3'),
    wallTop: c('--space-wall-top', '#f2ede5'),
    skirting: c('--space-skirting', '#a87548'),
    door: c('--space-door', '#9a6a3f'),
    doorFrame: c('--space-door-frame', '#5e3b1f'),
    glass: c('--space-glass-top', '#cfe6f3'),
    fence: c('--space-fence', '#8a5a33'),
    picket: c('--space-picket', '#ffffff'),
    roof: c('--space-roof', '#b4533a'),
    grass: c('--space-grass', '#3f6212'),
  };
}

/** How thick each kind of wall is, in canvas px. */
export const WALL_THICKNESS = {
  wall: 8,
  glass: 4,
  fence: 6,
  picket: 4,
  doorway: 8,
  window: 8,
  stage: 4,
} as const;
const SKIRTING = 4;
const WINDOW_SILL = 46;
const WINDOW_HEAD = 118;
const DOOR_FRAME = 4;
const LEAF_T = 3;

export type WallMesh = { id: string; builder: MeshBuilder };

const along = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** One wall's blocks. */
export function wallMesh(wall: SpaceWall, p: WallPalette): MeshBuilder {
  const m = new MeshBuilder();
  const { a, b, height: h } = wall;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  switch (wall.kind) {
    case 'wall':
      m.slab(a, b, WALL_THICKNESS.wall + 2, 0, SKIRTING, p.skirting, { bare: true });
      m.slab(a, b, WALL_THICKNESS.wall, SKIRTING, h, p.wall, { top: p.wallTop });
      break;
    case 'glass':
      m.slab(a, b, WALL_THICKNESS.glass + 2, 0, 3, mix(p.glass, 0x64748b, 0.6), { bare: true });
      m.slab(a, b, WALL_THICKNESS.glass, 3, h, p.glass, { glass: true, bare: true });
      m.slab(a, b, WALL_THICKNESS.glass + 1, h - 3, h, mix(p.glass, 0x94a3b8, 0.7), { bare: true });
      break;
    case 'fence': {
      // Posts and two rails, as the plan's fence is drawn.
      const posts = Math.max(2, Math.round(len / 28) + 1);
      for (let i = 0; i < posts; i++) {
        const c = along(a, b, i / (posts - 1));
        const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
        m.slab(
          { x: c.x - u.x * 2.5, y: c.y - u.y * 2.5 },
          { x: c.x + u.x * 2.5, y: c.y + u.y * 2.5 },
          6,
          0,
          h + 3,
          p.fence,
        );
      }
      m.slab(a, b, WALL_THICKNESS.fence - 2, h * 0.55, h * 0.55 + 4, mix(p.fence, 0xffffff, 0.12));
      m.slab(a, b, WALL_THICKNESS.fence - 2, h - 5, h, mix(p.fence, 0xffffff, 0.12));
      break;
    }
    case 'picket': {
      const n = Math.max(2, Math.round(len / 9));
      const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      for (let i = 0; i < n; i++) {
        const c = along(a, b, (i + 0.5) / n);
        m.slab(
          { x: c.x - u.x * 2.2, y: c.y - u.y * 2.2 },
          { x: c.x + u.x * 2.2, y: c.y + u.y * 2.2 },
          3,
          0,
          h,
          p.picket,
        );
      }
      m.slab(a, b, 2, h * 0.6, h * 0.6 + 3, mix(p.picket, 0x94a3b8, 0.25), { bare: true });
      break;
    }
    case 'grass': {
      // Tufts along the lawn's edge.
      const n = Math.max(1, Math.round(len / 10));
      for (let i = 0; i < n; i++) {
        const c = along(a, b, (i + 0.5) / n);
        const t = (i * 7) % 3;
        m.box({
          x: c.x - 1.5,
          y: c.y - 1.5,
          z: 0,
          w: 3,
          d: 3,
          h: h - t,
          colour: mix(p.grass, 0x84cc16, 0.35),
          bare: true,
        });
      }
      break;
    }
    case 'stage':
      m.slab(a, b, WALL_THICKNESS.stage, 0, h, 0x8a5a33);
      break;
    case 'window': {
      const t = WALL_THICKNESS.window;
      m.slab(a, b, t + 2, 0, SKIRTING, p.skirting, { bare: true });
      m.slab(a, b, t, SKIRTING, WINDOW_SILL, p.wall, { top: p.wallTop });
      m.slab(a, b, t + 4, WINDOW_SILL - 3, WINDOW_SILL, mix(p.wallTop, 0xffffff, 0.3));
      m.slab(a, b, 2, WINDOW_SILL, WINDOW_HEAD, p.glass, { glass: true, bare: true });
      m.slab(a, b, t, WINDOW_HEAD, h, p.wall, { top: p.wallTop });
      // The frame's jambs.
      const u = 3 / Math.max(len, 1);
      m.slab(a, along(a, b, u), t, WINDOW_SILL, WINDOW_HEAD, 0xf8fafc);
      m.slab(along(a, b, 1 - u), b, t, WINDOW_SILL, WINDOW_HEAD, 0xf8fafc);
      break;
    }
    case 'doorway': {
      const t = WALL_THICKNESS.doorway;
      const top = SPACE_DOOR_HEIGHT;
      const glass = wall.glass === true;
      // The lintel over the door, in the wall's own stuff.
      if (glass) m.slab(a, b, WALL_THICKNESS.glass, top, h, p.glass, { glass: true, bare: true });
      else m.slab(a, b, t, top, h, p.wall, { top: p.wallTop });
      // The frame: two jambs and a head.
      const frame = glass ? 0xcbd5e1 : p.doorFrame;
      const u = DOOR_FRAME / Math.max(len, 1);
      m.slab(a, along(a, b, u), t + 2, 0, top, frame);
      m.slab(along(a, b, 1 - u), b, t + 2, 0, top, frame);
      m.slab(a, b, t + 2, top - DOOR_FRAME, top, frame);
      const ia = along(a, b, u);
      const ib = along(a, b, 1 - u);
      if (wall.shut) {
        if (glass) m.slab(ia, ib, LEAF_T, 0, top - DOOR_FRAME, p.glass, { glass: true });
        else
          m.slab(ia, ib, LEAF_T, 0, top - DOOR_FRAME, p.door, { top: mix(p.door, 0xffffff, 0.2) });
      } else if (wall.hinge) {
        // Open: the leaf stands out of the wall at its hinge, swung most of the way open.
        const hinge = wall.hinge === 'start' ? ia : ib;
        const other = wall.hinge === 'start' ? ib : ia;
        const w = Math.hypot(other.x - hinge.x, other.y - hinge.y);
        const dir = { x: (other.x - hinge.x) / w, y: (other.y - hinge.y) / w };
        const swing = (80 * Math.PI) / 180;
        // Toward the wall's front (its +y side as built), which is where the plan's swing arc lies.
        const s = wall.hinge === 'start' ? 1 : -1;
        const c = Math.cos(swing);
        const sn = Math.sin(swing) * s;
        const out = { x: dir.x * c - dir.y * sn, y: dir.x * sn + dir.y * c };
        const end = { x: hinge.x + out.x * w, y: hinge.y + out.y * w };
        if (glass) m.slab(hinge, end, LEAF_T, 0, top - DOOR_FRAME, p.glass, { glass: true });
        else
          m.slab(hinge, end, LEAF_T, 0, top - DOOR_FRAME, p.door, {
            top: mix(p.door, 0xffffff, 0.2),
          });
      }
      break;
    }
  }
  return m;
}

/** A roof's blocks: hipped (two slopes and two gables) or flat, glass or tiled. */
export function roofMesh(roof: SpaceRoof, p: WallPalette): MeshBuilder {
  const m = new MeshBuilder();
  const base = roofShape(roof).base;
  if (roof.flat) {
    const pts = roof.outline
      ? roof.outline.map((q) => ({ x: roof.x + q.x * roof.width, y: roof.y + q.y * roof.height }))
      : [
          { x: roof.x, y: roof.y },
          { x: roof.x + roof.width, y: roof.y },
          { x: roof.x + roof.width, y: roof.y + roof.height },
          { x: roof.x, y: roof.y + roof.height },
        ];
    if (roof.glass) {
      for (let i = 1; i + 1 < pts.length; i++) {
        const q = [pts[0]!, pts[i]!, pts[i + 1]!];
        const up: [number, number, number] = [0, 0, 1];
        m.tri(
          [q[0]!.x, q[0]!.y, base + 1],
          [q[1]!.x, q[1]!.y, base + 1],
          [q[2]!.x, q[2]!.y, base + 1],
          up,
          up,
          up,
          [0.8, 0.9, 0.96],
          true,
        );
      }
      for (let i = 0; i < pts.length; i++) {
        const u = pts[i]!;
        const v = pts[(i + 1) % pts.length]!;
        m.line([u.x, u.y, base + 1], [v.x, v.y, base + 1]);
      }
    } else {
      m.flat(pts, base + 2, mix(p.wallTop, 0x64748b, 0.25));
      for (let i = 0; i < pts.length; i++) {
        const u = pts[i]!;
        const v = pts[(i + 1) % pts.length]!;
        m.slab(u, v, 4, base, base + 5, mix(p.wallTop, 0x475569, 0.3));
      }
    }
    return m;
  }
  const { rise } = roofShape(roof);
  const { x, y, width: w, height: h } = roof;
  // The roof in its own terms: u along the ridge, v across it (0 at the middle), z up; then laid on the plan.
  const along = !roof.across;
  const L = along ? w : h;
  const S = (along ? h : w) / 2;
  const at = (u: number, v: number, z: number): [number, number, number] =>
    along ? [x + u, y + h / 2 + v, z] : [x + w / 2 + v, y + u, z];
  gableRoof(m, { L, S, base, rise, at, tile: p.roof, wall: p.wall, trim: p.wallTop });
  return m;
}

/**
 * A pitched roof of tiles over a box: two slopes of overlapping courses from the eaves up to a capped ridge, eaves and
 * gable ends hanging past the walls with their boards, and a soffit under the overhang; each course's tiles a shade
 * apart so the light picks out the rows, as the plan's roof drawing has them.
 */
function gableRoof(
  m: MeshBuilder,
  o: {
    L: number;
    S: number;
    base: number;
    rise: number;
    at: (u: number, v: number, z: number) => [number, number, number];
    tile: Rgb;
    wall: Rgb;
    trim: Rgb;
  },
): void {
  const { L, S, base, rise, at, tile } = o;
  const over = 9;
  const drop = (over * rise) / S;
  const eaveZ = base - drop;
  const ridgeZ = base + rise;
  const u0 = -over;
  const u1 = L + over;
  const V = S + over;
  const course = 7;
  const n = Math.max(3, Math.round(Math.hypot(V, ridgeZ - eaveZ) / course));
  const lip = 0.9;
  const trim = mix(o.trim, 0xffffff, 0.2);
  const soffit = mix(o.wall, 0x000000, 0.25);
  const zAt = (v: number) => eaveZ + (ridgeZ - eaveZ) * (1 - Math.abs(v) / V);
  for (const side of [-1, 1] as const) {
    // Courses from the eave up: each a band of the slope, its lower edge standing proud by a lip.
    for (let k = 0; k < n; k++) {
      const va = side * V * (1 - k / n);
      const vb = side * V * (1 - (k + 1) / n);
      const za = zAt(va) + lip;
      const zb = zAt(vb) + lip;
      const shadeK = ((k * 37) % 5) / 5;
      const c = shade(mix(tile, k % 2 ? 0x000000 : 0xffffff, 0.04 + shadeK * 0.04), 1);
      // Each course in tiles along the ridge, alternate tiles a touch darker, so the slope reads as tiled.
      const tiles = Math.max(2, Math.round((u1 - u0) / 12));
      for (let t = 0; t < tiles; t++) {
        const ua = u0 + ((u1 - u0) * t) / tiles;
        const ub = u0 + ((u1 - u0) * (t + 1)) / tiles;
        const tc = (t + k) % 3 === 0 ? shade(mix(tile, 0x000000, 0.07), 1) : c;
        m.quad(at(ua, va, za), at(ub, va, za), at(ub, vb, zb), at(ua, vb, zb), tc);
      }
      // The course's lip: its lower edge's face.
      m.quad(
        at(u0, va, za - lip),
        at(u1, va, za - lip),
        at(u1, va, za),
        at(u0, va, za),
        shade(mix(tile, 0x000000, 0.28), 1),
      );
    }
    // The soffit under the overhang, and the fascia board along the eave.
    m.quad(
      at(u0, side * V, eaveZ),
      at(u1, side * V, eaveZ),
      at(u1, side * S, base),
      at(u0, side * S, base),
      shade(soffit, 1),
    );
    m.quad(
      at(u0, side * V, eaveZ - 3),
      at(u1, side * V, eaveZ - 3),
      at(u1, side * V, eaveZ + lip),
      at(u0, side * V, eaveZ + lip),
      shade(trim, 1),
    );
  }
  // The gable ends: plaster triangles over the end walls, and barge boards along their edges.
  for (const u of [0, L]) {
    m.quad(
      at(u, -S, base),
      at(u, S, base),
      at(u, 0, ridgeZ),
      at(u, 0, ridgeZ),
      shade(mix(o.wall, 0x000000, 0.05), 1),
    );
  }
  for (const u of [u0, u1])
    for (const side of [-1, 1] as const) {
      const a = at(u, side * V, eaveZ - 0.5);
      const b = at(u, 0, ridgeZ + 1.2);
      m.tube(a, b, 1.6, trim, { segments: 6 });
    }
  // The ridge cap: a rounded roll of darker tile along the top.
  m.tube(at(u0 - 1, 0, ridgeZ + 1.2), at(u1 + 1, 0, ridgeZ + 1.2), 2.6, mix(tile, 0x000000, 0.22), {
    segments: 10,
  });
}
