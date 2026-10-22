import { describe, expect, it } from 'vitest';
import { signOwnerId, verifyOwnerId } from './owner-signature';

const SECRET = 'test-secret-key';

describe('owner-signature', () => {
  it('signs an id and verifies its own signature', async () => {
    const id = 'guest-abc';
    const sig = await signOwnerId(SECRET, id);
    expect(sig).toBeTruthy();
    expect(await verifyOwnerId(SECRET, id, sig)).toBe(true);
  });

  it('is deterministic for the same id + secret', async () => {
    expect(await signOwnerId(SECRET, 'x')).toBe(await signOwnerId(SECRET, 'x'));
  });

  it("rejects another id's signature", async () => {
    const sigForA = await signOwnerId(SECRET, 'id-A');
    expect(await verifyOwnerId(SECRET, 'id-B', sigForA)).toBe(false);
  });

  it('rejects a signature minted under a different secret', async () => {
    const sig = await signOwnerId('other-secret', 'id');
    expect(await verifyOwnerId(SECRET, 'id', sig)).toBe(false);
  });

  it('rejects a missing / empty signature when a secret is set', async () => {
    expect(await verifyOwnerId(SECRET, 'id', null)).toBe(false);
    expect(await verifyOwnerId(SECRET, 'id', undefined)).toBe(false);
    expect(await verifyOwnerId(SECRET, 'id', '')).toBe(false);
  });

  it('disables signing when no secret is configured (self-host)', async () => {
    expect(await signOwnerId(undefined, 'id')).toBeNull();
    // Verification is a no-op (true) so callers that gate on the secret
    // keep their legacy unsigned behaviour.
    expect(await verifyOwnerId(undefined, 'id', null)).toBe(true);
  });
});
