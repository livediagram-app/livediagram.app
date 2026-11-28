// Real 3D's walls and roofs (docs/specs/008-canvas/3d-engine.md, 3d-view.md "Walls in front of you are cut away"):
// each wall standing and cut down, the doors in its doorways and each roof, built only when they change; and the aim
// of a wall piece at the wall the pointer is over (wall-aim.ts).

import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import {
  roofMesh,
  wallMesh,
  wallPalette,
  WALL_CUT_HEIGHT,
  type WallPalette,
} from '@/lib/real-3d/scene-walls';
import { WALL_RISE } from '@/lib/real-3d/models/kit';
import { setReal3DWallAim } from '@/lib/real-3d/real-3d-pick';
import { wallHitAlong } from '@/lib/real-3d/wall-aim';
import type { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import type { spaceRoofs } from '@/lib/space-3d/space-3d-roofs';
import { createDoorMotion, NO_DOOR_MOTION } from './door-motion';
import { buildGroup, disposeFades, type SceneState, type StaticScene } from './real3d-scene-kit';
import type { Real3DEngine } from './useReal3DEngine';

export function useSceneWalls(
  engineRef: RefObject<Real3DEngine | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  staticRef: RefObject<SceneState>,
  walls: ReturnType<typeof spaceWalls>,
  roofs: ReturnType<typeof spaceRoofs>,
  paletteKey: string,
): void {
  // The walls and roofs: rebuilt only when they change, not on every board change (each wall clones its materials).
  useEffect(() => {
    const e = engineRef.current;
    const canvas = canvasRef.current;
    if (!e || !canvas) return;
    const tokens =
      canvas.parentElement?.querySelector('[data-space-walls]') ?? canvas.parentElement;
    const style = tokens ? getComputedStyle(tokens) : null;
    const palette: WallPalette = wallPalette((n) => style?.getPropertyValue(n) ?? '');
    const disposers: (() => void)[] = [];
    const root = new THREE.Group();
    const wallMap: StaticScene['walls'] = new Map();
    for (const w of walls) {
      // Each wall standing, and cut down (shown in its place while you stand in front of it).
      const built = buildGroup(wallMesh(w, palette).rise(WALL_RISE), e.mats);
      const low = buildGroup(wallMesh(w, palette, WALL_CUT_HEIGHT).rise(WALL_RISE), e.mats);
      low.group.visible = false;
      root.add(built.group, low.group);
      wallMap.set(w.id, {
        group: built.group,
        low: low.group,
        height: w.height,
        cut: 0,
        want: 0,
        seen: 0,
      });
      disposers.push(built.dispose, low.dispose, () => {
        disposeFades(built.group);
        disposeFades(low.group);
      });
    }
    const doorMotion = createDoorMotion(
      walls,
      palette,
      (b) => buildGroup(b, e.mats),
      (id) => {
        const w = wallMap.get(id);
        return w && [w.group, w.low];
      },
    );
    disposers.push(doorMotion.dispose);
    const roofMap: StaticScene['roofs'] = new Map();
    for (const r of roofs) {
      const built = buildGroup(roofMesh(r, palette).rise(WALL_RISE), e.mats);
      // Its own materials (a roof is a handful of meshes), so it fades on its own as it lifts off.
      const mats: THREE.Material[] = [];
      built.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
        const m = (o.material as THREE.Material).clone();
        o.material = m;
        mats.push(m);
      });
      root.add(built.group);
      roofMap.set(r.id, { group: built.group, lift: 0, mats });
      disposers.push(built.dispose, () => mats.forEach((m) => m.dispose()));
    }
    e.scene.add(root);
    const st = staticRef.current;
    st.walls = wallMap;
    st.roofs = roofMap;
    st.doors = doorMotion;
    return () => {
      e.scene.remove(root);
      disposers.forEach((d) => d());
      st.walls = new Map();
      st.roofs = new Map();
      st.doors = NO_DOOR_MOTION;
    };
  }, [engineRef, canvasRef, staticRef, walls, roofs, paletteKey]);
  // A wall piece aims at the wall the pointer is over, not the floor behind it (wall-aim.ts): the sight line through a
  // floor point, from the camera this frame drew with, against the walls as they stand now (a cut one is low).
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const ndc = new THREE.Vector3();
    const near = new THREE.Vector3();
    const far = new THREE.Vector3();
    const low = {
      has: (id: string) => (staticRef.current?.walls.get(id)?.cut ?? 0) >= 0.5,
    };
    setReal3DWallAim(({ x, y }) => {
      ndc.set(x, y, 0).applyMatrix4(e.camera.projectionMatrix);
      if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return null;
      near.set(ndc.x, ndc.y, -1).applyMatrix4(e.camera.projectionMatrixInverse);
      far.set(ndc.x, ndc.y, 1).applyMatrix4(e.camera.projectionMatrixInverse);
      // From the camera's side (the end higher above the floor), into the scene.
      const [from, to] = far.z > near.z ? [far, near] : [near, far];
      const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
      return wallHitAlong(walls, low, { x: from.x, y: from.y, z: from.z }, dir);
    });
    return () => setReal3DWallAim(null);
  }, [engineRef, staticRef, walls]);
}
