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
    expect(onBackend).toHaveBeenCalledWith('webgpu');
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
    const worker = fakeWorker((req, reply) => {
      if (req.type === 'read')
        reply({ type: 'failed', id: req.id, detail: 'blocked CDN', backend: 'wasm' });
    });
    const { textById: out } = await readCropsWith(worker, crops, {});
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
        reply({ type: 'backend', backend: 'wasm' });
        reply({ type: 'text', id: req.id, cropId: 0, text: 'Order placed' });
        reply({ type: 'text', id: req.id, cropId: 1, text: 'Paid' });
        reply({ type: 'done', id: req.id });
      });
      made.push(w);
      return w;
    };
    const result = await readCropsInBrowser(crops, {}, make);
    expect(made).toHaveLength(2);
    expect(made[1]!.posted[0]).toMatchObject({ type: 'read', backend: 'wasm' });
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
          if (req.type === 'read')
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
