// A picture in memory: straight (not premultiplied) RGBA, 8 bits a channel, row by row. The one pixel
// format every engine module reads and writes (docs/specs/031-photo/blueprints/photo-engine.md).

export type Raster = { width: number; height: number; data: Uint8ClampedArray };

export type Rect = { x: number; y: number; width: number; height: number };

export function createRaster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneRaster(r: Raster): Raster {
  return { width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) };
}

/** A raster filled with one colour. */
export function solidRaster(width: number, height: number, rgba: readonly number[]): Raster {
  const r = createRaster(width, height);
  const [cr = 0, cg = 0, cb = 0, ca = 255] = rgba;
  const d = r.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = cr;
    d[i + 1] = cg;
    d[i + 2] = cb;
    d[i + 3] = ca;
  }
  return r;
}

export function pixelAt(r: Raster, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return [0, 0, 0, 0];
  const i = (y * r.width + x) * 4;
  return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!, r.data[i + 3]!];
}

export function setPixel(r: Raster, x: number, y: number, rgba: readonly number[]): void {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return;
  const i = (y * r.width + x) * 4;
  r.data[i] = rgba[0]!;
  r.data[i + 1] = rgba[1]!;
  r.data[i + 2] = rgba[2]!;
  r.data[i + 3] = rgba[3] ?? 255;
}

/** The part of `r` inside `rect` (clamped to it, transparent outside). */
export function cropRaster(r: Raster, rect: Rect): Raster {
  const out = createRaster(rect.width, rect.height);
  copyInto(r, out, rect.x, rect.y, 0, 0, rect.width, rect.height);
  return out;
}

/** Copy a `w` x `h` block from `src` at (sx, sy) into `dst` at (dx, dy), clipped to both. */
export function copyInto(
  src: Raster,
  dst: Raster,
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  w: number,
  h: number,
): void {
  let x0 = 0;
  let y0 = 0;
  let x1 = w;
  let y1 = h;
  x0 = Math.max(x0, -sx, -dx);
  y0 = Math.max(y0, -sy, -dy);
  x1 = Math.min(x1, src.width - sx, dst.width - dx);
  y1 = Math.min(y1, src.height - sy, dst.height - dy);
  if (x1 <= x0 || y1 <= y0) return;
  const span = (x1 - x0) * 4;
  for (let y = y0; y < y1; y++) {
    const from = ((sy + y) * src.width + sx + x0) * 4;
    const to = ((dy + y) * dst.width + dx + x0) * 4;
    dst.data.set(src.data.subarray(from, from + span), to);
  }
}

export function intersectRects(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const btm = Math.min(a.y + a.height, b.y + b.height);
  return r > x && btm > y ? { x, y, width: r - x, height: btm - y } : null;
}

export function unionRects(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** The smallest rect holding every pixel with alpha, or null when the raster is empty. */
export function alphaBounds(r: Raster): Rect | null {
  let minX = r.width;
  let minY = r.height;
  let maxX = -1;
  let maxY = -1;
  const d = r.data;
  for (let y = 0; y < r.height; y++) {
    const row = y * r.width * 4;
    for (let x = 0; x < r.width; x++) {
      if (d[row + x * 4 + 3]! === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Whether every pixel is fully transparent. */
export function isTransparent(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
  return true;
}
