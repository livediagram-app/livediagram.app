// Modify a selection (docs/specs/031-photo/photo-tools.md "Selecting"): Expand, Contract, Border,
// Smooth and Feather. Each answers a new mask grown by what it needs. Distances run between pixel
// centres, so a pixel beside the edge sits half a pixel from it.
import { gaussianBlurPlane, planeFrom } from '../filters/kernel';
import { createMask, maskOver, trimMask, type Mask8 } from '../raster/mask';
import { distanceTransform } from './distance';

function padded(m: Mask8, by: number): Mask8 {
  return maskOver(m, {
    x: m.x - by,
    y: m.y - by,
    width: m.width + by * 2,
    height: m.height + by * 2,
  });
}

/** Grown outward by `px`. */
export function expandMask(m: Mask8, px: number): Mask8 | null {
  if (px <= 0) return m;
  const p = padded(m, Math.ceil(px) + 1);
  const dist = distanceTransform(p.width, p.height, (i) => p.data[i]! >= 128);
  const out = createMask({ x: p.x, y: p.y, width: p.width, height: p.height });
  for (let i = 0; i < out.data.length; i++)
    out.data[i] = Math.max(
      p.data[i]!,
      Math.round(Math.min(1, Math.max(0, px + 1 - dist[i]!)) * 255),
    );
  return trimMask(out);
}

/** Shrunk inward by `px`. */
export function contractMask(m: Mask8, px: number): Mask8 | null {
  if (px <= 0) return m;
  const p = padded(m, 1);
  const dist = distanceTransform(p.width, p.height, (i) => p.data[i]! < 128);
  const out = createMask({ x: p.x, y: p.y, width: p.width, height: p.height });
  for (let i = 0; i < out.data.length; i++) {
    const keep = Math.min(1, Math.max(0, dist[i]! - px));
    out.data[i] = Math.round(Math.min(p.data[i]! / 255, keep) * 255);
  }
  return trimMask(out);
}

/** A band of `px` centred on the edge. */
export function borderMask(m: Mask8, px: number): Mask8 | null {
  const half = px / 2;
  const outer = expandMask(m, half);
  const inner = contractMask(m, half);
  if (!outer) return null;
  if (!inner) return outer;
  const over = maskOver(inner, {
    x: outer.x,
    y: outer.y,
    width: outer.width,
    height: outer.height,
  });
  const out = createMask({ x: outer.x, y: outer.y, width: outer.width, height: outer.height });
  for (let i = 0; i < out.data.length; i++)
    out.data[i] = Math.max(0, outer.data[i]! - over.data[i]!);
  return trimMask(out);
}

/** Softened by a Gaussian of `radius` px (Feather). */
export function featherMask(m: Mask8, radius: number): Mask8 | null {
  if (radius <= 0) return m;
  const pad = Math.ceil(radius * 3);
  const p = padded(m, pad);
  const blurred = gaussianBlurPlane(planeFrom(p.width, p.height, p.data), radius);
  const out = createMask({ x: p.x, y: p.y, width: p.width, height: p.height });
  for (let i = 0; i < out.data.length; i++)
    out.data[i] = Math.round(Math.min(255, Math.max(0, blurred.data[i]!)));
  return trimMask(out);
}

/** Corners rounded and jags evened (Smooth): a blur of `radius` then thresholded at half. */
export function smoothMask(m: Mask8, radius: number): Mask8 | null {
  if (radius <= 0) return m;
  const soft = featherMask(m, radius / 2);
  if (!soft) return null;
  const out: Mask8 = { ...soft, data: new Uint8Array(soft.data.length) };
  for (let i = 0; i < out.data.length; i++) out.data[i] = soft.data[i]! >= 128 ? 255 : 0;
  return trimMask(out);
}
