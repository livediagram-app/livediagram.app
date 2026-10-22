import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { networkHash } from './network';

describe('networkHash', () => {
  // Pinned to an independent SHA-256, so the stored hashes stay comparable whatever computes them.
  it('is the first 16 bytes of SHA-256 over the post id and the network, as hex', async () => {
    const expected = createHash('sha256').update('post1:203.0.113.0/24').digest('hex').slice(0, 32);
    expect(await networkHash('post1', '203.0.113.7')).toBe(expected);
    expect(await networkHash('post1', '203.0.113.200')).toBe(expected);
    expect(await networkHash('post2', '203.0.113.7')).not.toBe(expected);
  });
});
