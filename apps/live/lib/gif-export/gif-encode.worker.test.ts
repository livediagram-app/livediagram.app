import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GifEncodeRequest, GifEncodeResponse } from './gif-encode-protocol';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder": the worker's side.
async function startWorker() {
  const posted: { message: GifEncodeResponse; transfer?: Transferable[] }[] = [];
  let onMessage: (e: { data: GifEncodeRequest }) => void = () => {};
  vi.stubGlobal('self', {
    postMessage: (message: GifEncodeResponse, transfer?: Transferable[]) =>
      posted.push({ message, transfer }),
    addEventListener: (_: 'message', fn: typeof onMessage) => (onMessage = fn),
  });
  vi.resetModules();
  await import('./gif-encode.worker');
  return { posted, send: (data: GifEncodeRequest) => onMessage({ data }) };
}
const frame = (v: number) => new Uint8ClampedArray(4 * 2 * 4).fill(v).buffer;

afterEach(() => vi.unstubAllGlobals());

describe('the GIF encoder worker', () => {
  it('encodes the frames it is sent and hands the file back, transferred', async () => {
    const { posted, send } = await startWorker();
    send({ type: 'start', width: 4, height: 2 });
    send({ type: 'frame', rgba: frame(10), delayCs: 7 });
    send({ type: 'frame', rgba: frame(10), delayCs: 6 });
    send({ type: 'finish' });
    const done = posted[0]!;
    expect(done.message).toMatchObject({ type: 'done', written: 1 });
    const bytes = new Uint8Array((done.message as { bytes: ArrayBuffer }).bytes);
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    expect(done.transfer).toHaveLength(1);
  });

  it('says it failed, with the size, when a frame cannot be encoded', async () => {
    const { posted, send } = await startWorker();
    send({ type: 'start', width: 4, height: 2 });
    const unreadable = {
      get length(): number {
        throw new RangeError('out of memory');
      },
    };
    send({ type: 'frame', rgba: unreadable as unknown as ArrayBuffer, delayCs: 7 });
    expect(posted[0]!.message).toMatchObject({ type: 'failed' });
    expect((posted[0]!.message as { message: string }).message).toBe(
      '4x2: RangeError: out of memory',
    );
  });

  it('keeps a page palette and writes the frames that name it', async () => {
    const { posted, send } = await startWorker();
    send({ type: 'start', width: 4, height: 2 });
    send({ type: 'palette', key: 0, samples: [frame(10), frame(200)] });
    send({ type: 'frame', rgba: frame(10), delayCs: 7, palette: 0 });
    send({ type: 'frame', rgba: frame(200), delayCs: 7, palette: 0 });
    send({ type: 'finish' });
    expect(posted[0]!.message).toMatchObject({ type: 'done', written: 2 });
  });

  it('ignores a finish with nothing started', async () => {
    const { posted, send } = await startWorker();
    send({ type: 'finish' });
    expect(posted).toHaveLength(0);
  });
});
