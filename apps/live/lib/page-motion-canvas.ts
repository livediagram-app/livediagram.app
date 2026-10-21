// A slide's animated background in a PNG or PDF export (docs/specs/007-editor/pages-mode.md
// "Animated backgrounds"): its parts (lib/page-motion-parts.ts) painted onto the export canvas,
// still, as they stand when the slide opens (lib/page-motion-frame.ts), over the page's gradient
// and under everything on it. Browser-only (canvas 2D); the parts and poses are tested pure.
import { hexToRgb, pageGradientLine, type PageMotion } from '@liveplanner/document';
import { motionPaint } from './page-motion';
import { animOrigin, openingPose } from './page-motion-frame';
import {
  motionParts,
  waveLine,
  wavePath,
  type MotionBox,
  type MotionFill,
  type MotionGrid,
  type MotionGroup,
  type MotionNode,
  type MotionWave,
} from './page-motion-parts';

type Ctx = CanvasRenderingContext2D;
type Size = { w: number; h: number };

/** Painted frames one export keeps, by motion, colours, size and resolution: a deck repeats one
 *  background on many slides. Bounded, as a 1920 x 1080 slide at 2x is 33 MB of pixels. */
export type MotionFrameCache = Map<string, HTMLCanvasElement>;
const FRAMES_KEPT = 2;

/** Paint a motion's opening frame across `rect` (canvas units), clipped to it. With a cache, a
 *  frame painted before is laid down again rather than painted. */
export function paintMotionFrame(
  ctx: Ctx,
  motion: PageMotion,
  fill: { from: string; to: string },
  rect: { x: number; y: number; width: number; height: number },
  cache?: MotionFrameCache,
): void {
  if (cache) {
    const m = ctx.getTransform?.();
    const scale = m ? Math.hypot(m.a, m.b) || 1 : 1;
    const key = `${motion}|${fill.from}|${fill.to}|${rect.width}x${rect.height}@${scale}`;
    let frame = cache.get(key);
    if (!frame) {
      frame = document.createElement('canvas');
      frame.width = Math.max(1, Math.ceil(rect.width * scale));
      frame.height = Math.max(1, Math.ceil(rect.height * scale));
      const layer = frame.getContext('2d');
      if (!layer) return paintMotionFrame(ctx, motion, fill, rect);
      layer.scale(scale, scale);
      paintMotionFrame(layer, motion, fill, { x: 0, y: 0, width: rect.width, height: rect.height });
      cache.set(key, frame);
      if (cache.size > FRAMES_KEPT) cache.delete(cache.keys().next().value!);
    }
    ctx.drawImage(frame, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  const paint = motionPaint(fill);
  const size = { w: rect.width, h: rect.height };
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.translate(rect.x, rect.y);
  ctx.globalAlpha *= paint.strength;
  paintNodes(ctx, motionParts(motion, size, paint), size);
  ctx.restore();
}

function paintNodes(ctx: Ctx, nodes: readonly MotionNode[], size: Size): void {
  for (const node of nodes) {
    if (node.type === 'box') paintBox(ctx, node);
    else if (node.type === 'wave') paintWave(ctx, node);
    else if (node.type === 'grid') paintGrid(ctx, node);
    else paintGroup(ctx, node, size);
  }
}

/** A colour at an alpha, as the canvas takes it (CSS's `color-mix` with transparent). */
export function rgba(color: string, a: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${Math.round(a * 100) / 100})`;
}

const TURN = Math.PI / 180;

function paintBox(ctx: Ctx, part: MotionBox): void {
  const pose = openingPose(part.anim);
  if (pose.opacity <= 0 || pose.scale <= 0 || pose.sx <= 0 || pose.sy <= 0) return;
  const { width: w, height: h } = part;
  const [ox, oy] = animOrigin(part.anim);
  ctx.save();
  // Moved, then turned and scaled about the part's transform origin, as its CSS transform does,
  // then drawn about its centre.
  ctx.translate(part.left + w * ox + pose.tx, part.top + h * oy + pose.ty);
  if (pose.rotate) ctx.rotate(pose.rotate * TURN);
  if (pose.scale !== 1 || pose.sx !== 1 || pose.sy !== 1) {
    ctx.scale(pose.scale * pose.sx, pose.scale * pose.sy);
  }
  ctx.translate(w * (0.5 - ox), h * (0.5 - oy));
  ctx.globalAlpha *= pose.opacity;
  if (part.halo) paintHalo(ctx, part, part.halo);
  if (part.round) {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
  }
  paintFill(ctx, part.fill, w, h);
  ctx.restore();
}

// A box shadow round a round part: its disc (radius plus spread) blurred as CSS blurs it, a
// Gaussian of half the blur radius, sampled into a radial light. A small disc under a wide blur is
// faint, as on screen.
const HALO_STOPS = 12;

function paintHalo(ctx: Ctx, part: MotionBox, halo: NonNullable<MotionBox['halo']>): void {
  const r = Math.min(part.width, part.height) / 2 + halo.spread;
  const sigma = Math.max(halo.blur / 2, 0.01);
  const outer = r + sigma * 3;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
  for (let i = 0; i <= HALO_STOPS; i += 1) {
    const at = i / HALO_STOPS;
    g.addColorStop(at, rgba(halo.color, halo.a * blurredDisc(r, sigma, at * outer)));
  }
  ctx.fillStyle = g;
  ctx.fillRect(-outer, -outer, outer * 2, outer * 2);
}

/** How much of a disc of radius `r`, blurred by a Gaussian of `sigma`, covers a point `rho` from
 *  its centre (0 to 1), taken across the diameter through the point. */
export function blurredDisc(r: number, sigma: number, rho: number): number {
  const k = sigma * Math.SQRT2;
  return Math.max(0, Math.min(1, (erf((r - rho) / k) + erf((r + rho) / k)) / 2));
}

// Abramowitz and Stegun 7.1.26: within 1.5e-7, plenty for a glow.
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x < 0 ? -y : y;
}

// A fill across a w x h box centred on the origin.
function paintFill(ctx: Ctx, fill: MotionFill, w: number, h: number): void {
  switch (fill.kind) {
    case 'glow':
      return paintEllipseLight(ctx, w, h, [
        [0, fill.color, fill.a],
        [0.45, fill.color, fill.a * 0.45],
        [1, fill.color, 0],
      ]);
    case 'fade':
      return paintEllipseLight(ctx, w, h, [
        [0, fill.color, fill.a],
        [1, fill.color, 0],
      ]);
    case 'solid':
      ctx.fillStyle = rgba(fill.color, fill.a ?? 1);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    case 'bokeh': {
      // `circle` reaches the farthest corner.
      const reach = Math.hypot(w / 2, h / 2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
      g.addColorStop(0, rgba(fill.color, 0.32));
      g.addColorStop(0.55, rgba(fill.color, 0.22));
      g.addColorStop(0.7, rgba(fill.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    }
    case 'lines': {
      // Bands 2px wide every `gap` along the 135deg gradient line, which starts at the top left.
      const length = (w + h) * Math.SQRT1_2;
      ctx.rotate(45 * TURN);
      ctx.fillStyle = rgba(fill.color, fill.a);
      for (let s = fill.gap - 2; s < length; s += fill.gap) {
        ctx.fillRect(s - length / 2, -length, 2, length * 2);
      }
      return;
    }
    case 'beam': {
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, rgba(fill.color, 0));
      g.addColorStop(0.5, rgba(fill.color, fill.a));
      g.addColorStop(1, rgba(fill.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    }
    case 'mesh':
      // CSS lists the top layer first.
      for (const spot of [...fill.spots].reverse()) {
        const cx = -w / 2 + spot.x * w;
        const cy = -h / 2 + spot.y * h;
        const reach = Math.hypot(
          Math.max(spot.x, 1 - spot.x) * w,
          Math.max(spot.y, 1 - spot.y) * h,
        );
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * spot.reach);
        g.addColorStop(0, rgba(spot.color, spot.a));
        g.addColorStop(1, rgba(spot.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      return;
    case 'rays': {
      // 5 degrees lit in every 12, from straight up, clockwise.
      const reach = Math.hypot(w, h) / 2;
      ctx.fillStyle = rgba(fill.color, fill.a);
      ctx.beginPath();
      for (let deg = 0; deg < 360; deg += 12) {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, reach, (deg - 90) * TURN, (deg + 5 - 90) * TURN);
        ctx.closePath();
      }
      ctx.fill();
      return;
    }
    case 'ring':
      // The border sits inside the box.
      ctx.strokeStyle = rgba(fill.color, fill.a);
      ctx.lineWidth = fill.width;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2 - fill.width / 2, h / 2 - fill.width / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case 'streak': {
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, rgba(fill.color, 0));
      g.addColorStop(1, rgba(fill.color, fill.a));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    }
    case 'sweep': {
      // The conic gradient as CSS draws it: from straight up, clockwise, clear for three quarters
      // of the turn and rising to full at the leading edge.
      const g = ctx.createConicGradient(-90 * TURN, 0, 0);
      g.addColorStop(0, rgba(fill.color, 0));
      g.addColorStop(0.75, rgba(fill.color, 0));
      g.addColorStop(1, rgba(fill.color, fill.a));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    }
    case 'bar': {
      const g = ctx.createLinearGradient(0, h / 2, 0, -h / 2);
      g.addColorStop(0, rgba(fill.from, fill.a * 0.15));
      g.addColorStop(1, rgba(fill.to, fill.a));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    }
  }
}

// A radial light reaching the box's sides (`closest-side`): an ellipse in a box that is not square.
function paintEllipseLight(
  ctx: Ctx,
  w: number,
  h: number,
  stops: readonly (readonly [number, string, number])[],
): void {
  ctx.save();
  ctx.scale(w / 2, h / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [at, color, a] of stops) g.addColorStop(at, rgba(color, a));
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function paintWave(ctx: Ctx, part: MotionWave): void {
  const pose = openingPose(part.anim);
  ctx.save();
  ctx.translate(pose.tx, pose.ty);
  if (part.stroke) {
    ctx.strokeStyle = rgba(part.color, part.a);
    ctx.lineWidth = part.stroke;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(waveLine(part.w, part.amp, part.base, part.periods)));
  } else {
    ctx.fillStyle = rgba(part.color, part.a);
    ctx.fill(new Path2D(wavePath(part.w, part.h, part.amp, part.base, part.periods)));
  }
  ctx.restore();
}

function paintGroup(ctx: Ctx, group: MotionGroup, size: Size): void {
  const pose = openingPose(group.anim);
  if (!group.mask) {
    ctx.save();
    ctx.translate(pose.tx, pose.ty);
    // A planet's orbit turns its group about the slide's centre.
    if (pose.rotate) {
      ctx.translate(size.w / 2, size.h / 2);
      ctx.rotate(pose.rotate * TURN);
      ctx.translate(-size.w / 2, -size.h / 2);
    }
    ctx.globalAlpha *= pose.opacity;
    paintNodes(ctx, group.children, size);
    ctx.restore();
    return;
  }
  // The rays fade away from the bottom centre: full to 35% of the way to the farthest corner,
  // gone by 95%.
  const reach = Math.hypot(size.w / 2, size.h);
  paintMasked(
    ctx,
    { x: 0, y: 0, w: size.w, h: size.h },
    (layer) => paintNodes(layer, group.children, size),
    (layer) => {
      const g = layer.createRadialGradient(size.w / 2, size.h, 0, size.w / 2, size.h, reach);
      g.addColorStop(0, '#000');
      g.addColorStop(0.35, '#000');
      g.addColorStop(0.95, 'rgba(0, 0, 0, 0)');
      return g;
    },
  );
}

// Paint into a layer the size of `box`, keep it only where the mask is opaque, then lay it down.
function paintMasked(
  ctx: Ctx,
  box: { x: number; y: number; w: number; h: number },
  paint: (layer: Ctx) => void,
  mask: (layer: Ctx) => CanvasGradient,
): void {
  const m = ctx.getTransform?.();
  const scale = m ? Math.hypot(m.a, m.b) || 1 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(box.w * scale));
  canvas.height = Math.max(1, Math.ceil(box.h * scale));
  const layer = canvas.getContext('2d');
  if (!layer) return;
  layer.scale(scale, scale);
  layer.translate(-box.x, -box.y);
  layer.save();
  paint(layer);
  layer.restore();
  layer.globalCompositeOperation = 'destination-in';
  layer.fillStyle = mask(layer);
  layer.fillRect(box.x, box.y, box.w, box.h);
  ctx.drawImage(canvas, box.x, box.y, box.w, box.h);
}

// Retro Grid's floor: the grid on a plane tilted back 62 degrees from the horizon (55% down the
// slide), seen in perspective from the middle of the band below it, fading in from the horizon.
const GRID_TILT = 62 * TURN;

function paintGrid(ctx: Ctx, part: MotionGrid): void {
  const { w, h, cell, line } = part;
  const top = h * 0.55;
  const band = { w, h: h * 0.45 };
  const depth = h * 0.6;
  const pose = openingPose(part.anim);
  // A point of the plane (u across from the band's left, v down the plane) on the band.
  const project = (u: number, v: number) => {
    const z = v * Math.sin(GRID_TILT);
    const k = depth / (depth - z);
    return {
      x: w / 2 + (u - w / 2) * k,
      y: band.h / 2 + (v * Math.cos(GRID_TILT) - band.h / 2) * k,
    };
  };
  // Rows until the floor passes the band's bottom or reaches the eye.
  const nearest = Math.min((depth * 0.98) / Math.sin(GRID_TILT), h * 1.6);
  let farthest = 0;
  while (farthest < nearest && project(0, farthest).y < band.h + cell) farthest += cell / 4;
  farthest = Math.min(farthest, nearest);
  const quad = (layer: Ctx, u0: number, v0: number, u1: number, v1: number) => {
    const pts = [project(u0, v0), project(u1, v0), project(u1, v1), project(u0, v1)];
    layer.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) layer.lineTo(p.x, p.y);
    layer.closePath();
  };
  paintMasked(
    ctx,
    { x: 0, y: top, w: band.w, h: band.h },
    (layer) => {
      layer.translate(0, top);
      layer.fillStyle = rgba(part.color, part.a);
      layer.beginPath();
      // The pattern starts a cell above the plane's top and rolls toward the viewer.
      for (let v = -cell + pose.ty; v < farthest; v += cell) {
        if (v + line > 0) quad(layer, -w, Math.max(0, v), 2 * w, Math.min(farthest, v + line));
      }
      for (let u = -w; u < 2 * w; u += cell) quad(layer, u, 0, u + line, farthest);
      layer.fill();
    },
    (layer) => {
      const g = layer.createLinearGradient(0, top, 0, top + band.h);
      g.addColorStop(0, 'rgba(0, 0, 0, 0)');
      g.addColorStop(0.45, '#000');
      return g;
    },
  );
}

// The SVG export embeds the opening frame as a picture: a deck repeats one background on many
// slides, so the last few are kept rather than painted and encoded again for each. A JPEG of the
// gradient under the motion is about a fiftieth of a see-through PNG of the motion alone (29 to
// 141 KiB a 1920 x 1080 slide, against 4.3 MiB).
const FRAME_CACHE_SIZE = 8;
const FRAME_JPEG_QUALITY = 0.9;
const frameCache = new Map<string, string>();

type MotionGradient = { from: string; to: string; angle: number; motion?: PageMotion };

/** A slide's gradient with its motion as the slide opens, a JPEG data URL the size of the page
 *  (CSS px), for the SVG export; undefined where no canvas can draw (a test run without one). */
export function motionFrameHref(
  fill: MotionGradient,
  width: number,
  height: number,
): string | undefined {
  if (!fill.motion) return undefined;
  const key = `${fill.motion}|${fill.from}|${fill.to}|${fill.angle}|${width}x${height}`;
  const hit = frameCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  let ctx: Ctx | null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return undefined;
  }
  if (!ctx) return undefined;
  const rect = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const l = pageGradientLine({ kind: 'gradient', ...fill }, rect);
  const g = ctx.createLinearGradient(l.x1, l.y1, l.x2, l.y2);
  g.addColorStop(0, fill.from);
  g.addColorStop(1, fill.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintMotionFrame(ctx, fill.motion, fill, rect);
  const href = canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY);
  if (!href.startsWith('data:image/jpeg')) return undefined;
  frameCache.set(key, href);
  if (frameCache.size > FRAME_CACHE_SIZE) frameCache.delete(frameCache.keys().next().value!);
  return href;
}
