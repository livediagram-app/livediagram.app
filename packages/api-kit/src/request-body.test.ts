import { describe, expect, it } from 'vitest';
import { objectOrEmpty, readCappedBody, withCappedBody } from './request-body';

describe('objectOrEmpty', () => {
  it('keeps a plain object and reads anything else as empty', () => {
    expect(objectOrEmpty({ a: 1 })).toEqual({ a: 1 });
    for (const v of [null, undefined, 'x', 3, [1], true]) expect(objectOrEmpty(v)).toEqual({});
  });
});

// A body that arrives in `chunks` pieces of `size` bytes and declares no length, as a chunked upload does.
function chunked(chunks: number, size: number, onCancel?: () => void): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === chunks) return controller.close();
      sent++;
      controller.enqueue(new Uint8Array(size).fill(sent));
    },
    cancel: onCancel,
  });
}

describe('readCappedBody', () => {
  it('reads a body under the cap whole, chunks joined in order', async () => {
    const bytes = await readCappedBody(chunked(3, 4), 12);
    expect(Array.from(bytes!)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  });

  it('hands a one-chunk body on as it came', async () => {
    const bytes = await readCappedBody(chunked(1, 5), 5);
    expect(bytes!.byteLength).toBe(5);
  });

  it('reads an empty body as no bytes', async () => {
    expect((await readCappedBody(chunked(0, 0), 0))!.byteLength).toBe(0);
  });

  it('refuses the chunk that passes the cap and cancels the rest unread', async () => {
    let cancelled = false;
    const bytes = await readCappedBody(
      chunked(1000, 1024, () => void (cancelled = true)),
      4 * 1024,
    );
    expect(bytes).toBeNull();
    expect(cancelled).toBe(true);
  });

  it('refuses even when the source throws on cancel', async () => {
    const bytes = await readCappedBody(
      chunked(10, 10, () => {
        throw new Error('gone');
      }),
      15,
    );
    expect(bytes).toBeNull();
  });
});

describe('withCappedBody', () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request('https://api.test/api/x', {
      method: 'POST',
      headers,
      body,
      duplex: 'half',
    } as RequestInit);

  it('hands a bodiless request back as it is', async () => {
    const request = new Request('https://api.test/api/x', { method: 'DELETE' });
    expect(await withCappedBody(request, 1)).toBe(request);
  });

  it('keeps a body under the cap readable, with its method, URL and headers', async () => {
    const request = post(JSON.stringify({ a: 1 }), { 'Content-Type': 'application/json' });
    const capped = (await withCappedBody(request, 1024))!;
    expect(capped.method).toBe('POST');
    expect(capped.url).toBe('https://api.test/api/x');
    expect(capped.headers.get('content-type')).toBe('application/json');
    expect(await capped.json()).toEqual({ a: 1 });
  });

  it('refuses a chunked body over the cap that declares no length', async () => {
    const request = post(chunked(64, 1024));
    expect(request.headers.get('content-length')).toBeNull();
    expect(await withCappedBody(request, 16 * 1024)).toBeNull();
  });
});
