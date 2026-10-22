// The painting tools (docs/specs/031-photo/photo-tools.md "Painting and erasing", "Retouching",
// "Focus and tone"): each a stroke on the active layer (or its mask), committed as one edit when it
// ends. Heal copies like the Clone Stamp, then blends the copy's tone into its surroundings; Spot
// Heal fills what was painted from what is around it, in the worker.
import {
  DabToolEngine,
  removeRedEye,
  lumaByte,
  poissonBlend,
  Smoother,
  StrokeEngine,
  TiledRaster,
  type BrushSettings,
  type DabTool,
  type StrokeMode,
} from '@livedesign/photo-engine';
import { photoWorkers } from '../photo-worker-client';
import type { BrushOptions, PhotoToolId } from '../tool-state';
import {
  alphaLocked,
  offsetOf,
  paintTarget,
  rgbOf,
  samplePicture,
  targetOffset,
  type PhotoPoint,
  type ToolCtx,
} from './tool-context';
import type { ToolHandler } from './tool-handler';

function brushOf(o: BrushOptions, extra: Partial<BrushSettings> = {}): BrushSettings {
  return {
    size: o.size,
    hardness: o.hardness,
    opacity: o.opacity,
    flow: o.flow,
    spacing: o.spacing,
    pressureSize: o.pressure === 'size' || o.pressure === 'both',
    pressureOpacity: o.pressure === 'opacity' || o.pressure === 'both',
    ...extra,
  };
}

// Where the Clone Stamp and Heal copy from, kept between strokes (Aligned holds the offset).
const sources = new Map<
  string,
  { x: number; y: number; offset: { x: number; y: number } | null }
>();

const TOOL_LABEL: Partial<Record<PhotoToolId, string>> = {
  brush: 'Brush',
  pencil: 'Pencil',
  eraser: 'Eraser',
  clone: 'Clone Stamp',
  heal: 'Heal',
  blur: 'Blur',
  sharpen: 'Sharpen',
  smudge: 'Smudge',
  dodge: 'Dodge',
  burn: 'Burn',
  sponge: 'Sponge',
  'background-eraser': 'Background Eraser',
  'spot-heal': 'Spot Heal',
};

/** A stroke tool: Brush, Pencil, Eraser, Clone Stamp, Heal and the dab tools. */
export function strokeTool(tool: PhotoToolId, ctx: ToolCtx): ToolHandler {
  let engine: {
    begin: (p: { x: number; y: number; pressure?: number }) => unknown;
    to: (p: { x: number; y: number; pressure?: number }) => unknown;
    bounds: { x: number; y: number; width: number; height: number } | null;
  } | null = null;
  let stroke: StrokeEngine | null = null;
  let smoother: Smoother | null = null;
  let target: { layerId: string; target: 'layer' | 'mask' } | null = null;
  let last: { x: number; y: number } | null = null;
  let healBefore: TiledRaster | null = null;
  // What Heal copies from and by how much, for the blend: the source patch's own texture, edge included.
  let healCopy: { source: TiledRaster; offset: { x: number; y: number } } | null = null;
  const touched = () => {
    if (target)
      ctx.session.redraw([
        {
          layerId: target.layerId,
          target: target.target,
          keys: [...ctx.session.raster(target.layerId, target.target).peekDirty()],
        },
      ]);
  };
  return {
    cursor: 'brush',
    down(p: PhotoPoint) {
      const s = ctx.session;
      const st = ctx.state();
      if ((tool === 'clone' || tool === 'heal') && p.alt) {
        sources.set(s.pageId, { x: p.x, y: p.y, offset: null });
        ctx.setOverlay({ kind: 'source', x: p.x, y: p.y });
        return false;
      }
      const t = paintTarget(ctx);
      if (!t) return false;
      target = { layerId: t.layer.id, target: t.target };
      const raster = s.raster(t.layer.id, t.target);
      const offset = targetOffset(t.layer, t.target);
      const selection = s.selection;
      const fg = rgbOf(st.foreground);
      const bg = rgbOf(st.background);
      const point = { x: p.x, y: p.y, pressure: p.pressure };
      // Shift: a straight line from the last stroke's end.
      const from = p.shift && last ? { ...last, pressure: p.pressure } : point;
      const make = (): void => {
        if (
          tool === 'brush' ||
          tool === 'pencil' ||
          tool === 'eraser' ||
          tool === 'clone' ||
          tool === 'heal'
        ) {
          const key =
            tool === 'clone' || tool === 'heal' ? tool : tool === 'eraser' ? 'eraser' : tool;
          const o = st.options[key as 'brush'];
          const pencil =
            tool === 'pencil' || (tool === 'eraser' && st.options.eraser.eraserMode !== 'brush');
          const block = tool === 'eraser' && st.options.eraser.eraserMode === 'block';
          const brush = brushOf(o, {
            ...(pencil ? { aliased: true, hardness: 1 } : {}),
            ...(block ? { shape: 'square' as const, size: Math.max(8, 16 / p.scale) } : {}),
            ...(tool === 'pencil' && st.options.pencil.square ? { shape: 'square' as const } : {}),
          });
          let mode: StrokeMode;
          if (t.target === 'mask') {
            // The foreground's grey; the Eraser the background's (white by default: it shows again).
            mode = { kind: 'mask', value: lumaByte(...(tool === 'eraser' ? bg : fg)) };
          } else if (tool === 'eraser') {
            // A layer with locked transparency is painted the background colour instead.
            mode = alphaLocked(t.layer)
              ? { kind: 'paint', colour: bg, blend: 'normal' }
              : { kind: 'erase' };
          } else if (tool === 'clone' || tool === 'heal') {
            const src = sources.get(s.pageId);
            if (!src) {
              ctx.toast(`Alt+press to choose where ${TOOL_LABEL[tool]} copies from.`);
              return;
            }
            const aligned = st.options[tool].aligned;
            if (!src.offset || !aligned) src.offset = { x: src.x - from.x, y: src.y - from.y };
            const sample = st.options[tool].sampleAll
              ? TiledRaster.fromRaster(samplePicture(ctx, true), -offset.x, -offset.y)
              : raster.clone();
            const by = { x: Math.round(src.offset.x), y: Math.round(src.offset.y) };
            mode = { kind: 'clone', source: sample, offset: by };
            if (tool === 'heal') {
              healBefore = raster.clone();
              healCopy = { source: sample, offset: by };
            }
          } else {
            const auto = tool === 'pencil' && st.options.pencil.autoErase;
            const startsOnFg =
              auto &&
              (() => {
                const lx = Math.floor(from.x - offset.x);
                const ly = Math.floor(from.y - offset.y);
                return (
                  raster.sample(lx, ly, 0) === fg[0] &&
                  raster.sample(lx, ly, 1) === fg[1] &&
                  raster.sample(lx, ly, 2) === fg[2] &&
                  raster.sample(lx, ly, 3) > 0
                );
              })();
            mode = { kind: 'paint', colour: startsOnFg ? bg : fg, blend: o.mode };
          }
          stroke = new StrokeEngine(
            { raster, offset, selection, lockAlpha: alphaLocked(t.layer) && tool !== 'eraser' },
            brush,
            mode,
          );
          engine = stroke;
          smoother = new Smoother(o.smoothing, 40 / Math.max(0.05, p.scale));
          return;
        }
        // The dab tools.
        let dab: DabTool;
        const f = st.options.focus;
        const tn = st.options.tone;
        if (tool === 'blur') dab = { kind: 'blur', strength: f.strength };
        else if (tool === 'sharpen')
          dab = { kind: 'sharpen', strength: f.strength, protectDetail: f.protectDetail };
        else if (tool === 'smudge')
          dab = {
            kind: 'smudge',
            strength: f.strength,
            ...(f.fingerPainting ? { fingerColour: fg } : {}),
          };
        else if (tool === 'dodge' || tool === 'burn')
          dab = {
            kind: tool,
            range: tn.range,
            exposure: tn.exposure,
            protectTones: tn.protectTones,
          };
        else if (tool === 'sponge')
          dab = { kind: 'sponge', saturate: tn.saturate, flow: tn.flow, vibrance: tn.vibrance };
        else {
          const be = st.options.backgroundEraser;
          dab = {
            kind: 'background-eraser',
            tolerance: be.tolerance,
            continuous: be.continuous,
            contiguous: be.contiguous,
            ...(be.protect ? { protect: fg } : {}),
          };
        }
        const o =
          tool === 'background-eraser'
            ? st.options.backgroundEraser
            : tool === 'dodge' || tool === 'burn' || tool === 'sponge'
              ? tn
              : f;
        engine = new DabToolEngine({ raster, offset, selection }, brushOf(o), dab);
        smoother = new Smoother(o.smoothing, 40 / Math.max(0.05, p.scale));
      };
      make();
      if (!engine) return false;
      smoother?.push(from);
      engine.begin(from);
      if (from !== point) engine.to(point);
      touched();
      return true;
    },
    move(p: PhotoPoint) {
      if (!engine) {
        if (tool === 'clone' || tool === 'heal') {
          const src = sources.get(ctx.session.pageId);
          if (src?.offset)
            ctx.setOverlay({ kind: 'source', x: p.x + src.offset.x, y: p.y + src.offset.y });
        }
        return;
      }
      const next = smoother?.push({ x: p.x, y: p.y, pressure: p.pressure }) ?? {
        x: p.x,
        y: p.y,
        pressure: p.pressure,
      };
      if (!next) return;
      engine.to(next);
      touched();
      const src = sources.get(ctx.session.pageId);
      if ((tool === 'clone' || tool === 'heal') && src?.offset)
        ctx.setOverlay({ kind: 'source', x: p.x + src.offset.x, y: p.y + src.offset.y });
    },
    up(p: PhotoPoint) {
      if (!engine || !target) return;
      const end = smoother?.finish({ x: p.x, y: p.y, pressure: p.pressure });
      if (end) engine.to(end);
      if (stroke) stroke.end();
      last = { x: p.x, y: p.y };
      const s = ctx.session;
      // Heal: the copy's colour and tone corrected to its surroundings, over the stroke's area.
      if (tool === 'heal' && healBefore && healCopy && engine.bounds) {
        const layer = s.layer(target.layerId)!;
        const o = offsetOf(layer);
        const pad = Math.ceil(ctx.state().options.heal.size);
        const r = engine.bounds;
        const rect = {
          x: Math.floor(r.x - o.x) - pad,
          y: Math.floor(r.y - o.y) - pad,
          width: Math.ceil(r.width) + pad * 2,
          height: Math.ceil(r.height) + pad * 2,
        };
        const raster = s.raster(target.layerId);
        const after = raster.read(rect);
        const before = healBefore.read(rect);
        // The guidance is the source patch itself, not the stroke's result: past the stroke's edge the
        // result is the destination again, which would hand the blend the copy's hard edge.
        const copy = healCopy.source.read({
          ...rect,
          x: rect.x + healCopy.offset.x,
          y: rect.y + healCopy.offset.y,
        });
        const mask = new Uint8Array(rect.width * rect.height);
        for (let i = 0; i < mask.length; i++) {
          const d =
            Math.abs(after.data[i * 4]! - before.data[i * 4]!) +
            Math.abs(after.data[i * 4 + 1]! - before.data[i * 4 + 1]!) +
            Math.abs(after.data[i * 4 + 2]! - before.data[i * 4 + 2]!);
          mask[i] = d > 0 ? 255 : 0;
        }
        raster.write(poissonBlend(before, copy, mask), rect.x, rect.y);
      }
      s.commitPixels(TOOL_LABEL[tool] ?? 'Paint', [target]);
      engine = null;
      stroke = null;
      healBefore = null;
      healCopy = null;
    },
    cancel() {
      engine = null;
    },
  };
}

/** Spot Heal: paint over a blemish; on release, it is filled from what is around it. */
export function spotHealTool(ctx: ToolCtx): ToolHandler {
  let painted: { x: number; y: number }[] = [];
  let size = 40;
  return {
    cursor: 'brush',
    down(p) {
      if (!paintTarget(ctx)) return false;
      size = ctx.state().options.spotHeal.size;
      painted = [{ x: p.x, y: p.y }];
      ctx.setOverlay({ kind: 'path', points: painted, closed: false });
      return true;
    },
    move(p) {
      if (!painted.length) return;
      painted.push({ x: p.x, y: p.y });
      ctx.setOverlay({ kind: 'path', points: [...painted], closed: false });
    },
    up() {
      const s = ctx.session;
      const layer = s.layer(s.active);
      if (!layer || layer.layerKind !== 'pixel' || !painted.length) {
        painted = [];
        ctx.setOverlay({ kind: 'none' });
        return;
      }
      const o = offsetOf(layer);
      const r = size / 2;
      const xs = painted.map((q) => q.x);
      const ys = painted.map((q) => q.y);
      // The region searched for patches: three times the painted area.
      const spanX = Math.max(...xs) - Math.min(...xs) + size;
      const spanY = Math.max(...ys) - Math.min(...ys) + size;
      const reach = Math.max(spanX, spanY);
      const rect = {
        x: Math.floor(Math.min(...xs) - r - reach) - o.x,
        y: Math.floor(Math.min(...ys) - r - reach) - o.y,
        width: Math.ceil(spanX + reach * 2),
        height: Math.ceil(spanY + reach * 2),
      };
      const raster = s.raster(layer.id);
      const pic = raster.read(rect);
      const hole = new Uint8Array(rect.width * rect.height);
      for (const q of painted)
        for (let y = Math.floor(q.y - r); y <= Math.ceil(q.y + r); y++)
          for (let x = Math.floor(q.x - r); x <= Math.ceil(q.x + r); x++) {
            if (Math.hypot(x + 0.5 - q.x, y + 0.5 - q.y) > r) continue;
            const lx = x - o.x - rect.x;
            const ly = y - o.y - rect.y;
            if (lx >= 0 && ly >= 0 && lx < rect.width && ly < rect.height)
              hole[ly * rect.width + lx] = 1;
          }
      painted = [];
      ctx.setOverlay({ kind: 'none' });
      const proximity = ctx.state().options.spotHeal.proximity;
      void photoWorkers()
        .run({ kind: 'fill', raster: pic, hole, seed: 7 })
        .result.then((res) => {
          if (res.kind !== 'fill') return;
          // Proximity Match keeps only the nearest ring's texture: a softer blend of the fill.
          const filled = res.raster;
          if (proximity) {
            for (let i = 0; i < hole.length; i++)
              if (hole[i])
                for (let c = 0; c < 3; c++)
                  filled.data[i * 4 + c] = (filled.data[i * 4 + c]! + pic.data[i * 4 + c]!) / 2;
          }
          raster.write(filled, rect.x, rect.y);
          s.changed();
          s.commitPixels('Spot Heal', [{ layerId: layer.id, target: 'layer' }]);
        });
    },
  };
}

/** Red Eye: a press on a red pupil darkens it. */
export function redEyeTool(ctx: ToolCtx): ToolHandler {
  return {
    cursor: 'crosshair',
    down(p) {
      const t = paintTarget(ctx);
      if (!t || t.target === 'mask') return false;
      const o = offsetOf(t.layer);
      const reach = Math.max(20, 60 / p.scale);
      const rect = {
        x: Math.floor(p.x - reach) - o.x,
        y: Math.floor(p.y - reach) - o.y,
        width: Math.ceil(reach * 2),
        height: Math.ceil(reach * 2),
      };
      const raster = ctx.session.raster(t.layer.id);
      const pic = raster.read(rect);
      const opts = ctx.state().options.redEye;
      const n = removeRedEye(pic, p.x - o.x - rect.x, p.y - o.y - rect.y, {
        pupil: opts.pupil,
        darken: opts.darken,
        radius: reach,
      });
      if (!n) {
        ctx.toast('No red pupil there.');
        return false;
      }
      raster.write(pic, rect.x, rect.y);
      ctx.session.changed();
      ctx.session.commitPixels('Red Eye', [{ layerId: t.layer.id, target: 'layer' }]);
      return false;
    },
  };
}
