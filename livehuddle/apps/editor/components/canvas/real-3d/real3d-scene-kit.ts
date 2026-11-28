// Real 3D's scene kit (docs/specs/008-canvas/3d-engine.md): the constants, the geometry builders and the scene state
// Real3DLayer.tsx and its hooks share. Pure three.js: no React.

import * as THREE from 'three';
import { acrossView } from '@/lib/space-3d/space-3d-cutaway';
import { isWallPiece, mountsOnWall, type Element } from '@livehuddle/document';
import type { DeviceHints } from '@/lib/real-3d/adaptive-quality';
import type { MeshBuilder } from '@/lib/real-3d/mesh-builder';
import type { PieceBounds } from '@/lib/real-3d/piece-pick';
import type { PadTop } from '@/lib/real-3d/scene-pieces';
import type { seatSurface } from '@/lib/real-3d/seat-surface';
import type { FigureMotion } from '@/lib/real-3d/figure-motion';
import type { CharacterRig } from './character-rig';
import { NO_DOOR_MOTION, type DoorMotion } from './door-motion';

/** The scene draws at the screen's own resolution, so edges are as crisp as the flat drawings. */
export const MAX_RATIO = 2;
/** The sprite's pixel, in canvas px at size 1 (walk.ts AVATAR_UNIT). */
export const SPRITE_UNIT = 60 / 24;

/** Each sitter's last seat search, kept while nothing it depends on changes (the frame loop's seat lookup). */
export const seatMemo = new WeakMap<
  object,
  {
    seats: object;
    x: number;
    y: number;
    yaw: number;
    scale: number;
    seat: ReturnType<typeof seatSurface>;
  }
>();

/** What the device says of itself, for the quality to start at. */
export function deviceHints(renderer: THREE.WebGLRenderer | undefined): DeviceHints {
  let gpu: string | null = null;
  try {
    const gl = renderer?.getContext();
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  } catch {
    gpu = null;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    gpu,
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    mobile: matchMedia('(pointer: coarse)').matches,
  };
}
/** How long after the last movement the scene counts as calm and drops to 30 frames a second. */
export const CALM_AFTER_MS = 600;
/** The walker's box: where its feet are inside it, per unit of scale (walk.ts avatarBox). */
export const FEET_X = 13 * SPRITE_UNIT;
export const FEET_Y = 56 + 80;
export const OUTLINE = 0x2b2438;
/** How long a lawn's change must settle before its blades regrow. */
export const GRASS_SETTLE_MS = 250;
/** Whether a piece goes into or onto a wall (a door, a window, a clock): placing it leaves the walls standing. */
export function standsInWall(el: Element): boolean {
  if (el.type !== 'shape') return false;
  return mountsOnWall(el.shape) || isWallPiece(el);
}
/** How long a wall takes to be cut down, or to grow back (3d-view.md "Walls in front of you are cut away"). */
export const CUT_MS = 320;

/** The walls across the view at each quarter turn, worked out once per set of walls (not each frame). */
export const acrossCache = new WeakMap<
  readonly { id: string; a: { x: number; y: number }; b: { x: number; y: number } }[],
  Set<string>[]
>();
export function acrossFor(
  walls: readonly { id: string; a: { x: number; y: number }; b: { x: number; y: number } }[],
  turn: number,
): Set<string> {
  let byTurn = acrossCache.get(walls);
  if (!byTurn) {
    byTurn = [0, 1].map((t) => new Set(walls.filter((w) => acrossView(w, t)).map((w) => w.id)));
    acrossCache.set(walls, byTurn);
  }
  return byTurn[((turn % 2) + 2) % 2]!;
}

/**
 * Fades a wall (or its cut-down copy) to `opacity`: its meshes get materials of their own the first time it fades
 * (kept on the group, disposed with it by disposeFades), so a wall fades on its own, never every wall sharing its
 * colour. Opaque again at 1, writing depth as before.
 */
export function fadeGroup(group: THREE.Group, opacity: number): void {
  let mats = group.userData.fadeMats as THREE.Material[] | undefined;
  if (!mats) {
    if (opacity >= 1) return;
    const own: THREE.Material[] = [];
    const made = new Map<THREE.Material, THREE.Material>();
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
      const m = o.material as THREE.Material;
      let c = made.get(m);
      if (!c) {
        c = m.clone();
        made.set(m, c);
        own.push(c);
      }
      o.material = c;
    });
    group.userData.fadeMats = mats = own;
  }
  for (const m of mats) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
    m.depthWrite = opacity >= 1;
  }
}

/** Disposes the materials fadeGroup gave a wall. */
export function disposeFades(group: THREE.Group): void {
  for (const m of (group.userData.fadeMats as THREE.Material[] | undefined) ?? []) m.dispose();
}
/** Higher than this (canvas px, risen), a surface over a sitter is a chair's back or a desk, never their seat. */
export const SEAT_CAP = 70;
/** How long a cut-down wall waits, out of your way, before it grows back (so a pan past it never flickers it). */
export const REGROW_DELAY_MS = 450;
/** How long a roof takes to lift off and fade, or to settle back. */
export const ROOF_MS = 380;
/** How high a roof rises as it lifts off. */
export const ROOF_LIFT = 60;

export type StaticScene = {
  /** Each wall standing, and cut down: `cut` goes 0 (standing) to 1 (cut down) as it slides. */
  walls: Map<
    string,
    {
      group: THREE.Group;
      low: THREE.Group;
      height: number;
      cut: number;
      want: number;
      /** When it last was in your way (ms), for the wait before it grows back. */
      seen: number;
    }
  >;
  /** Each roof: `lift` goes 0 (on) to 1 (lifted off and gone) as it eases, its own materials faded with it. */
  roofs: Map<string, { group: THREE.Group; lift: number; mats: THREE.Material[] }>;
};

export function geometryOf(b: MeshBuilder, glass = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(glass ? b.glassPositions : b.positions, 3),
  );
  g.setAttribute('color', new THREE.Float32BufferAttribute(glass ? b.glassColours : b.colours, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(glass ? b.glassNormals : b.normals, 3));
  return g;
}

export function linesOf(b: MeshBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.lines, 3));
  return g;
}

export type Built = { group: THREE.Group; dispose: () => void };

export function buildGroup(
  b: MeshBuilder,
  mats: { solid: THREE.Material; glass: THREE.Material; line: THREE.Material },
): Built {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  if (b.positions.length) {
    const g = geometryOf(b);
    geos.push(g);
    const solid = new THREE.Mesh(g, mats.solid);
    solid.castShadow = true;
    solid.receiveShadow = true;
    group.add(solid);
  }
  if (b.glassPositions.length) {
    const g = geometryOf(b, true);
    geos.push(g);
    const mesh = new THREE.Mesh(g, mats.glass);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  if (b.lines.length) {
    const g = linesOf(b);
    geos.push(g);
    group.add(new THREE.LineSegments(g, mats.line));
  }
  for (const o of group.children) o.frustumCulled = false;
  return { group, dispose: () => geos.forEach((g) => g.dispose()) };
}

export type Figure = {
  group: THREE.Group;
  rig: CharacterRig;
  shadow: THREE.Mesh;
  /** How it really moves: its heading, speed and turn, from where its feet are each frame. */
  motion: FigureMotion;
  /** The head rise last written for its chips (head-rise.ts). */
  chip: { rise: number | null };
};

/** The static scene's state the frame loop and the effects share: walls, roofs, the pieces' lookups and the doors. */
export type SceneState = {
  walls: StaticScene['walls'];
  roofs: StaticScene['roofs'];
  /** Hides a piece in the pieces' one geometry (while its moment moves it) and returns what puts it back. */
  lift: (id: string) => () => void;
  byId: Map<string, Element>;
  boundsById: Map<string, PieceBounds>;
  /** The Avatar Pads' tops, which a character on one stands on. */
  pads: PadTop[];
  /** The doors in the doorways, opening as characters come (door-motion.ts). */
  doors: DoorMotion;
};

export const emptySceneState = (): SceneState => ({
  pads: [],
  doors: NO_DOOR_MOTION,
  walls: new Map(),
  roofs: new Map(),
  lift: () => () => {},
  byId: new Map(),
  boundsById: new Map(),
});
