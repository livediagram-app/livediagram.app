// The Shape tools (docs/specs/031-photo/photo-tools.md "Shapes"): Rectangle, Ellipse and Line, a
// drag drawn into a new pixel layer (or the active one with Draw Into Active Layer), filled with the
// foreground colour and stroked with the background's. Shift keeps the shape, Alt draws from the
// centre.
import {
  blendOnto,
  colourRaster,
  ellipseMasks,
  lineMask,
  rectangleMasks,
  type Mask8,
} from '@livedesign/photo-engine';
import {
  newPixelLayer,
  pixelsRefused,
  rgbOf,
  targetOffset,
  type PhotoPoint,
  type ToolCtx,
  refuseNoPixels,
} from './tool-context';
import type { ToolHandler } from './tool-handler';

export type ShapeKind = 'rectangle' | 'ellipse' | 'line';

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
};

type P = { x: number; y: number };

/** The drag's two corners (or the line's ends) with Shift and Alt applied. */
export function shapeEnds(kind: ShapeKind, start: P, p: PhotoPoint): { a: P; b: P } {
  let dx = p.x - start.x;
  let dy = p.y - start.y;
  if (p.shift) {
    if (kind === 'line') {
      const step = Math.PI / 4;
      const angle = Math.round(Math.atan2(dy, dx) / step) * step;
      const len = Math.hypot(dx, dy);
      dx = Math.cos(angle) * len;
      dy = Math.sin(angle) * len;
    } else {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * side;
      dy = Math.sign(dy || 1) * side;
    }
  }
  if (p.alt && kind !== 'line')
    return { a: { x: start.x - dx, y: start.y - dy }, b: { x: start.x + dx, y: start.y + dy } };
  return { a: start, b: { x: start.x + dx, y: start.y + dy } };
}

/** The shape's fill and stroke masks, in photo coordinates. */
function masksOf(
  ctx: ToolCtx,
  kind: ShapeKind,
  a: P,
  b: P,
): { fill: Mask8 | null; stroke: Mask8 | null } {
  const o = ctx.state().options.shape;
  const strokeWidth = o.stroke ? o.strokeWidth : 0;
  if (kind === 'line')
    return {
      fill: lineMask(a, b, {
        width: o.strokeWidth,
        startArrow: o.startArrow,
        endArrow: o.endArrow,
        antiAlias: o.antiAlias,
      }),
      stroke: null,
    };
  const lo = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
  const hi = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
  const m =
    kind === 'rectangle'
      ? rectangleMasks(lo, hi, { radius: o.radius, strokeWidth, antiAlias: o.antiAlias })
      : ellipseMasks(lo, hi, { strokeWidth, antiAlias: o.antiAlias });
  return { fill: o.fill ? m.fill : null, stroke: m.stroke };
}

export function shapeTool(kind: ShapeKind, ctx: ToolCtx): ToolHandler {
  let start: P | null = null;
  let ends: { a: P; b: P } | null = null;
  return {
    cursor: 'crosshair',
    down(p) {
      start = { x: p.x, y: p.y };
      ends = { a: start, b: start };
      ctx.setOverlay({ kind: 'shape', shape: kind, from: start, to: start });
      return true;
    },
    move(p) {
      if (!start) return;
      ends = shapeEnds(kind, start, p);
      ctx.setOverlay({ kind: 'shape', shape: kind, from: ends.a, to: ends.b });
    },
    up(p) {
      ctx.setOverlay({ kind: 'none' });
      if (!start) return;
      ends = shapeEnds(kind, start, p);
      start = null;
      const { a, b } = ends;
      if (Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) < 1) return;
      // A box or ellipse dragged flat (no height or no width) has nothing to draw: nothing happens, no message.
      if (kind !== 'line' && (Math.abs(b.x - a.x) < 1 || Math.abs(b.y - a.y) < 1)) return;
      const st = ctx.state();
      const o = st.options.shape;
      if (kind !== 'line' && !o.fill && !o.stroke) {
        ctx.toast('Turn on Fill or Stroke to draw a shape.');
        return;
      }
      // A line takes the foreground colour; a box fills with it and strokes with the background's.
      const { fill, stroke } = masksOf(ctx, kind, a, b);
      if (!fill && !stroke) return;
      const s = ctx.session;
      const active = s.layer(s.active);
      // Into the active pixel layer; a layer of its own only when Draw Into Active Layer is off.
      if (o.intoActive && active?.layerKind !== 'pixel') {
        refuseNoPixels(ctx, active);
        return;
      }
      const into =
        o.intoActive && active?.layerKind === 'pixel'
          ? active
          : newPixelLayer(ctx, SHAPE_NAMES[kind]);
      const refused = pixelsRefused(into, 'layer');
      if (refused) {
        ctx.toast(refused);
        return;
      }
      const raster = s.raster(into.id);
      const at = targetOffset(into, 'layer');
      const paint = (m: Mask8 | null, hex: string) => {
        if (!m) return;
        const rect = { x: m.x, y: m.y, width: m.width, height: m.height };
        const local = {
          x: rect.x - at.x,
          y: rect.y - at.y,
          width: rect.width,
          height: rect.height,
        };
        const dst = raster.read(local);
        blendOnto(dst, rect, colourRaster(rect, rgbOf(hex)), rect, 'normal', 1, m);
        raster.write(dst, local.x, local.y);
      };
      paint(fill, st.foreground);
      paint(stroke, st.background);
      s.changed();
      s.commitPixels(SHAPE_NAMES[kind], [{ layerId: into.id, target: 'layer' }]);
    },
    key(key) {
      if (key !== 'Escape' || !start) return false;
      start = null;
      ctx.setOverlay({ kind: 'none' });
      return true;
    },
    cancel() {
      start = null;
      ctx.setOverlay({ kind: 'none' });
    },
  };
}
