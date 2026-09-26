import { CUE_OPTIONS, cuesOf } from '@livediagram/sticky-model';
import type { WorkerRequest, WorkerResponse } from './protocol';
import { BoundaryRuntimeError, loadBoundaryRuntime, type BoundaryRuntime } from './runtime';

// The boundary model's worker (docs/specs/021-event-storming/event-storming.md Phase 9): loads the runtime once, then
// turns each working image into the cues the classical detector's hybrid rules
// read. Only plain numbers go back to the page.

const scope = self as unknown as {
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void) => void;
};

let runtime: Promise<BoundaryRuntime> | null = null;

function load(): Promise<BoundaryRuntime> {
  runtime ??= loadBoundaryRuntime().then((r) => {
    console.info(`[photo-model] ready on ${r.backend}`);
    scope.postMessage({ type: 'ready', backend: r.backend });
    return r;
  });
  return runtime;
}

function fail(id: number | null, err: unknown) {
  const reason = err instanceof BoundaryRuntimeError ? err.reason : 'inference-failed';
  scope.postMessage({ type: 'failed', id, reason, detail: String(err) });
}

scope.addEventListener('message', async ({ data: request }) => {
  let ready: BoundaryRuntime;
  try {
    ready = await load();
  } catch (err) {
    // Loading failed: every request, now and later, is told once, by id null.
    fail(null, err);
    return;
  }
  if (request.type === 'warm') return;
  try {
    const started = performance.now();
    const probs = await ready.predict(request.data, request.width, request.height);
    const cues = cuesOf(probs, request.width, request.height, CUE_OPTIONS);
    const ms = Math.round(performance.now() - started);
    console.info(`[photo-model] ${cues.notes.length} notes on ${ready.backend} in ${ms} ms`);
    scope.postMessage({ type: 'cues', id: request.id, backend: ready.backend, cues, ms }, [
      cues.background.buffer,
    ]);
  } catch (err) {
    fail(request.id, err);
  }
});
