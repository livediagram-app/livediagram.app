'use client';

// Desk screens light while someone sits at the desk (docs/specs/008-canvas/3d-view.md "Sitting"; the owner, 2026-11-27:
// "When I sit down at a desk with a screen the screen should activate when I am there"). Each modelled screen
// (MeshBuilder.screen) is copied out of the pieces' one geometry; the lit ones are drawn over it, bright, as one draw,
// rebuilt only when who sits where changes.

import * as THREE from 'three';
import type { PieceBounds } from '@/lib/real-3d/piece-pick';

/** How far past a desk's footprint (canvas px) a sitter's feet still count as at it (its chair stands out from it). */
const REACH = 34;
/** A lit screen's glow. */
const LIT = 0x9bdcff;

type Screen = { id: string; tris: Float32Array; bounds: PieceBounds };

export type DeskScreens = {
  object: THREE.Object3D;
  /** Lights the screens of the desks these sitters' feet are at (and dims the rest). */
  update: (seatedFeet: readonly { x: number; y: number }[]) => void;
  dispose: () => void;
};

/** The pieces' screens and which desk each is at; `screens` and `positions` as PiecesMesh keeps them. */
export function deskScreens(
  screens: ReadonlyMap<string, readonly number[]>,
  positions: ArrayLike<number>,
  bounds: readonly PieceBounds[],
): DeskScreens {
  const byId = new Map(bounds.map((b) => [b.id, b] as const));
  const list: Screen[] = [];
  for (const [id, ranges] of screens) {
    const b = byId.get(id);
    if (!b) continue;
    const out: number[] = [];
    for (let i = 0; i + 1 < ranges.length; i += 2)
      for (let v = ranges[i]! * 3; v < ranges[i + 1]! * 3; v++) out.push(positions[v]!);
    if (out.length) list.push({ id, tris: Float32Array.from(out), bounds: b });
  }
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial({
    color: LIT,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  let lastKey = '';
  return {
    object: mesh,
    update(feet) {
      if (list.length === 0) return;
      // Each sitter lights the one desk nearest their feet (desks in a row touch), if it is within reach.
      const litIds = new Set<string>();
      for (const p of feet) {
        let best: { d: number; id: string } | null = null;
        for (const s of list) {
          const b = s.bounds;
          // Into the desk's frame: about its middle, turned back by its yaw.
          const c = Math.cos(-b.f.yaw);
          const sn = Math.sin(-b.f.yaw);
          const rx = p.x - b.f.cx;
          const ry = p.y - b.f.cy;
          const q = { x: rx * c - ry * sn, y: rx * sn + ry * c };
          const dx = Math.max(b.x0 - q.x, 0, q.x - b.x1);
          const dy = Math.max(b.y0 - q.y, 0, q.y - b.y1);
          const d =
            Math.hypot(dx, dy) +
            Math.hypot(q.x - (b.x0 + b.x1) / 2, q.y - (b.y0 + b.y1) / 2) * 0.01;
          if (d <= REACH && (!best || d < best.d)) best = { d, id: s.id };
        }
        if (best) litIds.add(best.id);
      }
      const lit = list.filter((s) => litIds.has(s.id));
      const key = lit.map((s) => s.id).join(',');
      if (key === lastKey) return;
      lastKey = key;
      mesh.visible = lit.length > 0;
      if (!lit.length) return;
      const all = new Float32Array(lit.reduce((n, s) => n + s.tris.length, 0));
      let at = 0;
      for (const s of lit) {
        all.set(s.tris, at);
        at += s.tris.length;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(all, 3));
      geometry.computeBoundingSphere();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
