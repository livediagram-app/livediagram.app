// Editing in 3D (docs/specs/008-canvas/3d-view.md "Editing in 3D"): the selected pieces marked in the scene, so you
// see what you picked from any side: the edges of each piece's model box in the selection colour, drawn over the
// scene so a piece hidden behind another still shows its outline.

import * as THREE from 'three';
import type { PieceBounds } from '@/lib/real-3d/piece-pick';

const SELECTED = 0x3b82f6;

export class SelectionMarks {
  readonly group = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({
    color: SELECTED,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  private geometry: THREE.BufferGeometry | null = null;
  private key = '';

  constructor() {
    this.group.renderOrder = 10;
  }

  /** Marks these pieces (only rebuilt when the set or their boxes change). */
  set(bounds: readonly PieceBounds[]): void {
    const key = bounds
      .map((b) => `${b.id}:${b.f.cx},${b.f.cy},${b.f.yaw},${b.x0},${b.x1},${b.y0},${b.y1},${b.z1}`)
      .join('|');
    if (key === this.key) return;
    this.key = key;
    this.group.clear();
    this.geometry?.dispose();
    this.geometry = null;
    if (bounds.length === 0) return;
    const pts: number[] = [];
    const pad = 3;
    for (const b of bounds) {
      const c = Math.cos(b.f.yaw);
      const s = Math.sin(b.f.yaw);
      const at = (x: number, y: number, z: number): [number, number, number] => [
        b.f.cx + c * x - s * y,
        b.f.cy + s * x + c * y,
        z,
      ];
      const x0 = b.x0 - pad;
      const x1 = b.x1 + pad;
      const y0 = b.y0 - pad;
      const y1 = b.y1 + pad;
      const z0 = 0.5;
      const z1 = Math.max(b.z1, 2) + pad;
      const corners = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ] as const;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = corners[i]!;
        const [bx, by] = corners[(i + 1) % 4]!;
        pts.push(...at(ax, ay, z0), ...at(bx, by, z0));
        pts.push(...at(ax, ay, z1), ...at(bx, by, z1));
        pts.push(...at(ax, ay, z0), ...at(ax, ay, z1));
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(this.geometry, this.material);
    lines.renderOrder = 10;
    lines.frustumCulled = false;
    this.group.add(lines);
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}
