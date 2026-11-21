import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { EMAIL_SENDER_MAX, emailSenderFilter, senderHeard } from './email-trigger';

// The From filter.
describe('emailSenderFilter', () => {
  it('keeps an address trimmed and lower case', () => {
    expect(emailSenderFilter('  Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('keeps a domain, with or without its @, as @domain', () => {
    expect(emailSenderFilter('example.com')).toBe('@example.com');
    expect(emailSenderFilter(' @Mail.Example.co.uk')).toBe('@mail.example.co.uk');
    expect(emailSenderFilter('my-team.example.com')).toBe('@my-team.example.com');
  });

  it('takes a domain up to 253 characters', () => {
    const domain = (last: number) =>
      `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(last)}`;
    expect(emailSenderFilter(domain(61))).toBe(`@${domain(61)}`);
    expect(emailSenderFilter(domain(62))).toBeNull();
  });

  it('refuses what is neither', () => {
    for (const bad of [
      '',
      '   ',
      'example',
      '@',
      '@example',
      'ana@',
      'ana@@example.com',
      'ana example.com',
      'exa mple.com',
      '-bad.com',
      'bad-.com',
      'a..com',
      'example.com.',
      'ünï.com',
      '<ana@example.com>',
      `${'a'.repeat(64)}.com`,
      `${'a'.repeat(EMAIL_SENDER_MAX)}.com`,
      `${'abc.'.repeat(70)}com`,
    ])
      expect(emailSenderFilter(bad), bad).toBeNull();
  });

  it('reads a long hostile input in linear time', () => {
    const long = `${'a.'.repeat(50_000)}@${'-'.repeat(50_000)}`;
    expect(cpuMsOf(() => emailSenderFilter(long))).toBeLessThan(cpuBudgetMs(50));
    const dots = '.'.repeat(100_000);
    expect(cpuMsOf(() => senderHeard('@example.com', dots))).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('senderHeard', () => {
  it('hears every sender with no filter', () => {
    expect(senderHeard(undefined, 'ana@example.com')).toBe(true);
    expect(senderHeard('', 'ana@example.com')).toBe(true);
  });

  it('hears an exact address, any case', () => {
    expect(senderHeard('ana@example.com', 'Ana@Example.com')).toBe(true);
    expect(senderHeard('ana@example.com', 'bo@example.com')).toBe(false);
  });

  it('hears a whole domain, never a subdomain or a lookalike', () => {
    expect(senderHeard('@example.com', 'ANA@EXAMPLE.COM')).toBe(true);
    expect(senderHeard('@example.com', 'ana@mail.example.com')).toBe(false);
    expect(senderHeard('@example.com', 'ana@notexample.com')).toBe(false);
    expect(senderHeard('@example.com', '@example.com')).toBe(false);
    expect(senderHeard('@example.com', 'example.com')).toBe(false);
  });
});
