// The page's side of the GIF encoder (docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder"):
// one worker per GIF, started when the GIF is made and ended with it. Where a module worker cannot start (it throws,
// or fails to load before saying it has started), the same encoder runs on the page.
import type { GifPalette } from 'gifenc';
import type { GifEncodeRequest, GifEncodeResponse } from './gif-encode-protocol';

export type GifEncoderSession = {
  /** A page's palette from sample frames across its hold, kept under `key` (the buffers are transferred). */
  palette: (key: number, samples: Uint8ClampedArray[]) => void;
  /** Hand a frame over (its buffer is transferred, so the caller must not reuse it), in the palette under `palette`
   *  (its own when absent). */
  add: (rgba: Uint8ClampedArray, delayCs: number, palette?: number) => void;
  /** Every frame added: the file. */
  finish: () => Promise<{ bytes: Uint8Array; written: number }>;
  /** Stop and discard. */
  cancel: () => void;
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
  });

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

// A worker session holds what it is given until the worker says it has started: a module worker that fails to load
// (a blocked worker-src, a chunk gone after a deploy) reports it only as a later error event, and then everything goes
// to the on-page encoder instead, so the GIF is still made. After it has started, a failure ends the session: the next
// palette or frame throws, so the caller stops drawing frames at once rather than at finish().
type Held =
  | { kind: 'palette'; key: number; samples: Uint8ClampedArray[] }
  | { kind: 'frame'; rgba: Uint8ClampedArray; delayCs: number; palette?: number };

function workerSession(worker: WorkerLike, width: number, height: number): GifEncoderSession {
  let state: 'starting' | 'ready' | 'inline' | 'ended' = 'starting';
  const held: Held[] = [];
  let inline: GifEncoderSession | null = null;
  let failure: Error | null = null;
  let settle: {
    resolve: (v: { bytes: Uint8Array; written: number }) => void;
    reject: (e: Error) => void;
  } | null = null;

  const send = (item: Held) => {
    if (item.kind === 'palette') {
      const buffers = item.samples.map((s) => s.buffer as ArrayBuffer);
      worker.postMessage({ type: 'palette', key: item.key, samples: buffers }, buffers);
    } else {
      const buffer = item.rgba.buffer as ArrayBuffer;
      worker.postMessage(
        { type: 'frame', rgba: buffer, delayCs: item.delayCs, palette: item.palette },
        [buffer],
      );
    }
  };
  const handTo = (to: GifEncoderSession, item: Held) =>
    item.kind === 'palette'
      ? to.palette(item.key, item.samples)
      : to.add(item.rgba, item.delayCs, item.palette);
  const onPage = () => {
    state = 'inline';
    worker.terminate();
    inline = inlineSession(width, height);
    for (const item of held.splice(0)) handTo(inline, item);
    if (settle) {
      const pending = settle;
      settle = null;
      inline.finish().then(pending.resolve, pending.reject);
    }
  };
  const fail = (err: Error) => {
    if (state === 'starting') return onPage();
    if (state !== 'ready') return;
    state = 'ended';
    failure = err;
    settle?.reject(err);
    settle = null;
    worker.terminate();
  };
  worker.addEventListener('message', ({ data }) => {
    if (data.type === 'ready') {
      if (state !== 'starting') return;
      state = 'ready';
      for (const item of held.splice(0)) send(item);
      if (settle) worker.postMessage({ type: 'finish' });
    } else if (data.type === 'done') {
      settle?.resolve({ bytes: new Uint8Array(data.bytes), written: data.written });
      settle = null;
      state = 'ended';
      worker.terminate();
    } else fail(new Error(data.message));
  });
  worker.addEventListener('error', (e) => fail(new Error(e.message || 'GIF worker failed')));
  worker.postMessage({ type: 'start', width, height });
  const take = (item: Held) => {
    if (failure) throw failure;
    if (inline) handTo(inline, item);
    else if (state === 'starting') held.push(item);
    else if (state === 'ready') send(item);
  };
  return {
    palette(key, samples) {
      take({ kind: 'palette', key, samples });
    },
    add(rgba, delayCs, palette) {
      take({ kind: 'frame', rgba, delayCs, palette });
    },
    finish() {
      if (failure) return Promise.reject(failure);
      if (inline) return inline.finish();
      return new Promise((resolve, reject) => {
        settle = { resolve, reject };
        if (state === 'ready') worker.postMessage({ type: 'finish' });
      });
    },
    cancel() {
      settle = null;
      held.length = 0;
      state = 'ended';
      worker.terminate();
      inline?.cancel();
    },
  };
}

function inlineSession(width: number, height: number): GifEncoderSession {
  const core = import('./gif-encode-core');
  const writer = core.then((m) => m.createGifWriter(width, height));
  const palettes = new Map<number, GifPalette>();
  let queue: Promise<unknown> = writer;
  let cancelled = false;
  return {
    palette(key, samples) {
      queue = queue.then(async () => {
        if (!cancelled) palettes.set(key, (await core).pagePalette(samples));
      });
    },
    add(rgba, delayCs, palette) {
      queue = queue.then(async () => {
        if (!cancelled)
          (await writer).add(
            rgba,
            delayCs,
            palette === undefined ? undefined : palettes.get(palette),
          );
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
