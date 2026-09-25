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
// On a graphics card: whether it has half precision.
let gpuF16 = true;

const gpuOf = () =>
  (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
    }
  ).gpu;

// The engine, picked once for the worker's life (or forced by the page).
let picking: Promise<void> | null = null;
function pick(forced?: ReaderBackend, forcedWhy?: ProcessorReason): Promise<void> {
  picking ??= (async () => {
    if (forced) {
      backendInUse = forced;
      whyProcessor = forced === 'wasm' ? forcedWhy : undefined;
    } else {
      const choice = await pickBackend(gpuOf());
      backendInUse = choice.backend;
      whyProcessor = choice.backend === 'wasm' ? choice.why : undefined;
      gpuF16 = choice.backend === 'webgpu' ? choice.f16 : true;
    }
  })();
  return picking;
}

function load(): Promise<LoadedReader> {
  loading ??= (async () => {
    const detail = backendInUse === 'wasm' ? (whyProcessor ?? 'forced') : gpuF16 ? 'f16' : 'fp32';
    console.info(`[reader] loading on ${backendInUse} (${detail})`);
    return loadReader(
      (download) => scope.postMessage({ type: 'download', download }),
      backendInUse,
      { f16: gpuF16 },
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
    // The engine is said BEFORE the download: the page's pill names it, and
    // its stall watchdog knows which engine stalled.
    await pick(request.backend, request.why);
    scope.postMessage({
      type: 'backend',
      backend: backendInUse,
      ...(backendInUse === 'wasm' && whyProcessor ? { why: whyProcessor } : {}),
    });
    loaded = await load();
  } catch (err) {
    // Let the next read try the download again.
    loading = null;
    console.warn('[reader] the model could not load on %s:', backendInUse, err);
    scope.postMessage({
      type: 'failed',
      id: request.id,
      detail: String(err),
      backend: backendInUse,
    });
    return;
  }
  // Loaded: from here a long silence is a slow note, not a stall.
  scope.postMessage({ type: 'ready' });
  const started = performance.now();
  for (const crop of request.crops) {
    if (cancelled.has(request.id)) break;
    let text = '';
    try {
      text = await readOne(loaded, crop, { floor: true });
    } catch (err) {
      // One crop the model chokes on is one blank note, not a broken read.
      console.warn('[reader] crop %s failed:', crop.id, err);
    }
    scope.postMessage({ type: 'text', id: request.id, cropId: crop.id, text });
  }
  cancelled.delete(request.id);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.info(`[reader] ${request.crops.length} crops on ${loaded.backend} in ${seconds} s`);
  scope.postMessage({ type: 'done', id: request.id });
});
