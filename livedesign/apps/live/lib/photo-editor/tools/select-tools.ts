// The selection tools (docs/specs/031-photo/photo-tools.md "Selecting"): marquees, lassos, the
// Magnetic Lasso, the Magic Wand and Quick Select, each making a selection combined with the one there
// by the modifiers (Shift adds, Alt subtracts, both intersect, or the options flyout's choice), feathered
// and anti-aliased as the options say.
import {
  antiAliasEdge,
  combineMasks,
  createMask,
  edgeCost,
  ellipseMask,
  featherMask,
  floodSelect,
  livewirePath,
  maskAt,
  polygonMask,
  rectMask,
  type Mask8,
  type Plane,
} from '@livedesign/photo-engine';
import { photoWorkers } from '../photo-worker-client';
import type { PhotoToolId, SelectMode } from '../tool-state';
import { photoRect, samplePicture, type PhotoPoint, type ToolCtx } from './tool-context';
import { spaceHeld } from './held-keys';
import type { ToolHandler } from './tool-handler';

/** The modifier a press means: keys first, else the options flyout's. */
export function selectMode(p: { shift: boolean; alt: boolean }, chosen: SelectMode): SelectMode {
  if (p.shift && p.alt) return 'intersect';
  if (p.shift) return 'add';
  if (p.alt) return 'subtract';
  return chosen;
}

/** A new piece of selection combined into the session's, feathered. */
export function applySelection(
  ctx: ToolCtx,
  piece: Mask8 | null,
  mode: SelectMode,
  label = 'Select',
): void {
  const s = ctx.session;
  const feather = ctx.state().options.select.feather;
  const soft = piece && feather > 0 ? featherMask(piece, feather) : piece;
  const before = s.selection;
  const next = soft
    ? combineMasks(mode === 'new' ? null : before, soft, mode)
    : mode === 'new'
      ? null
      : before;
  if (before) s.lastSelection = before;
  s.selection = next;
  s.changed();
  void label;
}

function marquee(ellipse: boolean, ctx: ToolCtx): ToolHandler {
  let start: { x: number; y: number } | null = null;
  // Where the pointer last was, for Space held moving the shape as it is drawn.
  let last: { x: number; y: number } | null = null;
  let mode: SelectMode = 'new';
  let moving: { from: { x: number; y: number }; sel: Mask8 } | null = null;
  const box = (p: PhotoPoint) => {
    const o = ctx.state().options.select;
    let x1 = p.x;
    let y1 = p.y;
    if (o.style === 'size') {
      x1 = start!.x + o.sizeW;
      y1 = start!.y + o.sizeH;
    } else if (o.style === 'ratio' || (p.shift && mode === 'new')) {
      const rw = o.style === 'ratio' ? o.ratioW : 1;
      const rh = o.style === 'ratio' ? o.ratioH : 1;
      const w = Math.abs(p.x - start!.x);
      const h = (w * rh) / rw;
      y1 = start!.y + Math.sign(p.y - start!.y || 1) * h;
    }
    let x0 = start!.x;
    let y0 = start!.y;
    if (p.alt && mode === 'new') {
      x0 = start!.x - (x1 - start!.x);
      y0 = start!.y - (y1 - start!.y);
    }
    return {
      x0: Math.min(x0, x1),
      y0: Math.min(y0, y1),
      x1: Math.max(x0, x1),
      y1: Math.max(y0, y1),
    };
  };
  return {
    cursor: 'crosshair',
    down(p) {
      const s = ctx.session;
      // A press inside the selection with no modifier moves the selection itself.
      if (
        s.selection &&
        !p.shift &&
        !p.alt &&
        maskAt(s.selection, Math.floor(p.x), Math.floor(p.y)) > 0
      ) {
        moving = { from: { x: p.x, y: p.y }, sel: s.selection };
        return true;
      }
      start = { x: p.x, y: p.y };
      last = { x: p.x, y: p.y };
      spaceHeld();
      mode = selectMode(p, ctx.state().options.select.mode);
      return true;
    },
    move(p) {
      if (moving) {
        const dx = Math.round(p.x - moving.from.x);
        const dy = Math.round(p.y - moving.from.y);
        ctx.session.selection = { ...moving.sel, x: moving.sel.x + dx, y: moving.sel.y + dy };
        ctx.session.changed();
        return;
      }
      if (!start) return;
      if (spaceHeld() && last) start = { x: start.x + p.x - last.x, y: start.y + p.y - last.y };
      last = { x: p.x, y: p.y };
      const b = box(p);
      ctx.setOverlay({
        kind: 'rect',
        x: b.x0,
        y: b.y0,
        width: b.x1 - b.x0,
        height: b.y1 - b.y0,
        ellipse,
      });
    },
    up(p) {
      if (moving) {
        // A click inside the selection that never moved it deselects, as one outside it does.
        const still =
          Math.round(p.x - moving.from.x) === 0 && Math.round(p.y - moving.from.y) === 0;
        if (still) applySelection(ctx, null, 'new');
        moving = null;
        return;
      }
      if (!start) return;
      const b = box(p);
      const aa = ctx.state().options.select.antiAlias;
      ctx.setOverlay({ kind: 'none' });
      const tiny = b.x1 - b.x0 < 1 && b.y1 - b.y0 < 1;
      start = null;
      if (tiny) {
        // A click with no drag deselects (a new selection), or does nothing with a modifier.
        if (mode === 'new') applySelection(ctx, null, 'new');
        return;
      }
      applySelection(
        ctx,
        ellipse ? ellipseMask(b.x0, b.y0, b.x1, b.y1, aa) : rectMask(b.x0, b.y0, b.x1, b.y1, aa),
        mode,
      );
    },
    key(key, e) {
      const s = ctx.session;
      if (!s.selection || !key.startsWith('Arrow')) return false;
      const step = e.shift ? 10 : 1;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      s.selection = { ...s.selection, x: s.selection.x + dx, y: s.selection.y + dy };
      s.changed();
      return true;
    },
  };
}

function lasso(ctx: ToolCtx): ToolHandler {
  let pts: { x: number; y: number }[] = [];
  let mode: SelectMode = 'new';
  return {
    cursor: 'crosshair',
    down(p) {
      mode = selectMode(p, ctx.state().options.select.mode);
      pts = [{ x: p.x, y: p.y }];
      return true;
    },
    move(p) {
      if (!pts.length) return;
      const last = pts[pts.length - 1]!;
      if (Math.hypot(p.x - last.x, p.y - last.y) * p.scale < 2) return;
      pts.push({ x: p.x, y: p.y });
      // A copy each time: the overlay redraws for a new list, not for the same one grown.
      ctx.setOverlay({ kind: 'path', points: [...pts], closed: false });
    },
    up() {
      ctx.setOverlay({ kind: 'none' });
      if (pts.length >= 3)
        applySelection(ctx, polygonMask(pts, ctx.state().options.select.antiAlias), mode);
      pts = [];
    },
  };
}

function polygonLasso(ctx: ToolCtx): ToolHandler {
  let pts: { x: number; y: number }[] = [];
  let mode: SelectMode = 'new';
  const close = () => {
    ctx.setOverlay({ kind: 'none' });
    if (pts.length >= 3)
      applySelection(ctx, polygonMask(pts, ctx.state().options.select.antiAlias), mode);
    pts = [];
  };
  return {
    cursor: 'crosshair',
    down(p) {
      if (!pts.length) mode = selectMode(p, ctx.state().options.select.mode);
      const first = pts[0];
      // A press on the first corner closes it.
      if (first && pts.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) * p.scale < 8) {
        close();
        return false;
      }
      pts.push({ x: p.x, y: p.y });
      ctx.setOverlay({ kind: 'path', points: [...pts], closed: false });
      return false;
    },
    move(p) {
      if (pts.length)
        ctx.setOverlay({ kind: 'path', points: [...pts], closed: false, live: { x: p.x, y: p.y } });
    },
    double: close,
    key(key) {
      if (!pts.length) return false;
      if (key === 'Enter') close();
      else if (key === 'Escape') {
        pts = [];
        ctx.setOverlay({ kind: 'none' });
      } else if (key === 'Backspace') {
        pts.pop();
        ctx.setOverlay({ kind: 'path', points: [...pts], closed: false });
      } else return false;
      return true;
    },
  };
}

function magneticLasso(ctx: ToolCtx): ToolHandler {
  let anchors: { x: number; y: number }[] = [];
  let fixed: { x: number; y: number }[] = [];
  let live: { x: number; y: number }[] = [];
  let cost: Plane | null = null;
  let mode: SelectMode = 'new';
  const close = () => {
    const all = [...fixed, ...live];
    ctx.setOverlay({ kind: 'none' });
    if (all.length >= 3) applySelection(ctx, polygonMask(all, true), mode);
    anchors = [];
    fixed = [];
    live = [];
  };
  return {
    cursor: 'crosshair',
    down(p) {
      const o = ctx.state().options.magnetic;
      if (!cost) cost = edgeCost(samplePicture(ctx, false), o.contrast);
      if (!anchors.length) {
        mode = selectMode(p, ctx.state().options.select.mode);
        anchors = [{ x: p.x, y: p.y }];
        fixed = [{ x: p.x, y: p.y }];
        return false;
      }
      const first = anchors[0]!;
      if (anchors.length >= 2 && Math.hypot(p.x - first.x, p.y - first.y) * p.scale < 8) {
        close();
        return false;
      }
      // A press lays an anchor where the live path reaches.
      fixed = [...fixed, ...live];
      anchors.push({ x: p.x, y: p.y });
      live = [];
      return false;
    },
    move(p) {
      if (!anchors.length || !cost) return;
      const o = ctx.state().options.magnetic;
      const from = anchors[anchors.length - 1]!;
      live = livewirePath(cost, from, { x: p.x, y: p.y }, o.width).map((q) => ({
        x: q.x + 0.5,
        y: q.y + 0.5,
      }));
      // Anchors laid on their own every so often (Frequency).
      const every = Math.max(16, 220 - o.frequency * 2);
      if (live.length > every) {
        const at = live[Math.floor(live.length * 0.6)]!;
        fixed = [...fixed, ...live.slice(0, Math.floor(live.length * 0.6))];
        anchors.push(at);
        live = live.slice(Math.floor(live.length * 0.6));
      }
      ctx.setOverlay({ kind: 'path', points: [...fixed, ...live], closed: false });
    },
    double: close,
    key(key) {
      if (!anchors.length) return false;
      if (key === 'Enter') close();
      else if (key === 'Escape') {
        anchors = [];
        fixed = [];
        live = [];
        ctx.setOverlay({ kind: 'none' });
      } else return false;
      return true;
    },
    cancel() {
      cost = null;
    },
  };
}

function magicWand(ctx: ToolCtx): ToolHandler {
  return {
    cursor: 'crosshair',
    down(p) {
      const o = ctx.state().options.wand;
      const pic = samplePicture(ctx, o.sampleAll);
      let m: Mask8 = floodSelect(pic, Math.floor(p.x), Math.floor(p.y), {
        tolerance: o.tolerance,
        contiguous: o.contiguous,
      });
      if (ctx.state().options.select.antiAlias) m = antiAliasEdge(m);
      applySelection(ctx, m, selectMode(p, ctx.state().options.select.mode), 'Magic Wand');
      return false;
    },
  };
}

function quickSelectTool(ctx: ToolCtx): ToolHandler {
  let painted: Mask8 | null = null;
  let subtract = false;
  let pic: ReturnType<typeof samplePicture> | null = null;
  let busy = false;
  // Dabs came while a cut was running: one more cut once it lands, so the stroke's end is never dropped.
  let again = false;
  // The stroke has ended: its last cut lands, then Auto-Enhance smooths the edge.
  let ended = false;
  const dab = (p: PhotoPoint) => {
    const r = ctx.state().options.quick.size / 2;
    const m = ellipseMask(p.x - r, p.y - r, p.x + r, p.y + r, false);
    if (!m) return;
    painted = painted ? combineMasks(painted, m, 'add') : m;
  };
  const enhance = (raster: NonNullable<typeof pic>) => {
    const s = ctx.session;
    if (!s.selection || !ctx.state().options.quick.autoEnhance) return;
    // A smoother edge once the strokes are done.
    void photoWorkers()
      .run({ kind: 'refine', raster, mask: s.selection, radius: 2 })
      .result.then((res) => {
        if (res.kind === 'selection') {
          s.selection = res.selection;
          s.changed();
        }
      });
  };
  const run = () => {
    if (!painted || !pic) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    again = false;
    const s = ctx.session;
    const raster = pic;
    void photoWorkers()
      .run({ kind: 'quick-select', raster, current: s.selection, painted, subtract })
      .result.then((res) => {
        busy = false;
        if (res.kind === 'selection') {
          s.selection = res.selection;
          s.changed();
        }
        if (again) run();
        else if (ended) {
          ended = false;
          pic = null;
          enhance(raster);
        }
      });
  };
  return {
    cursor: 'brush',
    down(p) {
      subtract = p.alt;
      pic = samplePicture(ctx, ctx.state().options.quick.sampleAll);
      painted = null;
      ended = false;
      dab(p);
      run();
      return true;
    },
    move(p) {
      if (!pic) return;
      dab(p);
      run();
    },
    up() {
      ended = true;
      run();
    },
  };
}

export function selectTool(tool: PhotoToolId, ctx: ToolCtx): ToolHandler {
  switch (tool) {
    case 'rect-select':
      return marquee(false, ctx);
    case 'ellipse-select':
      return marquee(true, ctx);
    case 'lasso':
      return lasso(ctx);
    case 'polygon-lasso':
      return polygonLasso(ctx);
    case 'magnetic-lasso':
      return magneticLasso(ctx);
    case 'magic-wand':
      return magicWand(ctx);
    default:
      return quickSelectTool(ctx);
  }
}

/** Select All: the whole photo. */
export function selectAll(ctx: ToolCtx): void {
  applySelection(ctx, createMask(photoRect(ctx.session.photo), 255), 'new', 'Select All');
}
