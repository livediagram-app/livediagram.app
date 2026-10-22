// A layer's effects (docs/specs/031-photo/photo-layers.md "A layer"): drop shadow, outer glow, stroke
// and colour overlay, drawn from the layer's shape (its alpha) into the layer's own picture before it
// is blended (docs/specs/031-photo/blueprints/DEFAULTS.md D13): the shadow and glow under it, the
// overlay over its colours, the stroke on top.
import { blendSpan } from '../colour/blend';
import { hexToBytes } from '../colour/colour';
import { alphaPlane, gaussianBlurPlane, type Plane } from '../filters/kernel';
import type { LayerEffects } from '../model/types';
import { createRaster, type Raster } from '../raster/raster';
import { distanceTransform } from '../select/distance';

const on = (e: { enabled?: false } | undefined): boolean => !!e && e.enabled !== false;

/** How far past the layer's own pixels its effects reach, in px (rounded up). */
export function effectsMargin(fx: LayerEffects | undefined): number {
  if (!fx) return 0;
  let m = 0;
  if (on(fx.shadow)) m = Math.max(m, fx.shadow!.distance + fx.shadow!.size * 1.5 + 2);
  if (on(fx.glow)) m = Math.max(m, fx.glow!.size * 1.5 + 2);
  if (on(fx.stroke)) m = Math.max(m, fx.stroke!.size + 2);
  return Math.ceil(m);
}

export function hasEffects(fx: LayerEffects | undefined): boolean {
  return !!fx && (on(fx.shadow) || on(fx.glow) || on(fx.stroke) || on(fx.overlay));
}

/** The alpha with its edge pushed out by `spread` (0..1 of the blur), then blurred by `size`. */
function softened(alpha: Plane, spread: number, size: number): Plane {
  const choked: Plane = { ...alpha, data: new Float32Array(alpha.data) };
  if (spread > 0 && spread < 1) {
    const k = 1 / (1 - spread);
    for (let i = 0; i < choked.data.length; i++) choked.data[i] = Math.min(1, choked.data[i]! * k);
  }
  return gaussianBlurPlane(choked, size / 2);
}

/** A flat colour raster whose alpha is `plane` times `opacity`, shifted by (dx, dy). */
function tinted(plane: Plane, hex: string, opacity: number, dx = 0, dy = 0): Raster {
  const [r, g, b] = hexToBytes(hex);
  const out = createRaster(plane.width, plane.height);
  const d = out.data;
  const ox = Math.round(dx);
  const oy = Math.round(dy);
  for (let y = 0; y < plane.height; y++) {
    const sy = y - oy;
    if (sy < 0 || sy >= plane.height) continue;
    for (let x = 0; x < plane.width; x++) {
      const sx = x - ox;
      if (sx < 0 || sx >= plane.width) continue;
      const a = plane.data[sy * plane.width + sx]! * opacity;
      if (a <= 0) continue;
      const o = (y * plane.width + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = a * 255;
    }
  }
  return out;
}

function over(dst: Raster, src: Raster): void {
  blendSpan(dst.data, 0, src.data, 0, dst.width * dst.height, 'normal', 1);
}

/** The layer's picture with its effects drawn: `content` must already carry `effectsMargin` px of
 *  room on every side. */
export function withEffects(content: Raster, fx: LayerEffects | undefined): Raster {
  if (!hasEffects(fx)) return content;
  const effects = fx!;
  const alpha = alphaPlane(content);
  const out = createRaster(content.width, content.height);
  if (on(effects.shadow)) {
    const s = effects.shadow!;
    const rad = (s.angle * Math.PI) / 180;
    // The light comes from the angle: the shadow falls the other way.
    const dx = -Math.cos(rad) * s.distance;
    const dy = Math.sin(rad) * s.distance;
    over(out, tinted(softened(alpha, s.spread, s.size), s.colour, s.opacity, dx, dy));
  }
  if (on(effects.glow)) {
    const g = effects.glow!;
    over(out, tinted(softened(alpha, g.spread, g.size), g.colour, g.opacity));
  }
  let body = content;
  if (on(effects.overlay)) {
    const o = effects.overlay!;
    const [r, g, b] = hexToBytes(o.colour);
    const flat = createRaster(content.width, content.height);
    for (let i = 0; i < flat.data.length; i += 4) {
      flat.data[i] = r;
      flat.data[i + 1] = g;
      flat.data[i + 2] = b;
      flat.data[i + 3] = 255;
    }
    body = createRaster(content.width, content.height);
    body.data.set(content.data);
    // Over the layer's own colours, its alpha kept.
    const mixed = createRaster(content.width, content.height);
    mixed.data.set(content.data);
    for (let i = 3; i < mixed.data.length; i += 4) mixed.data[i] = 255;
    blendSpan(mixed.data, 0, flat.data, 0, content.width * content.height, o.blend, o.opacity);
    for (let i = 0; i < body.data.length; i += 4) {
      body.data[i] = mixed.data[i]!;
      body.data[i + 1] = mixed.data[i + 1]!;
      body.data[i + 2] = mixed.data[i + 2]!;
    }
  }
  over(out, body);
  if (on(effects.stroke)) {
    const st = effects.stroke!;
    const w = content.width;
    const h = content.height;
    const a = alpha.data;
    const stroke = new Float32Array(w * h);
    const outside = st.position !== 'inside';
    const inside = st.position !== 'outside';
    const reach = st.position === 'centre' ? st.size / 2 : st.size;
    if (outside) {
      const dist = distanceTransform(w, h, (i) => a[i]! >= 0.5);
      for (let i = 0; i < stroke.length; i++)
        if (a[i]! < 1)
          stroke[i] = Math.max(
            stroke[i]!,
            Math.min(1, Math.max(0, reach + 1 - dist[i]!)) * (1 - a[i]!),
          );
    }
    if (inside) {
      const dist = distanceTransform(w, h, (i) => a[i]! < 0.5);
      for (let i = 0; i < stroke.length; i++)
        if (a[i]! > 0)
          stroke[i] = Math.max(stroke[i]!, Math.min(1, Math.max(0, reach + 1 - dist[i]!)) * a[i]!);
    }
    over(out, tinted({ width: w, height: h, data: stroke }, st.colour, 1));
  }
  return out;
}
