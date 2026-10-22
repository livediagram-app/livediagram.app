// A photo editing session for tests: a real PhotoSession over an in-memory pixel store, its commits
// recorded, with the work it sends to the photo worker run inline (no Worker under vitest).
import {
  compositeAll,
  createRaster,
  TiledRaster,
  type Photo,
  type PhotoLayer,
  type PixelLayer,
  type Raster,
} from '@livedesign/photo-engine';
import { PixelsStore } from './pixels-store';
import { PhotoSession } from './session';
import type { PhotoToolState } from './tool-state';
import { DEFAULT_OPTIONS } from './tool-state';
import type { ToolCtx, ToolOverlay } from './tools/tool-context';

export type Harness = {
  s: PhotoSession;
  store: PixelsStore;
  commits: { photo: Photo; label: string; undoable: boolean }[];
  checkpoints: number;
  cancels: number;
  ends: number;
  toasts: string[];
  overlays: ToolOverlay[];
  ctx: ToolCtx;
  state: PhotoToolState;
};

export const pixelLayer = (id: string, extra: Partial<PixelLayer> = {}): PixelLayer => ({
  id,
  name: id,
  layerKind: 'pixel',
  pixels: { tiles: {} },
  ...extra,
});

export function photoOf(
  width: number,
  height: number,
  layers: PhotoLayer[] = [pixelLayer('a')],
): Photo {
  return { width, height, layers };
}

/** A session over `photo`, its layers' pixels set from `pixels` (layer coordinates). */
export function harness(photo: Photo, pixels: Record<string, Raster> = {}): Harness {
  const h: Harness = {
    commits: [],
    checkpoints: 0,
    cancels: 0,
    ends: 0,
    toasts: [],
    overlays: [],
    state: {
      tool: null,
      lastInGroup: {},
      options: structuredClone(DEFAULT_OPTIONS),
      foreground: '#ff0000',
      background: '#0000ff',
    },
  } as unknown as Harness;
  const store = new PixelsStore(
    async () => null,
    1 << 30,
    async () => {},
  );
  h.store = store;
  h.s = new PhotoSession(photo, {
    tabId: 't',
    pageId: 'p',
    store,
    enqueue: () => {},
    commit: (p, label, opts) =>
      h.commits.push({ photo: p, label, undoable: opts?.undoable !== false }),
    checkpoint: () => h.checkpoints++,
    cancelCheckpoint: () => h.cancels++,
    endCheckpoint: () => h.ends++,
  });
  for (const [id, r] of Object.entries(pixels))
    h.s.replacePixels(id, 'layer', TiledRaster.fromRaster(r));
  // The pixels set are where the test starts: none of them waits to be committed.
  for (const id of Object.keys(pixels)) h.s.raster(id).takeDirty();
  h.ctx = {
    session: h.s,
    state: () => h.state,
    toast: (m) => h.toasts.push(m),
    setOverlay: (o) => h.overlays.push(o),
  };
  return h;
}

/** A solid raster. */
export function solid(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Raster {
  const r = createRaster(width, height);
  for (let i = 0; i < r.data.length; i += 4) r.data.set(rgba, i);
  return r;
}

/** The colour of one photo pixel in the composite. */
export function pixel(h: Harness, x: number, y: number): number[] {
  const all = compositeAll(h.s.photo, h.s.lookup());
  const i = (y * all.width + x) * 4;
  return [...all.data.subarray(i, i + 4)];
}

export const lastCommit = (h: Harness) => h.commits.at(-1);

/** A press at a photo point with no keys. */
export const at = (
  x: number,
  y: number,
  keys: Partial<{ shift: boolean; alt: boolean; mod: boolean }> = {},
) => ({
  x,
  y,
  pressure: 0.5,
  shift: false,
  alt: false,
  mod: false,
  scale: 1,
  ...keys,
});
