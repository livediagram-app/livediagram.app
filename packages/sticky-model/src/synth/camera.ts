import { boxBlur, type Plane } from './raster';
import type { Rng } from './rng';

// The camera between the wall and the photograph: perspective, the room's
// light (exposure, colour cast, a gradient across the wall, a hard shadow
// edge, night), focus and sensor noise.

export type Homography = number[];

// The 3x3 matrix (row-major, h33 = 1) taking four source points onto four
// destination points: the standard 8-unknown linear system.
export function homographyFrom(src: [number, number][], dst: [number, number][]): Homography {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = src[i]!;
    const [u, v] = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < 8; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < 8; r += 1) if (Math.abs(a[r]![c]!) > Math.abs(a[pivot]![c]!)) pivot = r;
    [a[c], a[pivot]] = [a[pivot]!, a[c]!];
    [b[c], b[pivot]] = [b[pivot]!, b[c]!];
    for (let r = 0; r < 8; r += 1) {
      if (r === c) continue;
      const f = a[r]![c]! / a[c]![c]!;
      for (let k = c; k < 8; k += 1) a[r]![k]! -= f * a[c]![k]!;
      b[r]! -= f * b[c]!;
    }
  }
  return [...b.map((v, i) => v / a[i]![i]!), 1];
}

export function applyHomography(h: Homography, x: number, y: number): [number, number] {
  const w = h[6]! * x + h[7]! * y + h[8]!;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
}

// Output pixel -> wall plane: the frame's corners land on a jittered quad
// inside the plane, which is a mild perspective, a turn and a zoom.
export function randomView(rng: Rng, out: { w: number; h: number }, plane: Plane): Homography {
  const mx = (plane.width - out.w) / 2;
  const my = (plane.height - out.h) / 2;
  const j = rng.range(0, 0.9);
  const corner = (x: number, y: number): [number, number] => [
    x + rng.range(-mx, mx) * j,
    y + rng.range(-my, my) * j,
  ];
  return homographyFrom(
    [
      [0, 0],
      [out.w, 0],
      [out.w, out.h],
      [0, out.h],
    ],
    [
      corner(mx, my),
      corner(mx + out.w, my),
      corner(mx + out.w, my + out.h),
      corner(mx, my + out.h),
    ],
  );
}

// Colour by bilinear sampling, note ids by nearest neighbour (an id is a
// label, not a quantity to blend).
export function warp(
  plane: Plane,
  view: Homography,
  width: number,
  height: number,
): { rgb: Float32Array; ids: Int32Array } {
  const rgb = new Float32Array(width * height * 3);
  const ids = new Int32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [px, py] = applyHomography(view, x + 0.5, y + 0.5);
      const fx = Math.max(0, Math.min(plane.width - 1.001, px - 0.5));
      const fy = Math.max(0, Math.min(plane.height - 1.001, py - 0.5));
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const o = (y * width + x) * 3;
      const p00 = (iy * plane.width + ix) * 3;
      const p01 = p00 + 3;
      const p10 = p00 + plane.width * 3;
      const p11 = p10 + 3;
      for (let c = 0; c < 3; c += 1) {
        rgb[o + c] =
          (plane.rgb[p00 + c]! * (1 - tx) + plane.rgb[p01 + c]! * tx) * (1 - ty) +
          (plane.rgb[p10 + c]! * (1 - tx) + plane.rgb[p11 + c]! * tx) * ty;
      }
      const nx = Math.min(plane.width - 1, Math.max(0, Math.floor(px)));
      const ny = Math.min(plane.height - 1, Math.max(0, Math.floor(py)));
      ids[y * width + x] = plane.ids[ny * plane.width + nx]!;
    }
  }
  return { rgb, ids };
}

export function light(rgb: Float32Array, width: number, height: number, rng: Rng): void {
  const night = rng.chance(0.15);
  const exposure = night ? rng.range(0.3, 0.6) : rng.range(0.75, 1.15);
  const warm = night ? rng.range(0.05, 0.25) : rng.range(-0.08, 0.12);
  const tint = [1 + warm, 1 + rng.range(-0.04, 0.04), 1 - warm];
  const gAngle = rng.range(0, Math.PI * 2);
  const gLow = rng.chance(0.6) ? rng.range(0.45, 1) : 1;
  const shadow = rng.chance(0.25)
    ? {
        angle: rng.range(0, Math.PI * 2),
        at: rng.range(0.2, 0.8),
        factor: rng.range(0.35, 0.8),
        soft: rng.range(1, 60),
      }
    : null;
  const diag = Math.hypot(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t =
        ((x - width / 2) * Math.cos(gAngle) + (y - height / 2) * Math.sin(gAngle)) / diag + 0.5;
      let f = exposure * (1 - (1 - gLow) * t);
      if (shadow) {
        const d =
          (x - width * shadow.at) * Math.cos(shadow.angle) +
          (y - height * 0.5) * Math.sin(shadow.angle);
        const s = 1 / (1 + Math.exp(-d / shadow.soft));
        f *= 1 - (1 - shadow.factor) * s;
      }
      const o = (y * width + x) * 3;
      for (let c = 0; c < 3; c += 1) rgb[o + c] = rgb[o + c]! * f * tint[c]!;
    }
  }
}

// Focus, then sensor noise (worse at night, when the gain is up), then 8 bits.
export function develop(rgb: Float32Array, width: number, height: number, rng: Rng): Uint8Array {
  if (rng.chance(0.35)) boxBlur(rgb, width, height, 3, 1);
  const noise = rng.range(0.003, 0.03);
  const gamma = rng.range(0.85, 1.15);
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 1) {
    const v = Math.max(0, rgb[i]! + rng.gauss() * noise);
    out[i] = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, v) ** gamma)));
  }
  return out;
}
