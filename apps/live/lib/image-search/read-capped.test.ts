import { describe, expect, it } from 'vitest';
import { readCapped } from './read-capped';

// docs/specs/009-elements/blueprints/image-search.md "storeSearchResult": the download cap.

const CAP = 10;

// A body of `sizes` chunks with no Content-Length, counting how many chunks were pulled.
function streamed(sizes: number[]) {
  let pulled = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const size = sizes[pulled++];
      if (size === undefined) controller.close();
      else controller.enqueue(new Uint8Array(size).fill(7));
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    res: new Response(body),
    pulled: () => pulled,
    cancelled: () => cancelled,
  };
}

describe('readCapped', () => {
  it('reads a body at the cap whole, typed', async () => {
    const out = await readCapped(new Response(new Uint8Array(CAP)), CAP, 'image/png');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.blob.size).toBe(CAP);
      expect(out.blob.type).toBe('image/png');
    }
  });

  it('refuses a declared Content-Length over the cap before reading', async () => {
    const s = streamed([1]);
    s.res.headers.set('content-length', String(CAP + 1));
    expect(await readCapped(s.res, CAP, 'image/png')).toEqual({ ok: false, reason: 'too-large' });
    expect(s.pulled()).toBeLessThanOrEqual(1);
    expect(s.cancelled()).toBe(true);
  });

  it('stops a body without a length as soon as it streams past the cap', async () => {
    const s = streamed([4, 4, 4, 4, 4, 4]);
    expect(await readCapped(s.res, CAP, 'image/png')).toEqual({ ok: false, reason: 'too-large' });
    expect(s.cancelled()).toBe(true);
    expect(s.pulled()).toBeLessThan(6);
  });

  it('joins a streamed body under the cap in order', async () => {
    const s = streamed([3, 3, 3]);
    const out = await readCapped(s.res, CAP, 'image/jpeg');
    expect(out.ok).toBe(true);
    if (out.ok)
      expect(new Uint8Array(await out.blob.arrayBuffer())).toEqual(new Uint8Array(9).fill(7));
  });

  it('checks a bodiless response by its size', async () => {
    const out = await readCapped(new Response(null), CAP, 'image/png');
    expect(out.ok).toBe(true);
  });
});
