import { describe, it, expect } from 'vitest';
import { guestSignatureEnforced, OWNER_SCOPED_SEGMENTS } from './guest-rest';

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
