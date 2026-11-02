import { describe, expect, it, vi } from 'vitest';
import { createMask, FilterCancelled } from '@livedesign/photo-engine';
import { PhotoWorkers } from './photo-worker-client';
import { solid } from './photo-test-utils';
import { runPhotoTask, transfersOf, type PhotoTask, type PhotoTaskResult } from './worker-tasks';

// docs/specs/031-photo/blueprints/photo-engine.md "Web Experience": the photo work off the main thread,
// answered by id, cancellable, and on the page where a worker cannot start.
type Listener = (e: { data: unknown }) => void;

// A worker in this process: it runs the real photo worker script against a scope of its own.
class FakeWorker {
  static made = 0;
  private readonly onMessage: Listener[] = [];
  private readonly onError: (() => void)[] = [];
  private handler: ((e: { data: unknown }) => void) | null = null;
  terminated = false;
  posted: unknown[] = [];
  private readonly mode: 'run' | 'silent';
  constructor(mode: 'run' | 'silent' = 'run') {
    this.mode = mode;
    FakeWorker.made++;
  }
  async boot(): Promise<void> {
    const scope = {
      postMessage: (m: unknown) =>
        queueMicrotask(() => this.onMessage.forEach((f) => f({ data: m }))),
      addEventListener: (_t: string, fn: (e: { data: unknown }) => void) => (this.handler = fn),
    };
    vi.stubGlobal('self', scope);
    vi.resetModules();
    await import('./photo.worker');
    vi.unstubAllGlobals();
  }
  // Like a browser: the transferred buffers leave the page (detached), the worker gets a copy.
  postMessage(m: unknown, transfer: Transferable[] = []): void {
    const sent = structuredClone(m, { transfer });
    this.posted.push(sent);
    if (this.mode === 'run') this.handler?.({ data: sent });
  }
  addEventListener(type: string, fn: Listener): void {
    if (type === 'message') this.onMessage.push(fn);
    else this.onError.push(() => fn({ data: null }));
  }
  emit(data: unknown): void {
    this.onMessage.forEach((f) => f({ data }));
  }
  crash(): void {
    this.onError.forEach((f) => f());
  }
  terminate(): void {
    this.terminated = true;
  }
}

async function booted(mode: 'run' | 'silent' = 'run') {
  const w = new FakeWorker(mode);
  await w.boot();
  return w;
}

const encodeTask = (): PhotoTask => ({
  kind: 'encode',
  width: 2,
  height: 1,
  data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]),
  type: 'image/png',
});

describe('the photo workers', () => {
  it('run a task in a worker and answer it by id', async () => {
    const w = await booted();
    const pool = new PhotoWorkers(() => w as never, 1);
    const enc = await pool.run(encodeTask()).result;
    expect(enc.kind).toBe('encode');
    const dec = await pool.run({
      kind: 'decode',
      bytes: (enc as { bytes: Uint8Array }).bytes,
      type: 'image/png',
    }).result;
    expect((dec as { raster: { data: Uint8ClampedArray } }).raster.data).toEqual(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]),
    );
    pool.dispose();
    expect(w.terminated).toBe(true);
  });

  it('pass on progress, a cancellation and an error', async () => {
    const w = await booted('silent');
    const pool = new PhotoWorkers(() => w as never, 1);
    const seen = vi.fn();
    const a = pool.run(encodeTask(), seen);
    const b = pool.run(encodeTask());
    const c = pool.run(encodeTask());
    w.emit({ id: 1, progress: 0.5 });
    w.emit({ id: 1, ok: true, result: { kind: 'encode', bytes: new Uint8Array() } });
    w.emit({ id: 2, ok: false, cancelled: true });
    w.emit({ id: 3, ok: false, error: 'boom' });
    w.emit({ id: 99, ok: true });
    await expect(a.result).resolves.toMatchObject({ kind: 'encode' });
    expect(seen).toHaveBeenCalledWith(0.5);
    await expect(b.result).rejects.toBeInstanceOf(FilterCancelled);
    await expect(c.result).rejects.toThrow('boom');
    b.cancel();
    expect(w.posted.at(-1)).toEqual({ id: 2, cancel: true });
  });

  it('run a dead worker’s tasks on the page, and try no worker after', async () => {
    const w = await booted('silent');
    const create = vi.fn(() => w as never);
    const pool = new PhotoWorkers(create, 2);
    const a = pool.run(encodeTask());
    w.crash();
    await expect(a.result).resolves.toMatchObject({ kind: 'encode' });
    await expect(pool.run(encodeTask()).result).resolves.toMatchObject({ kind: 'encode' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('keep a task’s buffers until the worker has answered, then move them', async () => {
    const dead = await booted('silent');
    const pool = new PhotoWorkers(() => dead as never, 1);
    const task = encodeTask();
    const a = pool.run(task);
    dead.crash();
    await expect(a.result).resolves.toMatchObject({ kind: 'encode' });

    const w = await booted();
    const live = new PhotoWorkers(() => w as never, 1);
    const first = encodeTask();
    await live.run(first).result;
    expect(first.kind === 'encode' && first.data.byteLength).toBe(8);
    const second = encodeTask();
    await live.run(second).result;
    expect(second.kind === 'encode' && second.data.byteLength).toBe(0);
  });

  it('run on the page when a worker cannot start, or there is none', async () => {
    const pool = new PhotoWorkers(() => {
      throw new Error('blocked');
    }, 2);
    await expect(pool.run(encodeTask()).result).resolves.toMatchObject({ kind: 'encode' });
    const none = new PhotoWorkers(null);
    const h = none.run({
      kind: 'filter',
      id: 'gaussian-blur',
      params: { radius: 2 },
      raster: solid(4, 4, [10, 20, 30, 255]),
      ctx: { foreground: [0, 0, 0], background: [255, 255, 255], seed: 1 } as never,
    });
    h.cancel();
    await h.result.catch(() => null);
  });

  it('spread the work over the least busy worker', async () => {
    const made: FakeWorker[] = [];
    const pool = new PhotoWorkers(() => {
      const w = new FakeWorker('silent');
      made.push(w);
      return w as never;
    }, 2);
    pool.run(encodeTask());
    pool.run(encodeTask());
    pool.run(encodeTask());
    expect(made).toHaveLength(2);
    expect(made.map((w) => w.posted.length).sort()).toEqual([1, 2]);
  });
});

describe('the photo tasks', () => {
  it('filter, select a subject, quick select, refine and fill', async () => {
    const pic = solid(24, 24, [200, 200, 200, 255]);
    for (let y = 8; y < 16; y++)
      for (let x = 8; x < 16; x++) pic.data.set([20, 40, 120, 255], (y * 24 + x) * 4);
    await expect(
      runPhotoTask({ kind: 'filter', id: 'nope', params: {}, raster: pic, ctx: {} as never }),
    ).rejects.toThrow('no filter nope');
    const blurred = await runPhotoTask({
      kind: 'filter',
      id: 'gaussian-blur',
      params: { radius: 1 },
      raster: pic,
      ctx: {} as never,
    });
    expect(blurred.kind).toBe('filter');
    const subject = await runPhotoTask({ kind: 'subject', raster: pic });
    expect(subject.kind).toBe('mask');
    const quick = await runPhotoTask({
      kind: 'quick-select',
      raster: pic,
      current: null,
      painted: createMask({ x: 10, y: 10, width: 3, height: 3 }, 255),
      subtract: false,
    });
    expect(quick.kind).toBe('selection');
    const refined = await runPhotoTask({
      kind: 'refine',
      raster: pic,
      mask: createMask({ x: 8, y: 8, width: 8, height: 8 }, 255),
      radius: 2,
    });
    expect(refined.kind).toBe('selection');
    const hole = new Uint8Array(24 * 24);
    hole[12 * 24 + 4] = 1;
    const filled = await runPhotoTask({ kind: 'fill', raster: pic, hole, seed: 3 });
    expect(filled.kind).toBe('fill');
    // Make Sizes' resampling (image-ops.ts coverSize).
    const resized = await runPhotoTask({ kind: 'resize', raster: pic, width: 6, height: 3 });
    expect(resized.kind === 'resize' && [resized.raster.width, resized.raster.height]).toEqual([
      6, 3,
    ]);
  });

  it('name the buffers each can move', () => {
    const raster = solid(1, 1, [0, 0, 0, 0]);
    const bytes = new Uint8Array(4);
    const results: PhotoTaskResult[] = [
      { kind: 'encode', bytes },
      { kind: 'decode', raster },
      { kind: 'filter', raster },
      { kind: 'fill', raster },
      { kind: 'resize', raster },
      { kind: 'mask', mask: bytes },
      { kind: 'selection', selection: createMask({ x: 0, y: 0, width: 1, height: 1 }, 1) },
    ];
    expect(results.map((r) => transfersOf(r).length)).toEqual([1, 1, 1, 1, 1, 1, 0]);
    expect(transfersOf(encodeTask())).toHaveLength(1);
    expect(transfersOf({ kind: 'decode', bytes, type: 'image/png' })).toEqual([]);
  });
});
