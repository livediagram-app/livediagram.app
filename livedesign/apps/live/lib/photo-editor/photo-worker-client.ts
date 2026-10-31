// The page's side of the photo worker: tasks sent with an id, answered in any order, cancellable,
// with progress. A pool of workers (half the cores, at most four) so a tile's encode never waits on a
// filter. Where a worker cannot start, the task runs on the page (runPhotoTask), the same answer.
import { FilterCancelled } from '@livedesign/photo-engine';
import { runPhotoTask, transfersOf, type PhotoTask, type PhotoTaskResult } from './worker-tasks';

type Pending = {
  resolve: (r: PhotoTaskResult) => void;
  reject: (e: Error) => void;
  progress?: (done: number) => void;
};

type WorkerLike = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void;
  addEventListener(type: 'error', fn: (e: Event) => void): void;
  terminate(): void;
};

const newWorker = (): WorkerLike =>
  new Worker(new URL('./photo.worker.ts', import.meta.url), { type: 'module' });

export type PhotoTaskHandle = { result: Promise<PhotoTaskResult>; cancel: () => void };

export class PhotoWorkers {
  // `answered`: the worker has loaded and replied once. Until then its tasks go as copies, so a worker
  // that never loads (offline, a chunk gone after a deploy) leaves the page the buffers to run them with.
  private readonly workers: { w: WorkerLike; busy: number; answered: boolean }[] = [];
  private readonly pending = new Map<number, Pending & { worker: WorkerLike }>();
  private next = 1;
  private broken = false;
  private readonly create: (() => WorkerLike) | null;
  private readonly size: number;

  constructor(
    create: (() => WorkerLike) | null = typeof Worker === 'undefined' ? null : newWorker,
    size = Math.max(
      1,
      Math.min(4, Math.floor((globalThis.navigator?.hardwareConcurrency ?? 2) / 2)),
    ),
  ) {
    this.create = create;
    this.size = size;
  }

  private worker(): WorkerLike | null {
    if (this.broken || !this.create) return null;
    if (this.workers.length < this.size) {
      try {
        const w = this.create();
        w.addEventListener('message', (e) => this.answer(e.data as Record<string, unknown>));
        w.addEventListener('error', () => this.fail(w));
        this.workers.push({ w, busy: 0, answered: false });
      } catch {
        this.broken = true;
        return null;
      }
    }
    const least = this.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
    least.busy++;
    return least.w;
  }

  private release(w: WorkerLike): void {
    const slot = this.workers.find((s) => s.w === w);
    if (slot) slot.busy = Math.max(0, slot.busy - 1);
  }

  private fail(w: WorkerLike): void {
    // A worker that failed to load (a blocked worker-src, a chunk gone after a deploy): its tasks run
    // on the page, and no further worker is tried.
    this.broken = true;
    for (const [id, p] of this.pending) {
      if (p.worker !== w) continue;
      this.pending.delete(id);
      p.reject(new Error('photo worker failed'));
    }
  }

  private answer(data: Record<string, unknown>): void {
    const id = data.id as number;
    const p = this.pending.get(id);
    if (!p) return;
    if ('progress' in data) {
      p.progress?.(data.progress as number);
      return;
    }
    const slot = this.workers.find((s) => s.w === p.worker);
    if (slot) slot.answered = true;
    this.pending.delete(id);
    this.release(p.worker);
    if (data.ok) p.resolve(data.result as PhotoTaskResult);
    else p.reject(data.cancelled ? new FilterCancelled() : new Error(String(data.error)));
  }

  /** A task run off the main thread where it can be. Its input buffers are moved, not copied, once the worker has answered. */
  run(task: PhotoTask, progress?: (done: number) => void): PhotoTaskHandle {
    const w = this.worker();
    if (!w) {
      const controller = new AbortController();
      return {
        result: runPhotoTask(task, controller.signal, progress),
        cancel: () => controller.abort(),
      };
    }
    const id = this.next++;
    const result = new Promise<PhotoTaskResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, progress, worker: w });
    }).catch(async (err: unknown) => {
      // A worker that died: the page does the task.
      if (err instanceof Error && err.message === 'photo worker failed')
        return runPhotoTask(task, undefined, progress);
      throw err;
    });
    const answered = this.workers.find((s) => s.w === w)?.answered ?? false;
    w.postMessage({ id, task }, answered ? transfersOf(task) : []);
    return { result, cancel: () => w.postMessage({ id, cancel: true }) };
  }

  dispose(): void {
    for (const s of this.workers) s.w.terminate();
    this.workers.length = 0;
  }
}

let shared: PhotoWorkers | null = null;
export function photoWorkers(): PhotoWorkers {
  shared ??= new PhotoWorkers();
  return shared;
}
