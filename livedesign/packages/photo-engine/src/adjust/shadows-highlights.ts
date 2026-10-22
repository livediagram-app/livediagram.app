// Shadows/Highlights (docs/specs/031-photo/photo-adjustments.md): lifts the shadows and recovers the
// highlights by each pixel's neighbourhood (its blurred luma), so a dark area brightens as a whole
// and keeps its local contrast. Applied only: it reads neighbours, so it cannot be a layer.
import { gaussianBlurPlane, lumaPlane } from '../filters/kernel';
import type { Raster } from '../raster/raster';
import { num } from './params';

export type ShadowsHighlightsParams = { shadows: number; highlights: number; radius: number };
export const readShadowsHighlights = (p: unknown): ShadowsHighlightsParams => ({
  shadows: num(p, 'shadows', 0, 100, 35),
  highlights: num(p, 'highlights', 0, 100, 0),
  radius: num(p, 'radius', 0, 250, 30),
});

// How far a full-strength change moves a channel toward white or black.
const STRENGTH = 0.85;

export function applyShadowsHighlights(r: Raster, p: ShadowsHighlightsParams): void {
  const s = p.shadows / 100;
  const h = p.highlights / 100;
  if (s === 0 && h === 0) return;
  const blurred = gaussianBlurPlane(lumaPlane(r), Math.max(0.1, p.radius));
  const d = r.data;
  for (let i = 0; i < blurred.data.length; i++) {
    const m = blurred.data[i]!;
    const sw = (1 - m) * (1 - m) * s * STRENGTH;
    const hw = m * m * h * STRENGTH;
    for (let c = 0; c < 3; c++) {
      const v = d[i * 4 + c]! / 255;
      d[i * 4 + c] = (v + sw * (1 - v) * (1 - v) - hw * v * v) * 255;
    }
  }
}
