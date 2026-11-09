import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, readObject } from './http';

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('https://drive.test/api/drive/adopt', {
    method: 'POST',
    body,
    headers,
    // A stream body has to say it is sent half-duplex.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);

describe('readObject', () => {
  it('reads an object, and no body as an empty one', async () => {
    expect(await readObject(post('{"folderId":"f1"}'))).toEqual({ folderId: 'f1' });
    expect(await readObject(post(null))).toEqual({});
  });

  it('refuses what is not an object, or past the cap by its length or its bytes', async () => {
    for (const text of ['null', '[1]', '{', '1'])
      expect(await readObject(post(text)), text).toBeNull();
    expect(
      await readObject(post('{}', { 'Content-Length': String(MAX_BODY_BYTES + 1) })),
    ).toBeNull();
    expect(await readObject(post(`{"pad":"${'x'.repeat(MAX_BODY_BYTES)}"}`))).toBeNull();
  });

  // A chunked body declares no length: it is read only as far as the cap, never held whole.
  it('stops reading a chunked body at the cap', async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 512) controller.close();
        else controller.enqueue(new Uint8Array(4 * 1024).fill(0x20));
      },
    });
    expect(await readObject(post(endless))).toBeNull();
    expect(pulled).toBeLessThan(16);
  });

  // Read as `{}`, a body cut off mid-read would pass as one that asked for nothing.
  it('refuses a body that broke off mid-read', async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"folderId":'));
        controller.error(new Error('connection reset'));
      },
    });
    expect(await readObject(post(broken))).toBeNull();
  });
});
