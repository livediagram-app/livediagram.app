import { describe, expect, it } from 'vitest';
import {
  bearerTokenOf,
  isAccountIdShape,
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
    for (const u of ['http://localhost:3100', 'http://127.0.0.1', 'http://[::1]:8787']) {
      expect(isLoopbackHostname(new URL(u).hostname)).toBe(true);
    }
    expect(isLoopbackHostname('example.app')).toBe(false);
  });
});

describe('isAccountIdShape', () => {
  // An account is `user_…`, a guest `guest_<uuid>`: a signed-in client with no
  // session token never falls back to the guest token for its account id.
  it('is true for an account id', () => {
    expect(isAccountIdShape('user_2abcDEF456')).toBe(true);
  });

  it("is false for a guest's id", () => {
    expect(isAccountIdShape(`guest_${crypto.randomUUID()}`)).toBe(false);
    expect(isAccountIdShape('guest_7f3c1a8e-2b4d-4f6a-9c1e-5d8b0a2f4c6d')).toBe(false);
  });

  it('does not over-match ids that merely mention a user', () => {
    expect(isAccountIdShape('user')).toBe(false);
    expect(isAccountIdShape('my-user_id')).toBe(false);
    expect(isAccountIdShape('')).toBe(false);
  });
});

describe('oauthRedirectUrl', () => {
  it('takes https anywhere and http only on a loopback host', () => {
    expect(oauthRedirectUrl('https://claude.ai/cb')?.pathname).toBe('/cb');
    for (const u of ['http://localhost:3100/cb', 'http://127.0.0.1/cb', 'http://[::1]:8787/cb'])
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
