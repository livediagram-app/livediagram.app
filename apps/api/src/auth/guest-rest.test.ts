import { describe, it, expect } from 'vitest';
import { guestSignatureEnforced, isClerkIdShape, OWNER_SCOPED_SEGMENTS } from './guest-rest';

describe('isClerkIdShape', () => {
  // A Clerk `sub` in the GUEST header is always a replay of a harvested
  // account id: the real guest credential is a server-minted UUID, and a
  // signed-in client sends Authorization instead. Unlike the signature gate
  // this needs no rollout, so the worker refuses the shape outright.
  it('is true for a Clerk user id', () => {
    expect(isClerkIdShape('user_2abcDEF456')).toBe(true);
  });

  it('is false for the guest UUIDs the server actually mints', () => {
    // Exactly what POST /api/guest-id returns (crypto.randomUUID()).
    expect(isClerkIdShape(crypto.randomUUID())).toBe(false);
    expect(isClerkIdShape('7f3c1a8e-2b4d-4f6a-9c1e-5d8b0a2f4c6d')).toBe(false);
  });

  it('does not over-match ids that merely mention a user', () => {
    expect(isClerkIdShape('user')).toBe(false);
    expect(isClerkIdShape('my-user_id')).toBe(false);
    expect(isClerkIdShape('')).toBe(false);
  });
});

describe('guestSignatureEnforced', () => {
  const NOW = 1_000_000;
  it('is off without a secret (self-host opt-out)', () => {
    expect(guestSignatureEnforced({ GUEST_SIG_ENFORCE_AFTER: '0' }, NOW)).toBe(false);
  });
  it('is off when no cutoff is configured (grace by default)', () => {
    expect(guestSignatureEnforced({ GUEST_ID_HMAC_SECRET: 's' }, NOW)).toBe(false);
  });
  it('is off before the cutoff (grace window)', () => {
    expect(
      guestSignatureEnforced(
        { GUEST_ID_HMAC_SECRET: 's', GUEST_SIG_ENFORCE_AFTER: String(NOW + 1) },
        NOW,
      ),
    ).toBe(false);
  });
  it('is on at/after the cutoff with a secret set', () => {
    expect(
      guestSignatureEnforced(
        { GUEST_ID_HMAC_SECRET: 's', GUEST_SIG_ENFORCE_AFTER: String(NOW) },
        NOW,
      ),
    ).toBe(true);
  });
});

describe('OWNER_SCOPED_SEGMENTS', () => {
  it('includes the owner-keyed resources', () => {
    for (const s of [
      'diagrams',
      'folders',
      'images',
      'custom-themes',
      'participants',
      'preferences',
      'shared',
      'timeline',
      'activity',
      'favourites',
    ])
      expect(OWNER_SCOPED_SEGMENTS.has(s)).toBe(true);
  });
  it('excludes public / auth-bootstrap / Clerk-only routes', () => {
    for (const s of [
      'guest-id',
      'share',
      'migrate',
      'events',
      'telemetry',
      'tokens',
      'teams',
      'account',
    ])
      expect(OWNER_SCOPED_SEGMENTS.has(s)).toBe(false);
  });
});
