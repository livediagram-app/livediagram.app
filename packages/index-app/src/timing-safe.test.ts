import { describe, expect, it } from 'vitest';
import { timingSafeEqual } from './timing-safe';

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
