import { describe, expect, it } from 'vitest';
import { isAbortError, readErrorCode } from './http-errors';

describe('readErrorCode', () => {
  it("reads the worker's error token, leaving the body for the caller", async () => {
    const res = Response.json({ error: 'post_hidden' }, { status: 409 });
    expect(await readErrorCode(res)).toBe('post_hidden');
    expect(await res.json()).toEqual({ error: 'post_hidden' });
  });

  it('is null for an empty, non-JSON or token-less body', async () => {
    expect(await readErrorCode(new Response(null, { status: 503 }))).toBeNull();
    expect(await readErrorCode(new Response('<html>', { status: 502 }))).toBeNull();
    expect(await readErrorCode(Response.json({ error: 42 }, { status: 400 }))).toBeNull();
  });
});

describe('isAbortError', () => {
  it('tells a cancelled fetch from a real failure', () => {
    expect(isAbortError(new DOMException('stop', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });
});
