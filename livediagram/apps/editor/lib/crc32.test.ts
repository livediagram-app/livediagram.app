import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32 } from './crc32';

describe('crc32', () => {
  it('computes the standard CRC-32', () => {
    for (const text of ['', 'The quick brown fox', 'Café · A4'] as const) {
      const data = new TextEncoder().encode(text);
      expect(crc32(data), text).toBe(nodeCrc32(data));
    }
  });
});
