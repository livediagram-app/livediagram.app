import { describe, expect, it } from 'vitest';
import { addressWords, automationAddress, splitAddresses } from './email-addresses';

// docs/specs/026-plan/automations.md "Typed-in addresses".
describe('automationAddress', () => {
  it.each([
    [' Ana@Example.COM ', 'ana@example.com'],
    ['a.b+c@sub.example.org', 'a.b+c@sub.example.org'],
  ])('keeps %j as %j', (raw, kept) => expect(automationAddress(raw)).toBe(kept));

  it.each([
    '',
    'ana',
    'ana@example',
    'ana @example.com',
    'Ana <ana@example.com>',
    'ana@example.com,bo@example.com',
    'ana;x@example.com',
    '"ana"@example.com',
    `${'a'.repeat(250)}@example.com`,
  ])('refuses %j', (raw) => expect(automationAddress(raw)).toBeNull());
});

describe('addressWords', () => {
  it('names the first and how many more', () => {
    expect(addressWords(['a@x.com'])).toBe('a@x.com');
    expect(addressWords(['a@x.com', 'b@x.com', 'c@x.com'])).toBe('a@x.com and 2 more');
    expect(addressWords(['a@x.com', 'b@x.com'], 'More')).toBe('a@x.com and 1 More');
    expect(addressWords([])).toBe('nobody');
  });
});

describe('splitAddresses', () => {
  it('splits pasted text at commas, semicolons, spaces and lines', () => {
    expect(splitAddresses('a@x.com, b@x.com;c@x.com\nd@x.com  ')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
    ]);
    expect(splitAddresses(' , ')).toEqual([]);
  });
});
