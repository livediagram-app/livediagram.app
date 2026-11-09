// A report's body (public-routes.ts readReport): the route is open to anyone, so what it reads is bounded.

import { describe, expect, it } from 'vitest';
import { readReport } from './public-routes';

const post = (body: BodyInit | null) =>
  new Request('https://community.test/api/community/posts/p1/report?app=livediagram.app', {
    method: 'POST',
    body,
    // A stream body has to say it is sent half-duplex.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);

describe('readReport', () => {
  it('reads a reason and a trimmed note, and refuses anything else', async () => {
    expect(await readReport(post('{"reason":"spam","note":"  hi "}'))).toEqual({
      reason: 'spam',
      note: 'hi',
    });
    expect(await readReport(post(null))).toBe('invalid_reason');
    expect(await readReport(post('{'))).toBe('invalid_reason');
  });

  // A chunked body declares no length: it is read only as far as the cap (64 KiB), never held whole.
  it('stops reading a chunked body at the cap', async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 256) controller.close();
        else controller.enqueue(new Uint8Array(16 * 1024).fill(0x20));
      },
    });
    expect(await readReport(post(endless))).toBe('invalid_reason');
    expect(pulled).toBeLessThan(16);
  });
});
