// Doors opening on their own in Real 3D (docs/specs/008-canvas/3d-view.md "Doors open on their own"): each doorway's
// door built as its parts (lib/real-3d/scene-doors.ts), standing in its wall's standing and cut-down groups so it
// grows and is cut with the wall, and moved each frame toward open while any character this view draws is near.
// Presentation only: nothing is written or sent.

import * as THREE from 'three';
import type { SpaceWall } from '@/lib/space-3d/space-3d-walls';
import type { MeshBuilder } from '@/lib/real-3d/mesh-builder';
import { WALL_RISE } from '@/lib/real-3d/models/kit';
import type { WallPalette } from '@/lib/real-3d/scene-walls';
import {
  doorEase,
  doorParts,
  someoneNear,
  stepDoor,
  SHUT_DOOR,
  type DoorPart,
  type DoorState,
} from '@/lib/real-3d/scene-doors';
import { WALL_CUT_HEIGHT } from '@/lib/real-3d/scene-walls';

type Placed = { part: DoorPart; groups: THREE.Group[] };
type Door = {
  a: { x: number; y: number };
  b: { x: number; y: number };
  state: DoorState;
  parts: Placed[];
};

export type DoorMotion = {
  /** One frame: `feet` every character's feet this view draws, `now` and `dtMs` the frame's clock. */
  update: (feet: readonly { x: number; y: number }[], now: number, dtMs: number) => void;
  dispose: () => void;
};

export const NO_DOOR_MOTION: DoorMotion = { update: () => {}, dispose: () => {} };

/** Places a part's group as `open` (0 to 1, eased) and its wings' `spin` say. */
function pose(g: THREE.Group, part: DoorPart, open: number, spin: number): void {
  const e = doorEase(open);
  let { x, y } = part.pivot;
  let turn = part.angle;
  if (part.move === 'swing') turn += part.open * e;
  else if (part.move === 'slide') {
    x += Math.cos(part.angle) * part.open * e;
    y += Math.sin(part.angle) * part.open * e;
  } else if (part.move === 'spin') turn += spin;
  g.position.set(x, y, 0);
  g.rotation.z = turn;
}

/**
 * Builds every doorway's door into its wall's groups (`groupsOf(wallId)`: the standing group, then the cut-down one) and
 * hands back the frame step that opens and shuts them. `build` turns a part's blocks into a group with the scene's
 * materials, as the walls are built.
 */
export function createDoorMotion(
  walls: readonly SpaceWall[],
  palette: WallPalette,
  build: (b: MeshBuilder) => { group: THREE.Group; dispose: () => void },
  groupsOf: (wallId: string) => readonly THREE.Group[] | undefined,
): DoorMotion {
  const doors: Door[] = [];
  const disposers: (() => void)[] = [];
  for (const w of walls) {
    if (w.kind !== 'doorway') continue;
    const into = groupsOf(w.id);
    if (!into || into.length === 0) continue;
    const full = doorParts(w, palette);
    const low = doorParts(w, palette, WALL_CUT_HEIGHT);
    const parts: Placed[] = full.map((part, i) => {
      const groups = [part, low[i]].map((p, k) => {
        const built = build(p!.builder.rise(WALL_RISE));
        disposers.push(built.dispose);
        into[k]?.add(built.group);
        return built.group;
      });
      for (const g of groups) pose(g, part, 0, 0);
      return { part, groups };
    });
    doors.push({ a: w.a, b: w.b, state: SHUT_DOOR, parts });
  }
  if (doors.length === 0) return { update: () => {}, dispose: () => disposers.forEach((d) => d()) };
  const reduce =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return {
    update(feet, now, dtMs) {
      const reduced = reduce?.matches === true;
      for (const d of doors) {
        const next = stepDoor(d.state, someoneNear(d.a, d.b, feet), now, dtMs, reduced);
        if (next.open === d.state.open && next.spin === d.state.spin) {
          d.state = next;
          continue;
        }
        d.state = next;
        for (const { part, groups } of d.parts)
          for (const g of groups) pose(g, part, next.open, next.spin);
      }
    },
    dispose: () => disposers.forEach((d) => d()),
  };
}
