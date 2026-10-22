import { describe, expect, it } from 'vitest';
import {
  bearerTokenOf,
  isClerkIdShape,
  isLoopbackHostname,
  oauthRedirectUrl,
} from './request-auth';

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
    for (const u of ['http://localhost:3200', 'http://127.0.0.1', 'http://[::1]:8987']) {
      expect(isLoopbackHostname(new URL(u).hostname)).toBe(true);
    }
    expect(isLoopbackHostname('livedocuments.app')).toBe(false);
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

describe('oauthRedirectUrl', () => {
  it('takes https anywhere and http only on a loopback host', () => {
    expect(oauthRedirectUrl('https://claude.ai/cb')?.pathname).toBe('/cb');
    for (const u of ['http://localhost:3200/cb', 'http://127.0.0.1/cb', 'http://[::1]:8987/cb'])
      expect(oauthRedirectUrl(u)).not.toBeNull();
    expect(oauthRedirectUrl('http://example.com/cb')).toBeNull();
  });
  it('refuses another scheme on loopback, a fragment, and a non-URL', () => {
    expect(oauthRedirectUrl('javascript://localhost/%0Aalert(1)//')).toBeNull();
    expect(oauthRedirectUrl('https://claude.ai/cb#x')).toBeNull();
    expect(oauthRedirectUrl('https://claude.ai/cb#')).toBeNull();
    expect(oauthRedirectUrl('not a url')).toBeNull();
  });
});
