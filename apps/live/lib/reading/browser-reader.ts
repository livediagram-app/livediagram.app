import type { NoteCrop } from '@livediagram/api-schema';
import { toRead } from './answer';
import type {
  ProcessorReason,
  ReaderBackend,
  ReaderRequest,
  ReaderResponse,
} from './reader-protocol';
import type { ReadOptions, ReadText } from './types';

// Reading the handwriting with a model that runs HERE, in this browser
// (docs/specs/021-event-storming/event-storming.md Phase 9) — the reader a deployment with no model key gets, which
// is why the photo import needs no key at all. See reader-model.ts for the
// model and why it is this one.
//
// The model runs in a WORKER (reader.worker.ts); this is the page's side: it
// posts the crops and listens. On the page the model took the main thread
// whole — the review's reveal froze mid-way and nothing moved while a wall of
// hundreds of notes was read. Each note's words are handed on AS THEY ARE
// READ, so the photo fills in note by note instead of all at once at the end.

type ReaderWorker = {
  postMessage: (request: ReaderRequest) => void;
  terminate?: () => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<ReaderResponse>) => void) => void;
  removeEventListener: (type: 'message', fn: (e: MessageEvent<ReaderResponse>) => void) => void;
};

// One worker for the page, created on first use and kept: it holds the model.
// Keyed by the factory that made it, so a caller with its own factory (a
// test) never inherits another's worker.
let shared: ReaderWorker | null = null;
let sharedBy: (() => ReaderWorker) | null = null;
let nextId = 1;

const newWorker = (): ReaderWorker =>
  new Worker(new URL('./reader.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as ReaderWorker;

// A model download that sits still this long has stalled (a blocked or
// throttled CDN, a full disk): better told than waited on for ever.
const STALL_MS = 60_000;

export type BrowserRead = {
  textById: Map<number, ReadText>;
  failure?: 'reader_unavailable';
  detail?: string;
};

// Read on whatever engine the worker picks; when the model will not start on
// the graphics card, ask a FRESH worker to read on the processor. Never the
// same worker: switching engines in one left the runtime half on each, and
// the reader stalled mid-download or crashed. When neither starts, say so.
export async function readCropsInBrowser(
  crops: NoteCrop[],
  opts: ReadOptions = {},
  make: () => ReaderWorker = newWorker,
): Promise<BrowserRead> {
  if (sharedBy !== make) {
    shared?.terminate?.();
    shared = null;
  }
  sharedBy = make;
  shared ??= make();
  let result = await readCropsWith(shared, crops, opts);
  if (result.failedBackend === 'webgpu') {
    console.warn(
      `[reader] the graphics card could not start the model (${result.detail}); reading on the processor`,
    );
    shared.terminate?.();
    shared = make();
    result = await readCropsWith(shared, crops, { ...opts, backend: 'wasm', why: 'gpu-failed' });
  }
  if (result.failedBackend) {
    console.warn(`[reader] the reading model could not start: ${result.detail}`);
    shared.terminate?.();
    shared = null;
    // The paper was still found: every note lands blank for the author to
    // type, rather than the whole import failing. Said only now, after any
    // retry, so the review never calls the notes read while one is running.
    for (const c of crops) {
      if (!result.textById.has(c.id)) result.textById.set(c.id, { text: '', legible: false });
    }
    opts.onProgress?.(crops.length);
    opts.onModelDownload?.({ loaded: 0, total: 0, done: true });
    return { textById: result.textById, failure: 'reader_unavailable', detail: result.detail };
  }
  return { textById: result.textById };
}

type Attempt = { textById: Map<number, ReadText>; failedBackend?: ReaderBackend; detail?: string };

export function readCropsWith(
  worker: ReaderWorker,
  crops: NoteCrop[],
  opts: ReadOptions & { backend?: ReaderBackend; why?: ProcessorReason } = {},
): Promise<Attempt> {
  const out = new Map<number, ReadText>();
  if (crops.length === 0) return Promise.resolve({ textById: out });
  const id = nextId++;
  const stallMs = opts.stallMs ?? STALL_MS;

  return new Promise((resolve) => {
    let stall: ReturnType<typeof setTimeout> | undefined;
    const settle = (attempt: Omit<Attempt, 'textById'> = {}) => {
      clearTimeout(stall);
      worker.removeEventListener('message', listen);
      opts.signal?.removeEventListener('abort', cancel);
      resolve({ textById: out, ...attempt });
    };
    const finish = () => settle();
    // The engine the worker picked, and whether the model has loaded.
    let picked: ReaderBackend | undefined = opts.backend;
    let ready = false;
    // WHILE THE MODEL LOADS, any word from the worker is life and silence for
    // `stallMs` is a stall. Once it has loaded, silence is a slow note (a
    // phone, a busy machine) and is waited out; the author can still cancel.
    const watch = () => {
      clearTimeout(stall);
      if (ready) return;
      stall = setTimeout(
        () =>
          settle({
            failedBackend: picked ?? 'webgpu',
            detail: `the model download stalled (no progress for ${Math.round(stallMs / 1000)} s)`,
          }),
        stallMs,
      );
    };
    const cancel = () => worker.postMessage({ type: 'cancel', id });
    const listen = ({ data: message }: MessageEvent<ReaderResponse>) => {
      watch();
      if (message.type === 'download') {
        opts.onModelDownload?.(message.download);
      } else if (message.type === 'backend') {
        picked = message.backend;
        opts.onBackend?.(message.backend, message.why);
      } else if (message.type === 'ready') {
        ready = true;
        clearTimeout(stall);
      } else if (message.id !== id) {
        return;
      } else if (message.type === 'text') {
        const read = toRead(message.text);
        out.set(message.cropId, read);
        opts.onText?.(message.cropId, read);
        opts.onProgress?.(out.size);
      } else if (message.type === 'failed') {
        // The weights could not be fetched or would not start (offline, a
        // blocked CDN, no storage, an engine this browser cannot run).
        settle({ failedBackend: message.backend, detail: message.detail });
      } else if (message.type === 'done') {
        finish();
      }
    };
    worker.addEventListener('message', listen);
    opts.signal?.addEventListener('abort', cancel, { once: true });
    watch();
    worker.postMessage({
      type: 'read',
      id,
      crops,
      ...(opts.backend ? { backend: opts.backend } : {}),
      ...(opts.why ? { why: opts.why } : {}),
    });
  });
}
