import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256HexPrefix, sha256Sync } from './sha256';
import { oldItemPersonId, plannerItemPersonId } from './person-ids';

const node = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('sha256Sync', () => {
  it('matches node:crypto across the padding boundaries', () => {
    for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 31 + 7) & 0xff);
      expect(hex(sha256Sync(bytes))).toBe(node(bytes));
    }
  });

  it('hashes text as UTF-8', () => {
    expect(sha256HexPrefix('héllo ✓', 32)).toBe(
      createHash('sha256').update('héllo ✓', 'utf8').digest('hex'),
    );
  });

  it("makes the old site's and liveplanner's person ids (12 bytes of the prefixed owner id)", () => {
    const want = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 24);
    expect(oldItemPersonId('user_x')).toBe(want('livediagram-item-person:user_x'));
    expect(plannerItemPersonId('acct_x')).toBe(want('liveplanner-item-person:acct_x'));
  });
});
