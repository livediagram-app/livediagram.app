// A page picture's Blur on the canvas (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur): a blurred
// copy made once per picture and strength, drawn small (a blurred picture has no detail to keep), blurred by three
// box passes per axis with its edges held, and painted by the sheet as any picture is. Never a CSS blur filter, so
// a pan or a zoom never blurs again. The exports draw an SVG feGaussianBlur instead (page-frame.ts).
//
// The copy is made in a worker (page-image-blur.worker.ts, on an OffscreenCanvas), so letting go of a stronger Blur
// on a large picture never holds the main thread. Where the worker cannot run (no OffscreenCanvas, it fails to load,
// or it cannot fetch the picture) the copy is made here as before.
import { BLUR_JPEG_QUALITY, blurCopyPlan, paintBlurredCopy } from './page-image-blur-core';
import type { BlurCopyRequest, BlurCopyResponse } from './page-image-blur-protocol';

export {
  BLUR_COPY_MAX,
  BLUR_COPY_MIN,
  blurCopyPlan,
  boxBlurRgba,
  boxRadiiForSigma,
} from './page-image-blur-core';

// How many copies are kept once no sheet shows them.
export const BLUR_CACHE_SIZE = 8;

type Entry = { url: Promise<string | null>; refs: number };
const cache = new Map<string, Entry>();
let queue: Promise<unknown> = Promise.resolve();

/** What the page needs of a worker (a real one, or a test's). */
export type BlurWorkerLike = {
  postMessage(message: BlurCopyRequest): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<BlurCopyResponse>) => void): void;
  addEventListener(type: 'error', fn: (e: Event) => void): void;
  terminate(): void;
};

const canUseWorker = () =>
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  typeof createImageBitmap !== 'undefined';

const newWorker = (): BlurWorkerLike =>
  new Worker(new URL('./page-image-blur.worker.ts', import.meta.url), { type: 'module' });

// What starts the worker: undefined is the real one where the browser can run it; a test's stand-in, or null for none.
let createWorker: (() => BlurWorkerLike) | null | undefined;
// The one worker, started on the first copy; `false` once it has failed (every copy is then made here).
let worker: BlurWorkerLike | false | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (err: Error) => void }>();

function blurWorker(): BlurWorkerLike | null {
  if (worker !== null) return worker || null;
  const create = createWorker === undefined ? (canUseWorker() ? newWorker : null) : createWorker;
  try {
    worker = create?.() ?? false;
  } catch {
    worker = false;
  }
  if (!worker) return null;
  const live = worker;
  live.addEventListener('message', ({ data }) => {
    const waiting = pending.get(data.id);
    if (!waiting) return;
    pending.delete(data.id);
    if ('blob' in data) waiting.resolve(data.blob);
    else waiting.reject(new Error(data.failed));
  });
  // A worker that fails to load (a blocked worker-src, a chunk gone after a deploy) is given up for the session.
  live.addEventListener('error', () => {
    worker = false;
    live.terminate();
    for (const waiting of pending.values()) waiting.reject(new Error('blur worker failed'));
    pending.clear();
  });
  return live;
}

function copyInWorker(
  w: BlurWorkerLike,
  src: string,
  page: { width: number; height: number },
  sigma: number,
): Promise<Blob> {
  const id = nextId++;
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, src, page: { width: page.width, height: page.height }, sigma });
  });
}

// The copy made on the main thread, as before the worker: the fallback.
async function copyHere(
  src: string,
  page: { width: number; height: number },
  sigma: number,
): Promise<string | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const plan = blurCopyPlan({ width: img.naturalWidth, height: img.naturalHeight }, page, sigma);
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paintBlurredCopy(ctx, img, plan);
  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, 'image/jpeg', BLUR_JPEG_QUALITY),
  );
  return blob ? URL.createObjectURL(blob) : null;
}

async function makeCopy(
  src: string,
  page: { width: number; height: number },
  sigma: number,
): Promise<string | null> {
  const w = blurWorker();
  if (w) {
    try {
      return URL.createObjectURL(await copyInWorker(w, src, page, sigma));
    } catch {
      // The worker could not fetch or read the picture: the page tries, as it always has.
    }
  }
  return copyHere(src, page, sigma);
}

const keyOf = (src: string, page: { width: number; height: number }, sigma: number) =>
  `${Math.round(page.width)}x${Math.round(page.height)}|${Math.round(sigma * 10) / 10}|${src}`;

function evict(): void {
  if (cache.size <= BLUR_CACHE_SIZE) return;
  for (const [key, entry] of cache) {
    if (cache.size <= BLUR_CACHE_SIZE) break;
    if (entry.refs > 0) continue;
    cache.delete(key);
    void entry.url.then((u) => u && URL.revokeObjectURL(u));
  }
}

/**
 * A blurred copy of a picture for a page, as a blob URL (null when it cannot be made: a picture whose pixels the
 * browser will not hand over). Held until `release`; one copy is made at a time.
 */
export function acquireBlurredImage(
  src: string,
  page: { width: number; height: number },
  sigma: number,
): { url: Promise<string | null>; release: () => void } {
  const key = keyOf(src, page, sigma);
  let entry = cache.get(key);
  if (!entry) {
    const url = queue.then(() => makeCopy(src, page, sigma)).catch(() => null);
    queue = url;
    entry = { url, refs: 0 };
    cache.set(key, entry);
  } else {
    // Most recently used last, so eviction takes the oldest first.
    cache.delete(key);
    cache.set(key, entry);
  }
  entry.refs++;
  const held = entry;
  let released = false;
  return {
    url: held.url,
    release: () => {
      if (released) return;
      released = true;
      held.refs--;
      evict();
    },
  };
}

/** Forgets every copy and the worker (tests); `create` stands in for the worker from then on (null: none, left out:
 *  the real one). */
export function clearBlurCache(create?: (() => BlurWorkerLike) | null): void {
  for (const entry of cache.values()) void entry.url.then((u) => u && URL.revokeObjectURL(u));
  cache.clear();
  if (worker) worker.terminate();
  worker = null;
  pending.clear();
  queue = Promise.resolve();
  createWorker = create;
}
