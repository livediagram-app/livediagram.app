// Real 3D's presses (docs/specs/008-canvas/3d-view.md "Editing in 3D"): a press traced from the screen into the scene
// through the camera the last frame drew with, to the piece it meets (piece-pick.ts) or the floor under it
// (floor-pick.ts), and a point in the scene projected back onto the screen. Installed with each build of the pieces.

import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { pickPiece, type PieceBounds, type PiecesTriangles } from '@/lib/real-3d/piece-pick';
import { floorPieceAt } from '@/lib/real-3d/floor-pick';
import { setReal3DPicker, setReal3DProjector } from '@/lib/real-3d/real-3d-pick';

/** Points the editor's picker and projector at this build of the pieces, and returns what takes them away. */
export function installScenePicking(
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  piecesBuilt: PiecesTriangles & { bounds: readonly PieceBounds[] },
  board: () => readonly Element[],
): () => void {
  // A press is traced from the screen into the scene through the camera this frame drew with.
  const near = new THREE.Vector3();
  const far = new THREE.Vector3();
  const projected = new THREE.Vector3();
  setReal3DProjector((x, y, z) => {
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const p = projected.set(x, y, z).applyMatrix4(camera.projectionMatrix);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  });
  setReal3DPicker((clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = 1 - ((clientY - r.top) / r.height) * 2;
    near.set(nx, ny, -1).applyMatrix4(camera.projectionMatrixInverse);
    far.set(nx, ny, 1).applyMatrix4(camera.projectionMatrixInverse);
    const dir = { x: far.x - near.x, y: far.y - near.y, z: far.z - near.z };
    // From the camera's side: the end of the ray higher above the floor.
    const from = dir.z > 0 ? far : near;
    const sign = dir.z > 0 ? -1 : 1;
    const hit = pickPiece(
      piecesBuilt.bounds,
      { x: from.x, y: from.y, z: from.z },
      { x: dir.x * sign, y: dir.y * sign, z: dir.z * sign },
      piecesBuilt,
    );
    if (hit) return hit;
    // No model met: a press on a Room's or a Corridor's floor picks it (floor-pick.ts).
    const dz = dir.z * sign;
    if (Math.abs(dz) < 1e-9) return null;
    const t = -from.z / dz;
    if (t < 0) return null;
    const point = { x: from.x + dir.x * sign * t, y: from.y + dir.y * sign * t };
    // Else the floor under it, through the very camera the scene drew with (the stage's own guess drifted from it).
    return { id: floorPieceAt(board(), point), point };
  });
  return () => {
    setReal3DPicker(null);
    setReal3DProjector(null);
  };
}
