import { describe, expect, it } from 'vitest';
import { readableSize } from './email.ts';
import { checkLink, linkUrl, signLink } from './link.ts';

const FACTS = {
  forPerson: 'user_ada',
  key: 'personal:user_ada',
  exportId: 'ex_1',
  expiresAt: 1000,
};

describe('the link’s signature', () => {
  it('checks out for the same facts and secret, and for nothing else', async () => {
    const sig = await signLink('s', FACTS);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await checkLink('s', FACTS, sig)).toBe(true);
    expect(await checkLink('other', FACTS, sig)).toBe(false);
    expect(await checkLink('s', { ...FACTS, forPerson: 'user_bea' }, sig)).toBe(false);
    expect(await checkLink('s', { ...FACTS, expiresAt: 1001 }, sig)).toBe(false);
    expect(await checkLink('s', FACTS, 'zz')).toBe(false);
    expect(await checkLink('s', FACTS, sig.toUpperCase())).toBe(false);
  });

  it('makes the whole link on the base, without a trailing slash', async () => {
    const url = new URL(await linkUrl('https://liveworkspace.app/', 's', FACTS));
    expect(url.pathname).toBe('/api/account/data-export/download');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'personal:user_ada',
      id: 'ex_1',
      exp: '1000',
      sig: await signLink('s', FACTS),
    });
  });
});

it('reads a size as people do', () => {
  expect(readableSize(10)).toBe('1 KB');
  expect(readableSize(840_000)).toBe('840 KB');
  expect(readableSize(12_400_000)).toBe('12.4 MB');
  expect(readableSize(1_200_000_000)).toBe('1.2 GB');
});
