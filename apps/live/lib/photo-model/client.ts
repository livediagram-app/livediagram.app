import type { BoundaryFailure, BoundaryOutcome, WorkerRequest, WorkerResponse } from './protocol';

// The page's side of the boundary model (spec/139 Phase 9).
//
// The model runs in a Web Worker so its second of WASM on a slow machine never
// freezes the review, and its runtime (TensorFlow.js, a backend, the weights)
// is fetched only by that worker: nothing of it is in the editor's own chunks.
// One worker per page, started on the first ask and kept, so a second import
// pays nothing to load.
//
// The model is a correction, never a gate: every way it can fail resolves to a
// reason (never a rejection) and the caller runs the classical detector alone.
// A runtime that could not load stays failed for the page's life rather than
// being fetched again on every photo.

// J4 measured a cold single-thread WASM run (load, compile, predict) under a
// second on a desktop CPU; eight times that covers a slow laptop, and the
// warm-up on opening the picker usually has the runtime loaded before a photo
// is chosen. Past it the author is waiting on a correction, not a result.
export const BOUNDARY_TIMEOUT_MS = 8000;

type WorkingImage = { width: number; height: number; data: Uint8ClampedArray };

type Pending = (outcome: BoundaryOutcome) => void;

export type BoundaryClient = {
  // Start the worker loading its runtime, so it is ready when a photo comes.
  warm: () => void;
  cuesFor: (image: WorkingImage, opts?: { timeoutMs?: number }) => Promise<BoundaryOutcome>;
};

export function createBoundaryClient(createWorker: () => Worker): BoundaryClient {
  let worker: Worker | null = null;
  let failed: BoundaryFailure | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  const failAll = (reason: BoundaryFailure) => {
    failed = reason;
    for (const settle of pending.values()) settle({ ok: false, reason });
    pending.clear();
  };

  const onMessage = (message: WorkerResponse) => {
    if (message.type === 'ready') return;
    if (message.type === 'failed') {
      console.warn(
        `[photo-model] ${message.reason}; the classical detector runs alone`,
        message.detail,
      );
      if (message.id === null) return failAll(message.reason);
      pending.get(message.id)?.({ ok: false, reason: message.reason });
      pending.delete(message.id);
      return;
    }
    pending.get(message.id)?.({ ok: true, backend: message.backend, cues: message.cues });
    pending.delete(message.id);
  };

  const ensure = (): Worker | null => {
    if (worker || failed) return worker;
    try {
      worker = createWorker();
    } catch (err) {
      console.warn('[photo-model] no-worker; the classical detector runs alone', String(err));
      failed = 'no-worker';
      return null;
    }
    worker.addEventListener('message', (e) => onMessage((e as MessageEvent<WorkerResponse>).data));
    worker.addEventListener('error', (e) => {
      console.warn('[photo-model] load-failed; the worker crashed', (e as ErrorEvent).message);
      failAll('load-failed');
    });
    return worker;
  };

  const post = (w: Worker, request: WorkerRequest, transfer: Transferable[] = []) =>
    w.postMessage(request, transfer);

  return {
    warm() {
      if (worker || failed) return;
      const w = ensure();
      if (w) post(w, { type: 'warm' });
    },
    cuesFor(image, opts = {}) {
      const w = ensure();
      if (!w || failed) return Promise.resolve({ ok: false, reason: failed ?? 'no-worker' });
      const id = nextId++;
      const timeoutMs = opts.timeoutMs ?? BOUNDARY_TIMEOUT_MS;
      return new Promise<BoundaryOutcome>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          console.warn(
            `[photo-model] timeout after ${timeoutMs} ms; the classical detector runs alone`,
          );
          resolve({ ok: false, reason: 'timeout' });
        }, timeoutMs);
        pending.set(id, (outcome) => {
          clearTimeout(timer);
          resolve(outcome);
        });
        // A copy, handed over rather than cloned again: the page keeps its own
        // pixels for the classical pass.
        const data = image.data.slice();
        post(w, { type: 'cues', id, width: image.width, height: image.height, data }, [
          data.buffer,
        ]);
      });
    },
  };
}

// The page's one client. The worker is its own chunk: the bundler follows this
// `new URL` to it, and nothing of TensorFlow.js is reachable from anywhere else.
const shared = createBoundaryClient(
  () => new Worker(new URL('./boundary.worker.ts', import.meta.url), { type: 'module' }),
);

export const warmBoundaryModel = (): void => shared.warm();
export const boundaryCuesFor: BoundaryClient['cuesFor'] = (image, opts) =>
  shared.cuesFor(image, opts);
