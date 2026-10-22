// The Crop tool (docs/specs/031-photo/photo-tools.md "Crop"): a crop box over the photo (the whole
// photo at first). While it is still that first box, a drag on the photo draws a new box from the press (as
// Photoshop's does), held to a fixed Ratio; after that its edges and corners resize it (a fixed Ratio keeping its
// shape), inside moves it, outside straightens it (rotates), and Straighten turns it so a drawn line lies level. Enter crops
// (one edit, the page taking the new size); Escape leaves it.
import { useSyncExternalStore } from 'react';
import {
  apply,
  boxFromReadout,
  boxReadout,
  dragBox,
  grabAt,
  type Grab,
  type Matrix,
} from '@livedesign/photo-engine';
import { cropTo } from '../image-ops';
import type { ToolOptions } from '../tool-state';
import type { ToolCtx } from './tool-context';
import type { ToolHandler } from './tool-handler';
import { HANDLE_REACH_PX } from './transform-tool';

// The box is a unit picture of these px under its matrix, so the readout's size is the matrix's scale.
const UNIT = 100;

// `fresh`: the box is still the one the tool began with, so a drag inside it draws a new one.
export type CropState = { matrix: Matrix; straighten: boolean; fresh?: boolean };

let state: CropState | null = null;
const listeners = new Set<() => void>();
function set(next: CropState | null): void {
  state = next;
  for (const fn of listeners) fn();
}

export const cropBox = {
  get: (): CropState | null => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useCropBox(): CropState | null {
  return useSyncExternalStore(
    (fn) => cropBox.subscribe(fn),
    cropBox.get,
    () => null,
  );
}

export type CropRect = { x: number; y: number; width: number; height: number; angle: number };

export const cropReadout = (c: CropState): CropRect => boxReadout(c.matrix, UNIT, UNIT);

const matrixOf = (r: CropRect): Matrix => boxFromReadout(UNIT, UNIT, r);

/** A ratio's width over height, or null for Free. */
export function ratioOf(
  ratio: ToolOptions['crop']['ratio'],
  photo: { width: number; height: number },
): number | null {
  if (ratio === 'free') return null;
  if (ratio === 'original') return photo.width / photo.height;
  const [w, h] = ratio.split(':').map(Number);
  return w! / h!;
}

/** The largest box of `ratio` centred in the photo (the whole photo for Free). */
export function fittedBox(
  photo: { width: number; height: number },
  ratio: number | null,
): CropRect {
  if (!ratio) return { x: 0, y: 0, width: photo.width, height: photo.height, angle: 0 };
  let width = photo.width;
  let height = width / ratio;
  if (height > photo.height) {
    height = photo.height;
    width = height * ratio;
  }
  return { x: (photo.width - width) / 2, y: (photo.height - height) / 2, width, height, angle: 0 };
}

const show = (ctx: ToolCtx) => {
  if (!state) return ctx.setOverlay({ kind: 'none' });
  const r = cropReadout(state);
  ctx.setOverlay({ kind: 'crop', ...r });
};

export function beginCrop(ctx: ToolCtx): void {
  const o = ctx.state().options.crop;
  set({
    matrix: matrixOf(fittedBox(ctx.session.photo, ratioOf(o.ratio, ctx.session.photo))),
    straighten: false,
    fresh: true,
  });
  show(ctx);
}

/** The box drawn from `a` to `b` (photo px), held to `ratio` (width over height) when set: the drag's longer side
 *  leads, and the box grows from `a` toward `b`. */
export function drawnBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  ratio: number | null,
): CropRect {
  let w = Math.abs(b.x - a.x);
  let h = Math.abs(b.y - a.y);
  if (ratio) {
    if (w / ratio >= h) h = w / ratio;
    else w = h * ratio;
  }
  return {
    x: b.x >= a.x ? a.x : a.x - w,
    y: b.y >= a.y ? a.y : a.y - h,
    width: Math.max(1, w),
    height: Math.max(1, h),
    angle: 0,
  };
}

// A drag shorter than this, photo px, on a fresh box draws nothing (a click leaves the box as it was).
const DRAW_MIN_PX = 2;

/** The Ratio changed: the box reshaped to it, centred where it was. */
export function reshapeCrop(ctx: ToolCtx, ratio: ToolOptions['crop']['ratio']): void {
  if (!state) return beginCrop(ctx);
  const r = ratioOf(ratio, ctx.session.photo);
  const now = cropReadout(state);
  if (!r) return;
  const centre = apply(state.matrix, { x: UNIT / 2, y: UNIT / 2 });
  const area = now.width * now.height;
  const width = Math.sqrt(area * r);
  const height = width / r;
  // The top-left found by walking back from the centre along the box's own axes.
  const a = (now.angle * Math.PI) / 180;
  const x = centre.x - (Math.cos(a) * width) / 2 + (Math.sin(a) * height) / 2;
  const y = centre.y - (Math.sin(a) * width) / 2 - (Math.cos(a) * height) / 2;
  set({ ...state, matrix: matrixOf({ x, y, width, height, angle: now.angle }) });
  show(ctx);
}

export function setStraighten(ctx: ToolCtx, on: boolean): void {
  if (!state) beginCrop(ctx);
  set({ ...state!, straighten: on });
}

export function commitCrop(ctx: ToolCtx): void {
  if (!state) return;
  const r = cropReadout(state);
  const centre = apply(state.matrix, { x: UNIT / 2, y: UNIT / 2 });
  set(null);
  ctx.setOverlay({ kind: 'none' });
  const refused = cropTo(
    ctx.session,
    { x: centre.x - r.width / 2, y: centre.y - r.height / 2, width: r.width, height: r.height },
    r.angle,
    ctx.state().options.crop.deletePixels,
  );
  if (refused) ctx.toast(refused);
}

export function cancelCrop(ctx: ToolCtx): void {
  set(null);
  ctx.setOverlay({ kind: 'none' });
}

export function cropTool(ctx: ToolCtx): ToolHandler {
  let grab: Grab | null = null;
  let from: { x: number; y: number } | null = null;
  let m0: Matrix | null = null;
  let line: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  // Drawing a new box over the fresh one, from `from`.
  let drawing = false;
  return {
    cursor: 'crosshair',
    down(p) {
      if (!state) beginCrop(ctx);
      if (state!.straighten) {
        line = { from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y } };
        ctx.setOverlay({ kind: 'line', ...line });
        return true;
      }
      m0 = state!.matrix;
      grab = grabAt(m0, UNIT, UNIT, p, HANDLE_REACH_PX / p.scale, false);
      from = { x: p.x, y: p.y };
      drawing = !!state!.fresh && grab.kind === 'move';
      return true;
    },
    move(p) {
      if (!state) return;
      if (line) {
        line = { ...line, to: { x: p.x, y: p.y } };
        ctx.setOverlay({ kind: 'line', ...line });
        return;
      }
      if (!grab || !from || !m0) return;
      if (drawing) {
        if (Math.hypot(p.x - from.x, p.y - from.y) < DRAW_MIN_PX) return;
        const r = ratioOf(ctx.state().options.crop.ratio, ctx.session.photo);
        set({ straighten: false, matrix: matrixOf(drawnBox(from, p, r)) });
        show(ctx);
        return;
      }
      // A fixed ratio keeps the box's shape, as Shift does.
      const fixed = ctx.state().options.crop.ratio !== 'free';
      set({
        straighten: state.straighten,
        matrix: dragBox(m0, UNIT, UNIT, grab, from, p, { shift: p.shift || fixed, alt: p.alt }),
      });
      show(ctx);
    },
    up() {
      if (line && state) {
        const dx = line.to.x - line.from.x;
        const dy = line.to.y - line.from.y;
        line = null;
        if (Math.hypot(dx, dy) >= 4) {
          // The line drawn is made level: the box turns by its angle (nearest to horizontal or upright).
          let a = (Math.atan2(dy, dx) * 180) / Math.PI;
          while (a > 45) a -= 90;
          while (a < -45) a += 90;
          const now = cropReadout(state);
          const centre = apply(state.matrix, { x: UNIT / 2, y: UNIT / 2 });
          const rad = (a * Math.PI) / 180;
          const x = centre.x - (Math.cos(rad) * now.width) / 2 + (Math.sin(rad) * now.height) / 2;
          const y = centre.y - (Math.sin(rad) * now.width) / 2 - (Math.cos(rad) * now.height) / 2;
          set({ straighten: false, matrix: matrixOf({ ...now, x, y, angle: a }) });
        } else set({ ...state, straighten: false });
        show(ctx);
        return;
      }
      grab = null;
      from = null;
      m0 = null;
      drawing = false;
    },
    double() {
      commitCrop(ctx);
    },
    key(key) {
      if (key === 'Enter') commitCrop(ctx);
      else if (key === 'Escape') cancelCrop(ctx);
      else return false;
      return true;
    },
    cancel() {
      cancelCrop(ctx);
    },
  };
}
