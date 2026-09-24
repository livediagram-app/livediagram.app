import { loadReader, readOne, type LoadedReader } from './reader-model';
import type { ReaderBackend, ReaderRequest, ReaderResponse } from './reader-protocol';

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

// The graphics card only when it can run the half-precision weights the
// WebGPU path asks for; the adapter reports a GPU either way, so ask for the
// feature. Everything else reads on the processor.
async function pickBackend(): Promise<ReaderBackend> {
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
    }
  ).gpu;
  if (!gpu) return 'wasm';
  try {
    const adapter = await gpu.requestAdapter();
    return adapter?.features.has('shader-f16') ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

let backendInUse: ReaderBackend = 'wasm';

function load(forced?: ReaderBackend): Promise<LoadedReader> {
  loading ??= (async () => {
    backendInUse = forced ?? (await pickBackend());
    console.info(`[reader] loading on ${backendInUse}`);
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
    loaded = await load(request.backend);
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
  scope.postMessage({ type: 'backend', backend: loaded.backend });
  const started = performance.now();
  for (const crop of request.crops) {
    if (cancelled.has(request.id)) break;
    let text = '';
    try {
      text = await readOne(loaded, crop);
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
