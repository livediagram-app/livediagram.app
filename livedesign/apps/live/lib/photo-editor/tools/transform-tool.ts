// Free Transform (docs/specs/031-photo/photo-tools.md "Moving and transforming"): Ctrl/Cmd+T or the
// Image menu lifts the active layer's pixels (or the selection's) into a box with eight handles; a
// drag moves, scales, rotates or distorts it, the options flyout reads and types its X, Y, W, H and
// Angle and flips it, and Enter (Commit) resamples once from the lifted pixels while Escape (Cancel)
// puts the layer back. One edit.
import { useSyncExternalStore } from 'react';
import {
  boxFromReadout,
  boxReadout,
  chain,
  dragBox,
  grabAt,
  IDENTITY,
  scale,
  translate,
  type Grab,
  type Interpolation,
  type Matrix,
  type TransformMode,
} from '@livedesign/photo-engine';
import { dropLift, lift, putDown, type Lifted } from './lift';
import type { ToolCtx } from './tool-context';
import type { ToolHandler } from './tool-handler';
import { shakeLock } from '../lock-shake';

// How near a handle a press grabs it, in screen px.
export const HANDLE_REACH_PX = 8;

export type TransformState = {
  lifted: Lifted;
  // The transform of the photo's px: the identity where the pixels were lifted.
  matrix: Matrix;
  interpolation: Interpolation;
  // What a handle does beyond scaling (the options flyout's Mode).
  mode: TransformMode;
};

let state: TransformState | null = null;
const listeners = new Set<() => void>();

function set(next: TransformState | null): void {
  state = next;
  for (const fn of listeners) fn();
}

export const freeTransform = {
  get: (): TransformState | null => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useFreeTransform(): TransformState | null {
  return useSyncExternalStore(
    (fn) => freeTransform.subscribe(fn),
    freeTransform.get,
    () => null,
  );
}

/** The lifted picture's px to the photo's, as the box draws it. */
const boxMatrix = (t: TransformState): Matrix => chain(translate(t.lifted.x, t.lifted.y), t.matrix);

const showFloat = (ctx: ToolCtx, t: TransformState) =>
  ctx.setOverlay({
    kind: 'float',
    raster: t.lifted.raster,
    x: t.lifted.x,
    y: t.lifted.y,
    matrix: t.matrix,
  });

/** Starts a Free Transform of the active layer (or the selection's pixels on it). */
export function beginTransform(ctx: ToolCtx): boolean {
  const s = ctx.session;
  if (state) return true;
  const layer = s.layer(s.active);
  if (!layer || layer.layerKind !== 'pixel') {
    ctx.toast(
      layer?.layerKind === 'text'
        ? 'Rasterize the text layer to transform its pixels.'
        : 'Choose a pixel layer to transform.',
    );
    return false;
  }
  if (layer.locks?.position || layer.locks?.all || layer.locks?.pixels) {
    shakeLock(layer.id);
    ctx.toast(`${layer.name} is locked.`);
    return false;
  }
  const lifted = lift(s, layer, s.selection);
  if (!lifted) {
    ctx.toast('Nothing to transform there.');
    return false;
  }
  const next: TransformState = {
    lifted,
    matrix: IDENTITY,
    interpolation: 'bicubic',
    mode: 'free',
  };
  set(next);
  showFloat(ctx, next);
  return true;
}

function update(ctx: ToolCtx, matrix: Matrix): void {
  if (!state) return;
  const next = { ...state, matrix };
  set(next);
  showFloat(ctx, next);
}

export function commitTransform(ctx: ToolCtx): void {
  if (!state) return;
  const t = state;
  set(null);
  ctx.setOverlay({ kind: 'none' });
  putDown(ctx.session, t.lifted, t.matrix, 'Free Transform', t.interpolation);
}

export function cancelTransform(ctx: ToolCtx): void {
  if (!state) return;
  const t = state;
  set(null);
  ctx.setOverlay({ kind: 'none' });
  dropLift(ctx.session, t.lifted);
}

/** The options flyout's typed box: top-left X and Y, W and H (px) and Angle (degrees). */
export function setTransformReadout(
  ctx: ToolCtx,
  r: Partial<{ x: number; y: number; width: number; height: number; angle: number }>,
): void {
  if (!state) return;
  const { raster } = state.lifted;
  const now = boxReadout(boxMatrix(state), raster.width, raster.height);
  const box = boxFromReadout(raster.width, raster.height, { ...now, ...r });
  // `box` maps picture px to photo px; the state's matrix maps photo px: the lift's place undone first.
  update(ctx, chain(translate(-state.lifted.x, -state.lifted.y), box));
}

export function readout(t: TransformState) {
  return boxReadout(boxMatrix(t), t.lifted.raster.width, t.lifted.raster.height);
}

/** Flip the box about its centre. */
export function flipTransform(ctx: ToolCtx, horizontal: boolean): void {
  if (!state) return;
  const { raster } = state.lifted;
  const m = boxMatrix(state);
  // In the picture's own px: mirrored about its middle, then placed as before.
  const flip = chain(
    translate(-raster.width / 2, -raster.height / 2),
    horizontal ? scale(-1, 1) : scale(1, -1),
    translate(raster.width / 2, raster.height / 2),
  );
  update(ctx, chain(translate(-state.lifted.x, -state.lifted.y), flip, m));
}

export function setTransformInterpolation(how: Interpolation): void {
  if (state) set({ ...state, interpolation: how });
}

export function setTransformMode(mode: TransformMode): void {
  if (state) set({ ...state, mode });
}

/** The pointer on the box while a Free Transform is open (it takes every press). */
export function transformHandler(ctx: ToolCtx): ToolHandler {
  let grab: Grab | null = null;
  let from: { x: number; y: number } | null = null;
  let m0: Matrix | null = null;
  return {
    cursor: 'move',
    down(p) {
      if (!state) return false;
      const { raster } = state.lifted;
      m0 = boxMatrix(state);
      grab = grabAt(
        m0,
        raster.width,
        raster.height,
        p,
        HANDLE_REACH_PX / p.scale,
        p.mod,
        state.mode,
      );
      from = { x: p.x, y: p.y };
      return true;
    },
    move(p) {
      if (!state || !grab || !from || !m0) return;
      const { raster } = state.lifted;
      const box = dragBox(m0, raster.width, raster.height, grab, from, p, p);
      update(ctx, chain(translate(-state.lifted.x, -state.lifted.y), box));
    },
    up() {
      grab = null;
      from = null;
      m0 = null;
    },
    key(key) {
      if (!state) return false;
      if (key === 'Enter') commitTransform(ctx);
      else if (key === 'Escape') cancelTransform(ctx);
      else return false;
      return true;
    },
    cancel() {
      cancelTransform(ctx);
    },
  };
}
