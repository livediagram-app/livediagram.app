import { describe, expect, it } from 'vitest';
import { bearerMatches, timingSafeEqual } from './timing-safe';

describe('timingSafeEqual', () => {
  it('returns true for identical strings', async () => {
    expect(await timingSafeEqual('hunter2', 'hunter2')).toBe(true);
  });

  it('returns false when a single byte differs', async () => {
    expect(await timingSafeEqual('hunter2', 'hunter3')).toBe(false);
  });

  it('returns false for different-length strings (length not leaked via early exit)', async () => {
    expect(await timingSafeEqual('abc', 'abcdef')).toBe(false);
    expect(await timingSafeEqual('', 'x')).toBe(false);
  });

  it('treats two empty strings as equal', async () => {
    expect(await timingSafeEqual('', '')).toBe(true);
  });

  it('is order-independent (a,b) === (b,a)', async () => {
    expect(await timingSafeEqual('left', 'right')).toBe(await timingSafeEqual('right', 'left'));
  });
});

describe('bearerMatches', () => {
  const req = (auth?: string) =>
    new Request('https://x.test/', auth === undefined ? {} : { headers: { Authorization: auth } });

  it('takes the key as a Bearer only', async () => {
    expect(await bearerMatches(req('Bearer k1'), 'k1')).toBe(true);
    expect(await bearerMatches(req('Bearer k2'), 'k1')).toBe(false);
    expect(await bearerMatches(req('k1'), 'k1')).toBe(false);
    expect(await bearerMatches(req(), 'k1')).toBe(false);
  });

  it('never matches an empty Bearer, even against an empty key', async () => {
    expect(await bearerMatches(req('Bearer '), '')).toBe(false);
  });
});
