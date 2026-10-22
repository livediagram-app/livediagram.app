// The photo worker (docs/specs/031-photo/blueprints/photo-engine.md "Web Experience"): runs the photo
// tasks (worker-tasks.ts) off the main thread, each answered by its id, cancelled by its id.
import {
  FilterCancelled,
  runPhotoTask,
  transfersOf,
  type PhotoTask,
  type PhotoTaskResult,
} from './worker-tasks';

type Request = { id: number; task: PhotoTask } | { id: number; cancel: true };
type Response =
  | { id: number; ok: true; result: PhotoTaskResult }
  | { id: number; ok: false; error: string; cancelled?: true }
  | { id: number; progress: number };

const scope = self as unknown as {
  postMessage: (message: Response, transfer?: Transferable[]) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<Request>) => void) => void;
};

const running = new Map<number, AbortController>();

scope.addEventListener('message', ({ data }) => {
  if ('cancel' in data) {
    running.get(data.id)?.abort();
    return;
  }
  const controller = new AbortController();
  running.set(data.id, controller);
  let last = 0;
  runPhotoTask(data.task, controller.signal, (done) => {
    const now = Date.now();
    if (now - last < 100) return;
    last = now;
    scope.postMessage({ id: data.id, progress: done });
  })
    .then((result) => scope.postMessage({ id: data.id, ok: true, result }, transfersOf(result)))
    .catch((err: unknown) =>
      scope.postMessage({
        id: data.id,
        ok: false,
        error: String(err),
        ...(err instanceof FilterCancelled ? { cancelled: true as const } : {}),
      }),
    )
    .finally(() => running.delete(data.id));
});
