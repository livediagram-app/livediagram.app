// The page's side of the Import dialog's worker (tracker.worker.ts): a board from another tool read and planned off the
// main thread, each task sent with an id and answered in turn. One worker for the page, made on first use and kept
// (it holds the boards it read, two at most). Where a worker can't start or dies (a blocked worker-src, a chunk gone
// after a deploy), the task runs on the page with the same code (createTrackerRunner), and so does every later one.
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  createTrackerRunner,
  type TrackerRequest,
  type TrackerResponse,
  type TrackerRunner,
  type TrackerTask,
  type TrackerTaskResult,
} from './tracker-tasks';

export type TrackerWorkerLike = {
  postMessage: (message: TrackerRequest) => void;
  addEventListener: {
    (type: 'message', fn: (e: MessageEvent<TrackerResponse>) => void): void;
    (type: 'error', fn: (e: Event) => void): void;
  };
  terminate: () => void;
};

type Pending = { task: TrackerTask; resolve: (r: unknown) => void; reject: (e: Error) => void };

const newWorker = (): TrackerWorkerLike =>
  new Worker(new URL('./tracker.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as TrackerWorkerLike;

export type TrackerTasks = {
  run: <T extends TrackerTask>(task: T) => Promise<TrackerTaskResult<T>>;
};

// A worker made by `make` (none where Workers don't exist), falling back to the page.
export function createTrackerTasks(
  make: (() => TrackerWorkerLike) | null = typeof Worker === 'undefined' ? null : newWorker,
): TrackerTasks {
  let worker: TrackerWorkerLike | null = null;
  let broken = !make;
  let page: TrackerRunner | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  const onPage = (task: TrackerTask): Promise<unknown> => {
    page ??= createTrackerRunner();
    const runner = page;
    // Still a promise, settled after this turn, as the worker's answer is.
    return Promise.resolve().then(() => runner.run(task));
  };

  // The worker failed (to load, or later): what it was given runs on the page. A read comes through; a plan of a
  // board only the worker held fails, and the dialog says the file couldn't be read.
  const fail = (why: string) => {
    if (broken) return;
    broken = true;
    console.warn('[tracker-import] worker failed, reading on the page', { why });
    worker?.terminate();
    worker = null;
    const left = [...pending.values()];
    pending.clear();
    for (const p of left) onPage(p.task).then(p.resolve, p.reject);
  };

  const answer = (res: TrackerResponse) => {
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (res.ok) p.resolve(res.result);
    else p.reject(new Error(res.error));
  };

  const start = (): TrackerWorkerLike | null => {
    if (worker || broken) return worker;
    try {
      const w = make!();
      w.addEventListener('message', (e) => answer(e.data));
      w.addEventListener('error', () => fail('error event'));
      worker = w;
      debugLog('[tracker-import] worker started');
    } catch (err) {
      broken = true;
      console.warn('[tracker-import] worker did not start, reading on the page', {
        error: String(err),
      });
    }
    return worker;
  };

  const run = <T extends TrackerTask>(task: T): Promise<TrackerTaskResult<T>> => {
    const w = start();
    if (!w) return onPage(task) as Promise<TrackerTaskResult<T>>;
    const id = nextId++;
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { task, resolve, reject });
      w.postMessage({ id, task });
    }) as Promise<TrackerTaskResult<T>>;
  };

  return { run };
}

// The page's one set of tasks, made when the Import dialog's flow first reads a file.
let shared: TrackerTasks | null = null;
export const trackerTasks = (): TrackerTasks => (shared ??= createTrackerTasks());
