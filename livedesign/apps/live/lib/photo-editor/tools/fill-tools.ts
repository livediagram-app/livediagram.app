// The fill and sampling tools (docs/specs/031-photo/photo-tools.md "Fills and gradients",
// "Sampling"): the Paint Bucket, the Gradient tool's drag and the Eyedropper. A fill on a mask paints
// grey, the colours' luminosity.
import {
  blendOnto,
  bucketRegion,
  bytesToHex,
  colourRaster,
  lumaByte,
  maskBounds,
  renderGradient,
  type Raster,
  type Rect,
} from '@livedesign/photo-engine';
import { photoTools } from '../tool-state';
import {
  paintTarget,
  photoRect,
  rgbOf,
  sampleRect,
  samplePicture,
  targetOffset,
  type PhotoPoint,
  type ToolCtx,
} from './tool-context';
import type { ToolHandler } from './tool-handler';

/** A raster's colours turned to their grey, for a mask target. */
function toGrey(r: Raster): void {
  const d = r.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = lumaByte(d[i]!, d[i + 1]!, d[i + 2]!);
    d[i] = g;
    d[i + 1] = g;
    d[i + 2] = g;
    d[i + 3] = 255;
  }
}

/** Paints `src` (photo coordinates at `rect`) onto the target's pixels within `rect`, by mode and
 *  opacity times `coverage`, and commits it as one edit. */
function paintArea(
  ctx: ToolCtx,
  label: string,
  rect: Rect,
  src: Raster,
  how: { mode: Parameters<typeof blendOnto>[4]; opacity: number },
  coverage: Parameters<typeof blendOnto>[6],
): void {
  const t = paintTarget(ctx);
  if (!t) return;
  const s = ctx.session;
  const o = targetOffset(t.layer, t.target);
  const raster = s.raster(t.layer.id, t.target);
  const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
  const dst = raster.read(local);
  const before = t.layer.locks?.transparency || t.layer.locks?.all ? dst.data.slice() : null;
  if (t.target === 'mask') toGrey(src);
  blendOnto(
    dst,
    { x: rect.x, y: rect.y },
    src,
    rect,
    t.target === 'mask' ? 'normal' : how.mode,
    how.opacity,
    coverage,
  );
  if (t.target === 'mask') toGrey(dst);
  // Locked transparency keeps each pixel's alpha.
  if (before) for (let i = 3; i < dst.data.length; i += 4) dst.data[i] = before[i]!;
  raster.write(dst, local.x, local.y);
  s.changed();
  s.commitPixels(label, [{ layerId: t.layer.id, target: t.target }]);
}

/** The Paint Bucket: a press fills the like-coloured area around it with the foreground colour. */
export function bucketTool(ctx: ToolCtx): ToolHandler {
  return {
    cursor: 'bucket',
    down(p) {
      const s = ctx.session;
      const { photo } = s;
      if (p.x < 0 || p.y < 0 || p.x >= photo.width || p.y >= photo.height) return false;
      const st = ctx.state();
      const o = st.options.bucket;
      const layer = s.layer(s.active);
      // A mask target samples the mask itself (its grey), unless All Layers.
      const sample =
        s.target === 'mask' && layer?.mask && !o.sampleAll
          ? (() => {
              const at = targetOffset(layer, 'mask');
              return s
                .raster(layer.id, 'mask')
                .read({ x: -at.x, y: -at.y, width: photo.width, height: photo.height });
            })()
          : samplePicture(ctx, o.sampleAll);
      const region = bucketRegion(sample, p, {
        tolerance: o.tolerance,
        contiguous: o.contiguous,
        antiAlias: o.antiAlias,
        selection: s.selection,
      });
      const b = maskBounds(region);
      if (!b) return false;
      paintArea(ctx, 'Paint Bucket', b, colourRaster(b, rgbOf(st.foreground)), o, region);
      return false;
    },
  };
}

/** The Gradient tool: a drag draws the line the gradient runs along (Shift: in 45° steps). */
export function gradientTool(ctx: ToolCtx): ToolHandler {
  let from: { x: number; y: number } | null = null;
  let to: { x: number; y: number } | null = null;
  const end = (p: PhotoPoint) => {
    if (!from) return p;
    if (!p.shift) return { x: p.x, y: p.y };
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const step = Math.PI / 4;
    const a = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.hypot(dx, dy);
    return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
  };
  return {
    cursor: 'crosshair',
    down(p) {
      from = { x: p.x, y: p.y };
      to = from;
      ctx.setOverlay({ kind: 'line', from, to });
      return true;
    },
    move(p) {
      if (!from) return;
      to = end(p);
      ctx.setOverlay({ kind: 'line', from, to });
    },
    up(p) {
      ctx.setOverlay({ kind: 'none' });
      if (!from) return;
      to = end(p);
      const a = from;
      from = null;
      if (Math.hypot(to.x - a.x, to.y - a.y) < 1) return;
      const s = ctx.session;
      const o = ctx.state().options.gradient;
      const sel = s.selection;
      const rect = sel ? (maskBounds(sel) ?? photoRect(s.photo)) : photoRect(s.photo);
      const g = renderGradient(o.gradient, o.style, a, to, rect, {
        reverse: o.reverse,
        dither: o.dither,
      });
      paintArea(ctx, 'Gradient', rect, g, o, sel);
    },
    key(key) {
      if (key !== 'Escape' || !from) return false;
      from = null;
      ctx.setOverlay({ kind: 'none' });
      return true;
    },
    cancel() {
      from = null;
      ctx.setOverlay({ kind: 'none' });
    },
  };
}

/** The colour under a point: the average of the sample size's square. */
export function pickColour(
  ctx: ToolCtx,
  p: { x: number; y: number },
  size: number,
  all: boolean,
): string | null {
  const { photo } = ctx.session;
  const half = Math.floor(size / 2);
  const x0 = Math.max(0, Math.floor(p.x) - half);
  const y0 = Math.max(0, Math.floor(p.y) - half);
  const x1 = Math.min(photo.width, Math.floor(p.x) + half + 1);
  const y1 = Math.min(photo.height, Math.floor(p.y) + half + 1);
  if (x1 <= x0 || y1 <= y0) return null;
  const pic = sampleRect(ctx, all, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  // Averaged by alpha: a transparent pixel adds no colour.
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let i = 0; i < pic.data.length; i += 4) {
    const w = pic.data[i + 3]!;
    r += pic.data[i]! * w;
    g += pic.data[i + 1]! * w;
    b += pic.data[i + 2]! * w;
    a += w;
  }
  if (!a) return null;
  return bytesToHex(Math.round(r / a), Math.round(g / a), Math.round(b / a));
}

/** The Eyedropper: a press (and a drag) takes the colour under it as the foreground (Alt: the
 *  background), the ring showing the new colour over the one held. */
export function eyedropperTool(ctx: ToolCtx): ToolHandler {
  let alt = false;
  const take = (p: PhotoPoint, commit: boolean) => {
    const o = ctx.state().options.eyedropper;
    const colour = pickColour(ctx, p, o.sample, o.sampleAll);
    if (!colour) return;
    const st = ctx.state();
    ctx.setOverlay({
      kind: 'ring',
      x: p.x,
      y: p.y,
      colour,
      was: alt ? st.background : st.foreground,
    });
    if (commit) photoTools.set(alt ? { background: colour } : { foreground: colour });
  };
  return {
    cursor: 'eyedropper',
    down(p) {
      alt = p.alt;
      take(p, false);
      return true;
    },
    move(p) {
      take(p, false);
    },
    up(p) {
      take(p, true);
      ctx.setOverlay({ kind: 'none' });
    },
    cancel() {
      ctx.setOverlay({ kind: 'none' });
    },
  };
}
