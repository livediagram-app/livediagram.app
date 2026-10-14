import { describe, expect, it, vi } from 'vitest';
import type { GifEncodeRequest, GifEncodeResponse } from './gif-encode-protocol';
import { openGifEncoder } from './gif-encoder';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder": the page's side of the worker.
function fakeWorker() {
  const sent: { message: GifEncodeRequest; transfer?: Transferable[] }[] = [];
  const listeners: {
    message: ((e: { data: GifEncodeResponse }) => void)[];
    error: ((e: ErrorEvent) => void)[];
  } = { message: [], error: [] };
  const worker = {
    postMessage: (message: GifEncodeRequest, transfer?: Transferable[]) =>
      sent.push({ message, transfer }),
    addEventListener: (type: 'message' | 'error', fn: never) => listeners[type].push(fn),
    terminate: vi.fn(),
  };
  const reply = (data: GifEncodeResponse) => listeners.message.forEach((fn) => fn({ data }));
  return { worker, sent, reply, listeners };
}
const frame = () => new Uint8ClampedArray(4 * 4 * 4).fill(200);

describe('the GIF encoder client', () => {
  it('starts the worker, transfers each frame and resolves with the file', async () => {
    const fake = fakeWorker();
    const session = openGifEncoder(4, 4, () => fake.worker);
    const rgba = frame();
    session.add(rgba, 7);
    expect(fake.sent[0]!.message).toEqual({ type: 'start', width: 4, height: 4 });
    expect(fake.sent[1]!.message).toMatchObject({ type: 'frame', delayCs: 7 });
    expect(fake.sent[1]!.transfer).toEqual([rgba.buffer]);
    const done = session.finish();
    expect(fake.sent[2]!.message).toEqual({ type: 'finish' });
    fake.reply({ type: 'done', bytes: new Uint8Array([71, 73, 70]).buffer, written: 1 });
    await expect(done).resolves.toEqual({ bytes: new Uint8Array([71, 73, 70]), written: 1 });
    expect(fake.worker.terminate).toHaveBeenCalled();
  });

  it('transfers a page palette’s samples, and names it on each frame', () => {
    const fake = fakeWorker();
    const session = openGifEncoder(4, 4, () => fake.worker);
    const sample = frame();
    session.palette(2, [sample]);
    session.add(frame(), 7, 2);
    expect(fake.sent[1]!.message).toMatchObject({ type: 'palette', key: 2 });
    expect(fake.sent[1]!.transfer).toEqual([sample.buffer]);
    expect(fake.sent[2]!.message).toMatchObject({ type: 'frame', palette: 2 });
  });

  it('rejects when the worker fails, and ignores frames after', async () => {
    const fake = fakeWorker();
    const session = openGifEncoder(4, 4, () => fake.worker);
    fake.reply({ type: 'failed', message: 'out of memory' });
    session.add(frame(), 7);
    expect(fake.sent).toHaveLength(1);
    await expect(session.finish()).rejects.toThrow('out of memory');
  });

  it('rejects a pending finish on a worker error', async () => {
    const fake = fakeWorker();
    const session = openGifEncoder(4, 4, () => fake.worker);
    const done = session.finish();
    fake.listeners.error.forEach((fn) => fn({ message: '' } as ErrorEvent));
    await expect(done).rejects.toThrow('GIF worker failed');
  });

  it('ends the worker on cancel', () => {
    const fake = fakeWorker();
    openGifEncoder(4, 4, () => fake.worker).cancel();
    expect(fake.worker.terminate).toHaveBeenCalled();
  });

  it('encodes on the page where no worker can start', async () => {
    const session = openGifEncoder(4, 4, () => {
      throw new Error('no module workers');
    });
    session.add(frame(), 7);
    const { bytes, written } = await session.finish();
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    expect(written).toBe(1);
  });

  it('uses a page palette on the page too', async () => {
    const session = openGifEncoder(4, 4, null);
    session.palette(0, [frame()]);
    session.add(frame(), 7, 0);
    const { written } = await session.finish();
    expect(written).toBe(1);
  });

  it('drops frames on the page once cancelled', async () => {
    const session = openGifEncoder(4, 4, null);
    session.cancel();
    session.add(frame(), 7);
    const { written } = await session.finish();
    expect(written).toBe(0);
  });
});
