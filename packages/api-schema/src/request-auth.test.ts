import { describe, expect, it } from 'vitest';
import { bearerTokenOf, isClerkIdShape, isLoopbackHostname } from './request-auth';

describe('bearerTokenOf', () => {
  it('reads and trims a bearer token', () => {
    expect(bearerTokenOf('Bearer abc')).toBe('abc');
    expect(bearerTokenOf('Bearer  abc ')).toBe('abc');
  });
  it('rejects a missing header, another scheme and an empty token', () => {
    expect(bearerTokenOf(null)).toBeNull();
    expect(bearerTokenOf(undefined)).toBeNull();
    expect(bearerTokenOf('Basic abc')).toBeNull();
    expect(bearerTokenOf('Bearer   ')).toBeNull();
  });
});

describe('isLoopbackHostname', () => {
  it('knows IPv4, IPv6 and the name, as URL reports them', () => {
    for (const u of ['http://localhost:3000', 'http://127.0.0.1', 'http://[::1]:8787']) {
      expect(isLoopbackHostname(new URL(u).hostname)).toBe(true);
    }
    expect(isLoopbackHostname('livediagram.app')).toBe(false);
  });
});

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
