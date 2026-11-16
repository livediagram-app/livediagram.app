// The upload as an app's Worker sends it (liveworkspace/docs/specs/006-media/walkthroughs.md "The service's routes"):
// a stream body goes through a FixedLengthStream where the runtime has one, so it arrives with its Content-Length
// rather than chunked (which the service refuses as media_mismatch).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedLength, walkthroughCalls } from './walkthrough-client';

class FakeFixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
  static lengths: number[] = [];
  constructor(length: number) {
    super();
    FakeFixedLengthStream.lengths.push(length);
  }
}

const stream = () =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array([1, 2, 3]));
      c.close();
    },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  FakeFixedLengthStream.lengths = [];
});

describe('fixedLength', () => {
  it('passes a stream through as it is where there is no FixedLengthStream', () => {
    const body = stream();
    expect(fixedLength(body, 3)).toBe(body);
  });

  it('passes an ArrayBuffer as it is, which already has a length', () => {
    vi.stubGlobal('FixedLengthStream', FakeFixedLengthStream);
    const body = new ArrayBuffer(3);
    expect(fixedLength(body, 3)).toBe(body);
    expect(FakeFixedLengthStream.lengths).toEqual([]);
  });

  it('pipes a stream through a FixedLengthStream of the declared length in a Worker', async () => {
    vi.stubGlobal('FixedLengthStream', FakeFixedLengthStream);
    const body = stream();
    const out = fixedLength(body, 3);
    expect(out).not.toBe(body);
    expect(FakeFixedLengthStream.lengths).toEqual([3]);
    expect(new Uint8Array(await new Response(out as ReadableStream).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
});

describe('walkthroughCalls().upload', () => {
  it('sends the media with its type and length, through a FixedLengthStream in a Worker', async () => {
    vi.stubGlobal('FixedLengthStream', FakeFixedLengthStream);
    const call = vi.fn(async () => Response.json({ walkthrough: { id: 'w1' } }));
    const result = await walkthroughCalls(call).upload('o1', 'w 1', {
      body: stream(),
      type: 'video/webm',
      length: 3,
    });
    expect(result).toEqual({ ok: true, value: { walkthrough: { id: 'w1' } } });
    const [path, init, search] = call.mock.calls[0] as unknown as [string, RequestInit, unknown];
    expect(path).toBe('/walkthroughs/w%201/media');
    expect(search).toEqual({ owner: 'o1' });
    expect(init.headers).toEqual({ 'Content-Type': 'video/webm', 'Content-Length': '3' });
    expect(FakeFixedLengthStream.lengths).toEqual([3]);
  });
});
