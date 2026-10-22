// The Magnetic Lasso's edge-following path (Mortensen and Barrett, "Intelligent Scissors", 1995):
// the cheapest path between two points over a cost that is low along strong edges, searched within
// the tool's Width of the straight line between them.
import { lumaPlane, type Plane } from '../filters/kernel';
import type { Raster } from '../raster/raster';

/** A cost per pixel: low on strong edges (the Sobel gradient's magnitude, scaled by the strongest),
 *  raised where the edge is weaker than `contrast` (0..1). */
export function edgeCost(r: Raster, contrast = 0.1): Plane {
  const l = lumaPlane(r);
  const w = r.width;
  const h = r.height;
  const mag = new Float32Array(w * h);
  let max = 0;
  const at = (x: number, y: number) =>
    l.data[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      const m = Math.hypot(gx, gy);
      mag[y * w + x] = m;
      if (m > max) max = m;
    }
  const cost = new Float32Array(w * h);
  for (let i = 0; i < cost.length; i++) {
    const s = max > 0 ? mag[i]! / max : 0;
    cost[i] = s < contrast ? 1 : 1 - s;
  }
  return { width: w, height: h, data: cost };
}

class Heap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p]! <= this.keys[i]!) break;
      [this.keys[p], this.keys[i]] = [this.keys[i]!, this.keys[p]!];
      [this.vals[p], this.vals[i]] = [this.vals[i]!, this.vals[p]!];
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.keys[0]!, this.vals[0]!];
    const k = this.keys.pop()!;
    const v = this.vals.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = k;
      this.vals[0] = v;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l]! < this.keys[m]!) m = l;
        if (r < this.keys.length && this.keys[r]! < this.keys[m]!) m = r;
        if (m === i) break;
        [this.keys[m], this.keys[i]] = [this.keys[i]!, this.keys[m]!];
        [this.vals[m], this.vals[i]] = [this.vals[i]!, this.vals[m]!];
        i = m;
      }
    }
    return top;
  }
}

/** The cheapest 8-connected path from `from` to `to` (pixel coordinates in the cost plane), within
 *  `width` px of the box around them. Both ends included. */
export function livewirePath(
  cost: Plane,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width = 10,
): { x: number; y: number }[] {
  const w = cost.width;
  const h = cost.height;
  const clampX = (v: number) => Math.min(w - 1, Math.max(0, Math.round(v)));
  const clampY = (v: number) => Math.min(h - 1, Math.max(0, Math.round(v)));
  const fx = clampX(from.x);
  const fy = clampY(from.y);
  const tx = clampX(to.x);
  const ty = clampY(to.y);
  const x0 = Math.max(0, Math.min(fx, tx) - width);
  const y0 = Math.max(0, Math.min(fy, ty) - width);
  const x1 = Math.min(w - 1, Math.max(fx, tx) + width);
  const y1 = Math.min(h - 1, Math.max(fy, ty) + width);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const dist = new Float64Array(bw * bh).fill(Infinity);
  const prev = new Int32Array(bw * bh).fill(-1);
  const start = (fy - y0) * bw + (fx - x0);
  const goal = (ty - y0) * bw + (tx - x0);
  dist[start] = 0;
  const heap = new Heap();
  heap.push(0, start);
  while (heap.size) {
    const [d, v] = heap.pop();
    if (d > dist[v]!) continue;
    if (v === goal) break;
    const vx = v % bw;
    const vy = (v - vx) / bw;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue;
        const nx = vx + i;
        const ny = vy + j;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const u = ny * bw + nx;
        const step = (i && j ? Math.SQRT2 : 1) * (cost.data[(ny + y0) * w + (nx + x0)]! + 0.02);
        const nd = d + step;
        if (nd < dist[u]!) {
          dist[u] = nd;
          prev[u] = v;
          heap.push(nd, u);
        }
      }
  }
  const path: { x: number; y: number }[] = [];
  for (let v = goal; v >= 0; v = prev[v]!) {
    path.push({ x: (v % bw) + x0, y: Math.floor(v / bw) + y0 });
    if (v === start) break;
  }
  return path.reverse();
}
