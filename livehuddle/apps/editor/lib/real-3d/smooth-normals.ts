// The game characters' shading made smooth (docs/specs/008-canvas/3d-engine.md "Characters"; the owner, 2026-11-27:
// "Make it cleaner, like I see so many polygons all over it ... make it smoother", without changing the models). The
// packs ship faceted, every triangle its own flat normal, so a round arm or head reads as facets. Each corner takes the
// area-weighted average of the normals of the faces meeting at its point that bend less than a crease from its own, so
// curves shade smoothly while a real edge (a sole, a cuff) stays crisp. Only the normals change: positions, colours,
// index and material groups are left exactly as they are.

import * as THREE from 'three';

/** Faces meeting at more than this angle keep the edge between them. */
const CREASE = (60 * Math.PI) / 180;

export function smoothNormals(geometry: THREE.BufferGeometry, crease = CREASE): void {
  const pos = geometry.getAttribute('position');
  if (!pos) return;
  const index = geometry.getIndex();
  const count = pos.count;
  const tri = Math.floor((index ? index.count : count) / 3);
  const corner = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  // Each triangle's face normal, its length twice its area.
  const faceN = new Float32Array(tri * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    a.fromBufferAttribute(pos, corner(t, 0));
    b.fromBufferAttribute(pos, corner(t, 1)).sub(a);
    c.fromBufferAttribute(pos, corner(t, 2)).sub(a);
    b.cross(c);
    faceN[t * 3] = b.x;
    faceN[t * 3 + 1] = b.y;
    faceN[t * 3 + 2] = b.z;
  }
  // Corners at the same point (to a hair) share their faces: each vertex's point id, then each point's faces.
  const pointOf = new Int32Array(count);
  const ids = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let id = ids.get(k);
    if (id === undefined) ids.set(k, (id = ids.size));
    pointOf[i] = id;
  }
  const facesAt: number[][] = Array.from({ length: ids.size }, () => []);
  const cornerFace = new Int32Array(count).fill(-1);
  for (let t = 0; t < tri; t++)
    for (let k = 0; k < 3; k++) {
      const i = corner(t, k);
      facesAt[pointOf[i]!]!.push(t);
      if (cornerFace[i] === -1) cornerFace[i] = t;
    }
  const cos = Math.cos(crease);
  const old = geometry.getAttribute('normal');
  const out = new Float32Array(count * 3);
  const own = new THREE.Vector3();
  const other = new THREE.Vector3();
  const sum = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const f = cornerFace[i]!;
    if (f < 0) {
      if (old) out.set([old.getX(i), old.getY(i), old.getZ(i)], i * 3);
      continue;
    }
    own.fromArray(faceN, f * 3).normalize();
    sum.set(0, 0, 0);
    for (const t of facesAt[pointOf[i]!]!) {
      other.fromArray(faceN, t * 3);
      const len = other.length();
      if (len > 0 && other.dot(own) / len >= cos) sum.add(other);
    }
    if (sum.lengthSq() === 0) sum.copy(own);
    sum.normalize();
    out[i * 3] = sum.x;
    out[i * 3 + 1] = sum.y;
    out[i * 3 + 2] = sum.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}
