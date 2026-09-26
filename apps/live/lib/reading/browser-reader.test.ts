import { describe, expect, it, vi } from 'vitest';
import { readCropsInBrowser, readCropsWith } from './browser-reader';
import type { ReaderRequest, ReaderResponse } from './reader-protocol';

// The in-browser reader runs its model in a WORKER (spec/139 Phase 9): on the
// page it took the main thread whole — the review's reveal froze and nothing
// moved while a wall was read. The page only posts crops and listens.

// A worker that answers as the real one does, scripted per test.
function fakeWorker(script: (req: ReaderRequest, reply: (r: ReaderResponse) => void) => void) {
  const listeners = new Set<(e: MessageEvent<ReaderResponse>) => void>();
  const posted: ReaderRequest[] = [];
  const worker = {
    posted,
    postMessage(req: ReaderRequest) {
      posted.push(req);
      queueMicrotask(() =>
        script(req, (r) => {
          for (const l of listeners) l({ data: r } as MessageEvent<ReaderResponse>);
        }),
      );
    },
    addEventListener(_: 'message', l: (e: MessageEvent<ReaderResponse>) => void) {
      listeners.add(l);
    },
    removeEventListener(_: 'message', l: (e: MessageEvent<ReaderResponse>) => void) {
      listeners.delete(l);
    },
  };
  return worker;
}

const crops = [
  { id: 0, image: 'data:image/jpeg;base64,AAA' },
  { id: 1, image: 'data:image/jpeg;base64,BBB' },
];

describe('reading crops through the worker', () => {
  it('streams each note as it is read, and counts them', async () => {
    const worker = fakeWorker((req, reply) => {
      if (req.type !== 'read') return;
      reply({ type: 'backend', backend: 'webgpu' });
      reply({ type: 'text', id: req.id, cropId: 0, text: 'Order placed' });
      reply({ type: 'text', id: req.id, cropId: 1, text: 'no writing' });
      reply({ type: 'done', id: req.id });
    });
    const onText = vi.fn();
    const onProgress = vi.fn();
    const onBackend = vi.fn();
    const { textById: out } = await readCropsWith(worker, crops, { onText, onProgress, onBackend });
    expect(out.get(0)).toEqual({ text: 'Order placed', legible: true });
    // The model's "no writing" is a blank note, not two words.
    expect(out.get(1)).toEqual({ text: '', legible: false });
    expect(onText).toHaveBeenCalledWith(0, { text: 'Order placed', legible: true });
    expect(onProgress).toHaveBeenLastCalledWith(2);
    expect(onBackend).toHaveBeenCalledWith('webgpu', undefined);
  });

  it('passes the model download on to the review', async () => {
    const worker = fakeWorker((req, reply) => {
      if (req.type !== 'read') return;
      reply({ type: 'download', download: { loaded: 5, total: 10, done: false } });
      reply({ type: 'done', id: req.id });
    });
    const onModelDownload = vi.fn();
    await readCropsWith(worker, crops, { onModelDownload });
    expect(onModelDownload).toHaveBeenCalledWith({ loaded: 5, total: 10, done: false });
  });

  it('lands every note blank when the model cannot load, rather than failing the import', async () => {
    const make = () =>
      fakeWorker((req, reply) => {
        if (req.type === 'read')
          reply({ type: 'failed', id: req.id, detail: 'blocked CDN', backend: 'wasm' });
      });
    const { textById: out } = await readCropsInBrowser(crops, {}, make);
    expect([...out.values()]).toEqual([
      { text: '', legible: false },
      { text: '', legible: false },
    ]);
  });

  it('tells the worker to stop when the author leaves the review', async () => {
    const controller = new AbortController();
    const worker = fakeWorker((req, reply) => {
      if (req.type === 'read') {
        reply({ type: 'text', id: req.id, cropId: 0, text: 'Order placed' });
        controller.abort();
      }
      if (req.type === 'cancel') reply({ type: 'done', id: req.id });
    });
    await readCropsWith(worker, crops, { signal: controller.signal });
    expect(worker.posted.map((r) => r.type)).toEqual(['read', 'cancel']);
  });
});

// When the model will not start on the graphics card, a FRESH worker is asked
// to read on the processor — never the same one: switching engines in one
// worker left the runtime half on each, and the reader stalled or crashed.
describe('when the model will not start', () => {
  it('retries once on the processor, in a new worker', async () => {
    const made: ReturnType<typeof fakeWorker>[] = [];
    const make = () => {
      const w = fakeWorker((req, reply) => {
        if (req.type !== 'read') return;
        if (req.backend !== 'wasm') {
          reply({ type: 'failed', id: req.id, detail: 'webgpu: no fp16', backend: 'webgpu' });
          return;
        }
        reply({ type: 'backend', backend: 'wasm', why: req.why });
        reply({ type: 'text', id: req.id, cropId: 0, text: 'Order placed' });
        reply({ type: 'text', id: req.id, cropId: 1, text: 'Paid' });
        reply({ type: 'done', id: req.id });
      });
      made.push(w);
      return w;
    };
    const onBackend = vi.fn();
    const result = await readCropsInBrowser(crops, { onBackend }, make);
    expect(made).toHaveLength(2);
    expect(onBackend).toHaveBeenCalledWith('wasm', 'gpu-failed');
    // The fresh worker is told WHY it reads on the processor, so it can say so.
    expect(made[1]!.posted[0]).toMatchObject({ type: 'read', backend: 'wasm', why: 'gpu-failed' });
    expect(result.textById.get(0)).toEqual({ text: 'Order placed', legible: true });
    expect(result.failure).toBeUndefined();
  });

  it('says so — with the reason — when the processor cannot either', async () => {
    const make = () =>
      fakeWorker((req, reply) => {
        if (req.type === 'read')
          reply({
            type: 'failed',
            id: req.id,
            detail: 'NetworkError',
            backend: req.backend ?? 'webgpu',
          });
      });
    const result = await readCropsInBrowser(crops, {}, make);
    expect(result.failure).toBe('reader_unavailable');
    expect(result.detail).toMatch(/NetworkError/);
    expect([...result.textById.values()].every((r) => !r.legible)).toBe(true);
  });

  it('calls a download that stops moving stalled, instead of waiting for ever', async () => {
    vi.useFakeTimers();
    try {
      const make = () =>
        fakeWorker((req, reply) => {
          if (req.type !== 'read') return;
          reply({ type: 'backend', backend: req.backend ?? 'webgpu' });
          reply({ type: 'download', download: { loaded: 231, total: 252, done: false } });
          // …and then nothing more, ever.
        });
      const done = readCropsInBrowser(crops, { stallMs: 60_000 }, make);
      await vi.advanceTimersByTimeAsync(61_000);
      // The processor retry stalls the same way.
      await vi.advanceTimersByTimeAsync(61_000);
      const result = await done;
      expect(result.failure).toBe('reader_unavailable');
      expect(result.detail).toMatch(/stalled/i);
    } finally {
      vi.useRealTimers();
    }
  });
});

// The watchdog is for the DOWNLOAD. Once the model is loaded, a slow note is
// a slow machine (a phone, a busy laptop), not a stall.
describe('a slow reading is not a stall', () => {
  it('waits as long as a note takes once the model is ready', async () => {
    vi.useFakeTimers();
    try {
      const make = () =>
        fakeWorker((req, reply) => {
          if (req.type !== 'read') return;
          reply({ type: 'backend', backend: 'wasm', why: 'no-adapter' });
          reply({ type: 'ready' });
          setTimeout(() => {
            reply({ type: 'text', id: req.id, cropId: 0, text: 'Order placed' });
            reply({ type: 'text', id: req.id, cropId: 1, text: 'Paid' });
            reply({ type: 'done', id: req.id });
          }, 300_000);
        });
      const done = readCropsInBrowser(crops, { stallMs: 60_000 }, make);
      await vi.advanceTimersByTimeAsync(301_000);
      const result = await done;
      expect(result.failure).toBeUndefined();
      expect(result.textById.get(1)).toEqual({ text: 'Paid', legible: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry on the processor a download that stalled ON the processor', async () => {
    vi.useFakeTimers();
    try {
      const made: ReturnType<typeof fakeWorker>[] = [];
      const make = () => {
        const w = fakeWorker((req, reply) => {
          if (req.type !== 'read') return;
          reply({ type: 'backend', backend: 'wasm', why: 'no-adapter' });
          reply({ type: 'download', download: { loaded: 5, total: 250, done: false } });
        });
        made.push(w);
        return w;
      };
      const onProgress = vi.fn();
      const done = readCropsInBrowser(crops, { stallMs: 60_000, onProgress }, make);
      await vi.advanceTimersByTimeAsync(61_000);
      const result = await done;
      expect(made).toHaveLength(1);
      expect(result.failure).toBe('reader_unavailable');
      expect(onProgress).toHaveBeenLastCalledWith(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not call the notes read before the processor retry has read them', async () => {
    const progress: number[] = [];
    const make = (() => {
      let n = 0;
      return () =>
        fakeWorker((req, reply) => {
          if (req.type !== 'read') return;
          n += 1;
          if (n === 1) {
            reply({ type: 'backend', backend: 'webgpu' });
            reply({ type: 'failed', id: req.id, detail: 'no fp16', backend: 'webgpu' });
            return;
          }
          reply({ type: 'backend', backend: 'wasm', why: req.why });
          reply({ type: 'ready' });
          reply({ type: 'text', id: req.id, cropId: 0, text: 'Order placed' });
          reply({ type: 'text', id: req.id, cropId: 1, text: 'Paid' });
          reply({ type: 'done', id: req.id });
        });
    })();
    await readCropsInBrowser(crops, { onProgress: (n) => progress.push(n) }, make);
    expect(progress).toEqual([1, 2]);
  });
});
