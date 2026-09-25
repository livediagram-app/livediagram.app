import { loadReader, readOne, type LoadedReader } from './reader-model';
import { pickBackend } from './pick-backend';
import type {
  ProcessorReason,
  ReaderBackend,
  ReaderRequest,
  ReaderResponse,
} from './reader-protocol';

// The in-browser reader's worker (spec/139 Phase 9). The model reads one crop
// at a time — a full generation each, hundreds on a big wall — and on the
// page that took the main thread whole: the review froze mid-reveal and
// nothing moved. Here it can take as long as it takes while the page stays
// the author's.

const scope = self as unknown as {
  postMessage: (message: ReaderResponse) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<ReaderRequest>) => void) => void;
};

let loading: Promise<LoadedReader> | null = null;
const cancelled = new Set<number>();

// Where the model runs, and why when it is the processor (pick-backend.ts).
// Kept for the worker's life: a later read on the same worker says the same.
let backendInUse: ReaderBackend = 'wasm';
let whyProcessor: ProcessorReason | undefined;

const gpuOf = () =>
  (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
    }
  ).gpu;

function load(forced?: ReaderBackend, forcedWhy?: ProcessorReason): Promise<LoadedReader> {
  loading ??= (async () => {
    if (forced) {
      backendInUse = forced;
      whyProcessor = forced === 'wasm' ? forcedWhy : undefined;
    } else {
      const choice = await pickBackend(gpuOf());
      backendInUse = choice.backend;
      whyProcessor = choice.backend === 'wasm' ? choice.why : undefined;
    }
    console.info(`[reader] loading on ${backendInUse}${whyProcessor ? ` (${whyProcessor})` : ''}`);
    return loadReader(
      (download) => scope.postMessage({ type: 'download', download }),
      backendInUse,
    );
  })().then((loaded) => {
    console.info(`[reader] ready on ${loaded.backend}`);
    return loaded;
  });
  return loading;
}

scope.addEventListener('message', async ({ data: request }) => {
  if (request.type === 'cancel') {
    cancelled.add(request.id);
    return;
  }
  let loaded: LoadedReader;
  try {
    loaded = await load(request.backend, request.why);
  } catch (err) {
    // Let the next read try the download again.
    loading = null;
    console.warn(`[reader] the model could not load on ${backendInUse}:`, err);
    scope.postMessage({
      type: 'failed',
      id: request.id,
      detail: String(err),
      backend: backendInUse,
    });
    return;
  }
  scope.postMessage({
    type: 'backend',
    backend: loaded.backend,
    ...(loaded.backend === 'wasm' && whyProcessor ? { why: whyProcessor } : {}),
  });
  const started = performance.now();
  for (const crop of request.crops) {
    if (cancelled.has(request.id)) break;
    let text = '';
    try {
      text = await readOne(loaded, crop, { floor: true });
    } catch (err) {
      // One crop the model chokes on is one blank note, not a broken read.
      console.warn(`[reader] crop ${crop.id} failed:`, err);
    }
    scope.postMessage({ type: 'text', id: request.id, cropId: crop.id, text });
  }
  cancelled.delete(request.id);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.info(`[reader] ${request.crops.length} crops on ${loaded.backend} in ${seconds} s`);
  scope.postMessage({ type: 'done', id: request.id });
});
