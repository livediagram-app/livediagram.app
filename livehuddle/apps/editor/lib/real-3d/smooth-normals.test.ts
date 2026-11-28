import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { smoothNormals } from './smooth-normals';

describe('smoothNormals', () => {
  it('blends a gentle bend, keeps a sharp edge, and leaves the positions alone', () => {
    // Two faces sharing an edge along x, folded 20 degrees (smooth) or 90 (kept), each corner its own vertex.
    const fold = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      const p = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, -Math.cos(r), Math.sin(r)];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
      g.computeVertexNormals();
      return g;
    };
    const gentle = fold(20);
    const before = Array.from(gentle.getAttribute('position').array);
    smoothNormals(gentle);
    expect(Array.from(gentle.getAttribute('position').array)).toEqual(before);
    const n = gentle.getAttribute('normal');
    // The shared corner's normal is the same from both faces.
    expect(n.getY(0)).toBeCloseTo(n.getY(4), 5);
    expect(n.getZ(0)).toBeCloseTo(n.getZ(4), 5);
    const sharp = fold(90);
    smoothNormals(sharp);
    const s = sharp.getAttribute('normal');
    expect(Math.abs(s.getZ(0) - s.getZ(4))).toBeGreaterThan(0.5);
  });

  it('smooths a 20k-triangle mesh fast', () => {
    const g = new THREE.SphereGeometry(1, 128, 80).toNonIndexed();
    const t0 = performance.now();
    smoothNormals(g);
    expect(performance.now() - t0).toBeLessThan(400);
  });
});
