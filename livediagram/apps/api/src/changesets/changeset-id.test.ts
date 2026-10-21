import { describe, expect, it } from 'vitest';
import { CHANGESET_ID_PATTERN } from '@livediagram/api-schema';
import { mintChangesetId } from './changeset-id';

describe('mintChangesetId', () => {
  it('mints cs_ and 10 lowercase Crockford base32 characters', () => {
    for (let i = 0; i < 50; i += 1) expect(mintChangesetId()).toMatch(CHANGESET_ID_PATTERN);
  });

  it('spends 50 bits of randomness, 5 a character', () => {
    expect(mintChangesetId(() => new Uint8Array(10).fill(0))).toBe('cs_0000000000');
    expect(mintChangesetId(() => new Uint8Array(10).fill(31))).toBe('cs_zzzzzzzzzz');
    expect(mintChangesetId(() => new Uint8Array(10).fill(255))).toBe('cs_zzzzzzzzzz');
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => mintChangesetId()));
    expect(ids.size).toBe(1000);
  });
});
