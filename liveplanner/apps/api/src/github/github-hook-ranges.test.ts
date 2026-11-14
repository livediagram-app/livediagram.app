// GitHub's webhook ranges kept current (docs/specs/026-plan/github-pull-requests.md "Deliveries"; blueprint "Part 6"):
// `GITHUB_HOOK_RANGES` is exactly the `hooks` list of the saved copy of api.github.com/meta, so a range GitHub adds
// (copied in by `scripts/refresh-github-hooks.mjs`) fails here until the api's list takes it too. Nothing here calls
// GitHub.
import { describe, expect, it } from 'vitest';
import { expandIpv6 } from '@liveworkspace/sites/network';
import saved from './github-meta-hooks.json';
import { GITHUB_HOOK_RANGES, isGithubHookAddress } from './refused-signatures';

// A CIDR's family, its first 32 bits masked to its prefix, and its prefix, as `GITHUB_HOOK_RANGES` keeps it.
function rangeOf(cidr: string): { v6: boolean; base: number; bits: number } {
  const [address, prefix] = cidr.split('/');
  const bits = Number(prefix);
  const hextets = expandIpv6(address!);
  const head = hextets
    ? parseInt(hextets[0]! + hextets[1]!, 16) >>> 0
    : address!.split('.').reduce((n, part) => n * 256 + Number(part), 0);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { v6: hextets !== null, base: (head & mask) >>> 0, bits };
}

const text = (r: { v6: boolean; base: number; bits: number }) =>
  `${r.v6 ? 'v6' : 'v4'} ${r.base.toString(16).padStart(8, '0')}/${r.bits}`;

describe('GITHUB_HOOK_RANGES', () => {
  it('is the saved copy of GitHub’s /meta hooks, no more and no fewer', () => {
    expect(saved.source).toBe('https://api.github.com/meta');
    expect(saved.hooks.length).toBeGreaterThan(0);
    const fromGithub = saved.hooks.map((c) => text(rangeOf(c))).sort();
    const kept = GITHUB_HOOK_RANGES.map(text).sort();
    expect(kept).toEqual(fromGithub);
  });

  it('keeps every prefix within the first 32 bits it compares, each base on its prefix', () => {
    for (const c of saved.hooks) expect(rangeOf(c).bits, c).toBeLessThanOrEqual(32);
    for (const r of GITHUB_HOOK_RANGES) {
      const mask = (0xffffffff << (32 - r.bits)) >>> 0;
      expect((r.base & mask) >>> 0, text(r)).toBe(r.base);
    }
  });

  it('takes the first and last address of each saved range, and the ones either side only inside another', () => {
    const v4 = saved.hooks.filter((h) => !h.includes(':')).map(rangeOf);
    const savedHas = (n: number) =>
      v4.some((r) => n >= r.base && n <= r.base + 2 ** (32 - r.bits) - 1);
    const ip = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
    for (const { base, bits } of v4) {
      const last = base + 2 ** (32 - bits) - 1;
      for (const n of [base, last, base - 1, last + 1])
        expect(isGithubHookAddress(ip(n)), ip(n)).toBe(savedHas(n));
    }
  });
});
