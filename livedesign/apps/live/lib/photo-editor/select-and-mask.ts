// Select and Mask (docs/specs/031-photo/photo-tools.md "Smart selections" Refining): the selection worked by
// Smooth, Feather, Contrast and Shift Edge, and re-decided by colour where the Refine Edge brush painted.
// The same steps at any scale, so the dialog previews them on a small copy and OK works them at full size.
// Pure but for nothing: the colour refine is the caller's (in the worker).
import {
  contractMask,
  createMask,
  expandMask,
  featherMask,
  smoothMask,
  type Mask8,
} from '@livedesign/photo-engine';

export type MaskRefine = {
  // 0 to 100: rounds the edge's corners and jags.
  smooth: number;
  // 0 to 250 px: softens the edge.
  feather: number;
  // 0 to 1: hardens a soft edge toward its middle.
  contrast: number;
  // -1 to 1: moves the edge in or out.
  shiftEdge: number;
};

export const MASK_REFINE_DEFAULTS: MaskRefine = {
  smooth: 0,
  feather: 0,
  contrast: 0,
  shiftEdge: 0,
};

// Smooth's radius at 100, px; Shift Edge's reach at its ends, px. At full size (scaled for a preview).
export const SMOOTH_MAX_PX = 10;
export const SHIFT_EDGE_MAX_PX = 16;

/** The selection worked by the dialog's settings, at `scale` (a preview's size over the photo's). */
export function refineMask(m: Mask8, r: MaskRefine, scale = 1): Mask8 {
  let out: Mask8 = m;
  const shift = Math.round(Math.abs(r.shiftEdge) * SHIFT_EDGE_MAX_PX * scale);
  if (shift > 0)
    out = (r.shiftEdge > 0 ? expandMask(out, shift) : contractMask(out, shift)) ?? createMask(out);
  const smooth = (r.smooth / 100) * SMOOTH_MAX_PX * scale;
  if (smooth >= 0.5) out = smoothMask(out, smooth) ?? out;
  const feather = r.feather * scale;
  if (feather >= 0.5) out = featherMask(out, feather) ?? out;
  if (r.contrast > 0) {
    // About the edge's middle: 0 leaves it, 1 makes it hard.
    const k = 1 / (1 - Math.min(0.99, r.contrast));
    const data = new Uint8Array(out.data.length);
    for (let i = 0; i < data.length; i++)
      data[i] = Math.min(255, Math.max(0, Math.round((out.data[i]! - 128) * k + 128)));
    out = { ...out, data };
  }
  return out;
}

/** A mask resampled by `k` (nearest), for the preview's small copy. */
export function scaleMask(m: Mask8, k: number): Mask8 {
  const width = Math.max(1, Math.round(m.width * k));
  const height = Math.max(1, Math.round(m.height * k));
  const out = createMask({ x: Math.round(m.x * k), y: Math.round(m.y * k), width, height });
  for (let y = 0; y < height; y++) {
    const sy = Math.min(m.height - 1, Math.floor(y / k));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(m.width - 1, Math.floor(x / k));
      out.data[y * width + x] = m.data[sy * m.width + sx]!;
    }
  }
  return out;
}

/** `refined` where `zone` was painted (Refine Edge), `m` elsewhere: over both `m`'s rect and the zone's,
 *  so a refined edge can reach past where the selection stopped. */
export function withinZone(m: Mask8, refined: Mask8, zone: Mask8): Mask8 {
  const at = (k: Mask8, x: number, y: number) => {
    const kx = x - k.x;
    const ky = y - k.y;
    return kx >= 0 && ky >= 0 && kx < k.width && ky < k.height ? k.data[ky * k.width + kx]! : 0;
  };
  const x0 = Math.min(m.x, zone.x);
  const y0 = Math.min(m.y, zone.y);
  const x1 = Math.max(m.x + m.width, zone.x + zone.width);
  const y1 = Math.max(m.y + m.height, zone.y + zone.height);
  const out = createMask({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const z = at(zone, x, y);
      const was = at(m, x, y);
      out.data[(y - y0) * out.width + (x - x0)] = z
        ? Math.round((at(refined, x, y) * z + was * (255 - z)) / 255)
        : was;
    }
  return out;
}
