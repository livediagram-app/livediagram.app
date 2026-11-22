import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { legacyGuestOwner, rekeyedLegacyGuestOwner } from './contract';

const OLD = '0f8b5a2c-3d4e-4f60-8a1b-2c3d4e5f6a7b';
// A guest id as accounts mints and checks it (liveworkspace/apps/accounts/src/ids.ts GUEST_ID): a v4-shaped UUID.
const V4_GUEST = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('the owner of an old guest', () => {
  it('is the bare id behind the guest prefix until re-keyed', () => {
    expect(legacyGuestOwner(OLD)).toBe(`guest_${OLD}`);
  });

  it('re-keys to a v4-shaped guest id that the secret and the bare id decide', async () => {
    const id = await rekeyedLegacyGuestOwner(OLD, 'secret-a');
    expect(id).toMatch(V4_GUEST);
    // Pinned (Node's own HMAC gave it), so the Worker and anything else deriving it can never drift.
    expect(id).toBe('guest_ab2f3550-78a9-4ab2-b8b4-b0efdabf31ac');
    const mac = createHmac('sha256', 'secret-a').update(OLD).digest('hex');
    expect(id.replaceAll('-', '').slice('guest_'.length, 'guest_'.length + 12)).toBe(
      mac.slice(0, 12),
    );
    expect(await rekeyedLegacyGuestOwner(OLD, 'secret-b')).not.toBe(id);
    expect(await rekeyedLegacyGuestOwner(OLD.replace('0f8b', '0f8c'), 'secret-a')).not.toBe(id);
  });
});
