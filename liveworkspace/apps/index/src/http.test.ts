import { describe, expect, it } from 'vitest';
import { readObject } from './http';

const put = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('https://index.test/items/x/share-password', {
    method: 'PUT',
    body,
    headers,
    // A stream body has to say it is sent half-duplex.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);

describe('readObject', () => {
  it('reads an object, and an empty body as an empty one', async () => {
    expect(await readObject(put('{"password":"pw"}'))).toEqual({ password: 'pw' });
    expect(await readObject(put(null))).toEqual({});
  });

  it('refuses a body that is not an object, or past the cap', async () => {
    for (const text of ['null', '[1]', '"x"', '{', '1'])
      expect(await readObject(put(text)), text).toBeNull();
    expect(await readObject(put('{}', { 'Content-Length': String(600 * 1024) }))).toBeNull();
    expect(await readObject(put(`{"pad":"${'x'.repeat(600 * 1024)}"}`))).toBeNull();
  });

  // Read as `{}`, a body that broke off would have cleared the share password (no `password` is "remove it").
  it('refuses a body that broke off mid-read, never reading it as empty', async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"password":'));
        controller.error(new Error('connection reset'));
      },
    });
    expect(await readObject(put(broken))).toBeNull();
  });
});
