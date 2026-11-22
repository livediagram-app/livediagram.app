// A share's email domains (one-explorer-contracts.md "Sharing and access"): typed text read left to right, each name
// normalised and checked, the public mail providers, and the worst case inside a CPU budget.
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  emailDomainOf,
  isPublicMailDomain,
  normaliseShareDomain,
  parseShareDomains,
  SHARE_DOMAINS_MAX,
  SHARE_DOMAINS_TEXT_MAX,
  suggestedShareDomain,
} from './share-domains';

describe('normaliseShareDomain', () => {
  it('drops one leading @ and one trailing dot, and lower-cases', () => {
    expect(normaliseShareDomain('@Acme.COM')).toBe('acme.com');
    expect(normaliseShareDomain('acme.com.')).toBe('acme.com');
    expect(normaliseShareDomain('eng.acme.co.uk')).toBe('eng.acme.co.uk');
    expect(normaliseShareDomain('a-b.c1')).toBe('a-b.c1');
  });

  it('refuses a name that is no domain', () => {
    for (const bad of [
      '',
      '@',
      'localhost',
      '@@acme.com',
      'acme..com',
      '.acme.com',
      '-acme.com',
      'acme-.com',
      'ac_me.com',
      'acme.com/x',
      'bob@acme.com',
      'äcme.com',
      `${'a'.repeat(64)}.com`,
      `${'a.'.repeat(127)}com`,
    ]) {
      expect(normaliseShareDomain(bad), bad).toBeNull();
    }
    expect(normaliseShareDomain(`${'a'.repeat(63)}.com`)).toBe(`${'a'.repeat(63)}.com`);
  });
});

describe('parseShareDomains', () => {
  it('splits typed text at spaces, tabs, new lines and commas, keeping the order and dropping repeats', () => {
    expect(
      parseShareDomains(' @tommcclean.me  @liveworkspace.app,acme.com\n\tACME.com ,, '),
    ).toEqual({
      ok: true,
      domains: ['tommcclean.me', 'liveworkspace.app', 'acme.com'],
    });
    expect(parseShareDomains(['acme.com', 'b.org c.net'])).toEqual({
      ok: true,
      domains: ['acme.com', 'b.org', 'c.net'],
    });
    expect(parseShareDomains('')).toEqual({ ok: true, domains: [] });
  });

  it('names the first name that is no domain', () => {
    expect(parseShareDomains('acme.com nope b.org')).toEqual({ ok: false, invalid: 'nope' });
  });

  it('refuses more than the most domains, and a text past the longest', () => {
    const domains = Array.from({ length: SHARE_DOMAINS_MAX }, (_, i) => `d${i}.com`);
    expect(parseShareDomains(domains.join(' '))).toMatchObject({ ok: true });
    // A repeat does not count twice.
    expect(parseShareDomains([...domains, 'd0.com'].join(' '))).toMatchObject({ ok: true });
    expect(parseShareDomains([...domains, 'one-more.com'].join(' '))).toEqual({
      ok: false,
      tooMany: true,
    });
    expect(parseShareDomains(' '.repeat(SHARE_DOMAINS_TEXT_MAX + 1))).toEqual({
      ok: false,
      tooMany: true,
    });
  });

  it('reads a worst-case text in linear time', () => {
    // The longest text it reads: separators and long almost-domains, the shape a backtracking pattern chokes on.
    const separators = ` ,\t`.repeat(SHARE_DOMAINS_TEXT_MAX / 3).slice(0, SHARE_DOMAINS_TEXT_MAX);
    const almost = `${'a-'.repeat(3999)}.`;
    expect(cpuMsOf(() => parseShareDomains(separators))).toBeLessThan(cpuBudgetMs(20));
    expect(cpuMsOf(() => parseShareDomains(almost))).toBeLessThan(cpuBudgetMs(20));
    expect(cpuMsOf(() => normaliseShareDomain('a'.repeat(50_000)))).toBeLessThan(cpuBudgetMs(20));
  });
});

describe('email domains', () => {
  it('reads an address’s domain after its last @', () => {
    expect(emailDomainOf('Bob@Acme.com')).toBe('acme.com');
    expect(emailDomainOf('"a@b"@acme.com')).toBe('acme.com');
    for (const none of [null, undefined, '', 'bob', '@acme.com', 'bob@']) {
      expect(emailDomainOf(none)).toBeNull();
    }
  });

  it('suggests the sharer’s own domain, never a public mail provider’s', () => {
    expect(suggestedShareDomain('ada@acme.com')).toBe('acme.com');
    expect(suggestedShareDomain('ada@Gmail.com')).toBeNull();
    expect(suggestedShareDomain('ada@outlook.com')).toBeNull();
    expect(suggestedShareDomain(null)).toBeNull();
    expect(suggestedShareDomain('ada@localhost')).toBeNull();
    expect(isPublicMailDomain('ICLOUD.COM')).toBe(true);
    expect(isPublicMailDomain('acme.com')).toBe(false);
  });
});
