import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelCues } from '@livediagram/sticky-vision';
import { createBoundaryClient } from './client';
import type { WorkerRequest, WorkerResponse } from './protocol';

// The page's side of the boundary model (spec/139 Phase 9): one worker,
// started once, asked per photo, and never allowed to hold the import up.

class FakeWorker {
  posted: WorkerRequest[] = [];
  private listeners = new Map<string, ((e: unknown) => void)[]>();

  postMessage(message: WorkerRequest) {
    this.posted.push(message);
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  answer(data: WorkerResponse) {
    for (const fn of this.listeners.get('message') ?? []) fn({ data });
  }
  crash() {
    for (const fn of this.listeners.get('error') ?? []) fn({ message: 'boom' });
  }
  lastId(): number {
    const last = this.posted.at(-1);
    if (last?.type !== 'cues') throw new Error('no cues request');
    return last.id;
  }
}

const image = { width: 2, height: 1, data: new Uint8ClampedArray(8) };
const cues: ModelCues = { width: 2, height: 1, notes: [], background: new Uint8Array(2) };

function setup() {
  const worker = new FakeWorker();
  const create = vi.fn(() => worker as unknown as Worker);
  return { worker, create, client: createBoundaryClient(create) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createBoundaryClient', () => {
  it('starts one worker however often it is warmed, and asks it to load', () => {
    const { worker, create, client } = setup();
    client.warm();
    client.warm();
    expect(create).toHaveBeenCalledTimes(1);
    expect(worker.posted).toEqual([{ type: 'warm' }]);
  });

  it('answers with the cues the worker read from this image', async () => {
    const { worker, client } = setup();
    const pending = client.cuesFor(image);
    const sent = worker.posted.at(-1);
    expect(sent).toMatchObject({ type: 'cues', width: 2, height: 1 });
    // A copy: the page still needs its own pixels for the classical pass.
    expect(sent?.type === 'cues' && sent.data).not.toBe(image.data);
    worker.answer({ type: 'cues', id: worker.lastId(), backend: 'wasm', cues, ms: 5 });
    await expect(pending).resolves.toEqual({ ok: true, backend: 'wasm', cues });
  });

  it('gives up after the timeout, and ignores the late answer', async () => {
    const { worker, client } = setup();
    const pending = client.cuesFor(image, { timeoutMs: 1000 });
    vi.advanceTimersByTime(1000);
    await expect(pending).resolves.toEqual({ ok: false, reason: 'timeout' });
    expect(() =>
      worker.answer({ type: 'cues', id: worker.lastId(), backend: 'wasm', cues, ms: 5 }),
    ).not.toThrow();
  });

  it('a runtime that cannot load fails every request now and after, without asking again', async () => {
    const { worker, client } = setup();
    const pending = client.cuesFor(image);
    worker.answer({ type: 'failed', id: null, reason: 'load-failed', detail: 'HTTP 404' });
    await expect(pending).resolves.toEqual({ ok: false, reason: 'load-failed' });
    const asked = worker.posted.length;
    await expect(client.cuesFor(image)).resolves.toEqual({ ok: false, reason: 'load-failed' });
    expect(worker.posted).toHaveLength(asked);
  });

  it('a failed inference fails that request only', async () => {
    const { worker, client } = setup();
    const first = client.cuesFor(image);
    worker.answer({
      type: 'failed',
      id: worker.lastId(),
      reason: 'inference-failed',
      detail: 'x',
    });
    await expect(first).resolves.toEqual({ ok: false, reason: 'inference-failed' });
    const second = client.cuesFor(image);
    worker.answer({ type: 'cues', id: worker.lastId(), backend: 'webgpu', cues, ms: 5 });
    await expect(second).resolves.toMatchObject({ ok: true, backend: 'webgpu' });
  });

  it('a worker that crashes counts as a runtime that did not load', async () => {
    const { worker, client } = setup();
    const pending = client.cuesFor(image);
    worker.crash();
    await expect(pending).resolves.toEqual({ ok: false, reason: 'load-failed' });
  });

  it('no worker at all is its own reason', async () => {
    const client = createBoundaryClient(() => {
      throw new Error('module workers unsupported');
    });
    client.warm();
    await expect(client.cuesFor(image)).resolves.toEqual({ ok: false, reason: 'no-worker' });
  });

  it('logs every failure with its reason', async () => {
    const { worker, client } = setup();
    const pending = client.cuesFor(image);
    worker.answer({ type: 'failed', id: null, reason: 'no-backend', detail: 'no adapter' });
    await pending;
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[photo-model] no-backend'),
      'no adapter',
    );
  });
});
