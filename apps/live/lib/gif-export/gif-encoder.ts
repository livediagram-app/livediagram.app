// The page's side of the GIF encoder (docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder"):
// one worker per GIF, started when the GIF is made and ended with it. Where a module worker cannot start, the same
// encoder runs on the page.
import type { GifEncodeRequest, GifEncodeResponse } from './gif-encode-protocol';

export type GifEncoderSession = {
  /** Hand a frame over (its buffer is transferred, so the caller must not reuse it). */
  add(rgba: Uint8ClampedArray, delayCs: number): void;
  /** Every frame added: the file. */
  finish(): Promise<{ bytes: Uint8Array; written: number }>;
  /** Stop and discard. */
  cancel(): void;
};

type WorkerLike = {
  postMessage(message: GifEncodeRequest, transfer?: Transferable[]): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<GifEncodeResponse>) => void): void;
  addEventListener(type: 'error', fn: (e: ErrorEvent) => void): void;
  terminate(): void;
};

const newWorker = (): WorkerLike =>
  new Worker(new URL('./gif-encode.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;

export function openGifEncoder(
  width: number,
  height: number,
  createWorker: (() => WorkerLike) | null = typeof Worker === 'undefined' ? null : newWorker,
): GifEncoderSession {
  const worker = startWorker(createWorker);
  return worker ? workerSession(worker, width, height) : inlineSession(width, height);
}

function startWorker(createWorker: (() => WorkerLike) | null): WorkerLike | null {
  try {
    return createWorker?.() ?? null;
  } catch {
    return null;
  }
}

function workerSession(worker: WorkerLike, width: number, height: number): GifEncoderSession {
  let settle: {
    resolve: (v: { bytes: Uint8Array; written: number }) => void;
    reject: (e: Error) => void;
  } | null = null;
  let failure: Error | null = null;
  const fail = (err: Error) => {
    failure = err;
    settle?.reject(err);
    settle = null;
    worker.terminate();
  };
  worker.addEventListener('message', ({ data }) => {
    if (data.type === 'done') {
      settle?.resolve({ bytes: new Uint8Array(data.bytes), written: data.written });
      settle = null;
      worker.terminate();
    } else fail(new Error(data.message));
  });
  worker.addEventListener('error', (e) => fail(new Error(e.message || 'GIF worker failed')));
  worker.postMessage({ type: 'start', width, height });
  return {
    add(rgba, delayCs) {
      if (failure) return;
      const buffer = rgba.buffer as ArrayBuffer;
      worker.postMessage({ type: 'frame', rgba: buffer, delayCs }, [buffer]);
    },
    finish() {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        settle = { resolve, reject };
        worker.postMessage({ type: 'finish' });
      });
    },
    cancel() {
      settle = null;
      worker.terminate();
    },
  };
}

function inlineSession(width: number, height: number): GifEncoderSession {
  const writer = import('./gif-encode-core').then((m) => m.createGifWriter(width, height));
  let queue: Promise<unknown> = writer;
  let cancelled = false;
  return {
    add(rgba, delayCs) {
      queue = queue.then(async () => {
        if (!cancelled) (await writer).add(rgba, delayCs);
      });
    },
    async finish() {
      await queue;
      const w = await writer;
      return { bytes: w.finish(), written: w.written };
    },
    cancel() {
      cancelled = true;
    },
  };
}
