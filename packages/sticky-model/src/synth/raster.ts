import type { Rng } from './rng';

// The drawing surface a synthetic wall is painted on, in the WALL's own plane
// (before the camera's perspective): linear RGB in 0..1 per channel, plus the
// id of the note that owns each pixel (0 = no note), which is where the
// training mask comes from.

export type Rgb = [number, number, number];

export type Plane = {
  width: number;
  height: number;
  rgb: Float32Array;
  ids: Int32Array;
};

export function planeOf(width: number, height: number): Plane {
  return {
    width,
    height,
    rgb: new Float32Array(width * height * 3),
    ids: new Int32Array(width * height),
  };
}

export type RotatedRect = { cx: number; cy: number; w: number; h: number; angle: number };

// Every pixel within `pad` of a rotated rectangle, with its signed distance
// to the rectangle's edge (negative inside) and its position across the
// rectangle (u, v in 0..1 from the top-left corner, unclamped outside).
export function eachNear(
  plane: Plane,
  rect: RotatedRect,
  pad: number,
  fn: (p: number, sd: number, u: number, v: number) => void,
): void {
  const cos = Math.cos(rect.angle);
  const sin = Math.sin(rect.angle);
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const reach = Math.abs(hw * cos) + Math.abs(hh * sin) + pad;
  const reachY = Math.abs(hw * sin) + Math.abs(hh * cos) + pad;
  const x0 = Math.max(0, Math.floor(rect.cx - reach));
  const x1 = Math.min(plane.width - 1, Math.ceil(rect.cx + reach));
  const y0 = Math.max(0, Math.floor(rect.cy - reachY));
  const y1 = Math.min(plane.height - 1, Math.ceil(rect.cy + reachY));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - rect.cx;
      const dy = y + 0.5 - rect.cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const qx = Math.abs(lx) - hw;
      const qy = Math.abs(ly) - hh;
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const sd = outside > 0 ? outside : Math.max(qx, qy);
      if (sd > pad) continue;
      fn(y * plane.width + x, sd, (lx + hw) / rect.w, (ly + hh) / rect.h);
    }
  }
}

export function blendAt(plane: Plane, p: number, colour: Rgb, alpha: number): void {
  const o = p * 3;
  plane.rgb[o] = plane.rgb[o]! * (1 - alpha) + colour[0] * alpha;
  plane.rgb[o + 1] = plane.rgb[o + 1]! * (1 - alpha) + colour[1] * alpha;
  plane.rgb[o + 2] = plane.rgb[o + 2]! * (1 - alpha) + colour[2] * alpha;
}

export function scaleAt(plane: Plane, p: number, factor: number): void {
  const o = p * 3;
  plane.rgb[o] = plane.rgb[o]! * factor;
  plane.rgb[o + 1] = plane.rgb[o + 1]! * factor;
  plane.rgb[o + 2] = plane.rgb[o + 2]! * factor;
}

// A line of ink: a disc stamped along every segment, anti-aliased at its rim.
export function stroke(
  plane: Plane,
  points: readonly [number, number][],
  width: number,
  colour: Rgb,
  alpha: number,
): void {
  const r = width / 2;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
    const x1 = Math.min(plane.width - 1, Math.ceil(Math.max(ax, bx) + r + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
    const y1 = Math.min(plane.height - 1, Math.ceil(Math.max(ay, by) + r + 1));
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const t = Math.max(0, Math.min(1, (px * vx + py * vy) / len2));
        const d = Math.hypot(px - t * vx, py - t * vy);
        const cover = Math.max(0, Math.min(1, r + 0.5 - d));
        if (cover > 0) blendAt(plane, y * plane.width + x, colour, alpha * cover);
      }
    }
  }
}

// Smooth value noise in 0..1 with features about `cell` pixels across.
export function valueNoise(rng: Rng, cell: number): (x: number, y: number) => number {
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rng.next();
  const at = (i: number, j: number) =>
    grid[(((j % size) + size) % size) * size + (((i % size) + size) % size)]!;
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = fade(gx - i);
    const fy = fade(gy - j);
    const top = at(i, j) * (1 - fx) + at(i + 1, j) * fx;
    const bottom = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

// Separable box blur, repeated for a near-Gaussian; in place, per channel.
export function boxBlur(
  data: Float32Array,
  width: number,
  height: number,
  channels: number,
  radius: number,
): void {
  if (radius <= 0) return;
  const line = new Float32Array(Math.max(width, height));
  const pass = (horizontal: boolean) => {
    const n = horizontal ? width : height;
    const lines = horizontal ? height : width;
    for (let c = 0; c < channels; c += 1) {
      for (let l = 0; l < lines; l += 1) {
        const idx = (k: number) =>
          ((horizontal ? l * width + k : k * width + l) * channels + c) as number;
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1)
          sum += data[idx(Math.min(n - 1, Math.max(0, k)))]!;
        for (let k = 0; k < n; k += 1) {
          line[k] = sum / (2 * radius + 1);
          sum += data[idx(Math.min(n - 1, k + radius + 1))]! - data[idx(Math.max(0, k - radius))]!;
        }
        for (let k = 0; k < n; k += 1) data[idx(k)] = line[k]!;
      }
    }
  };
  pass(true);
  pass(false);
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [r + m, g + m, b + m];
}
