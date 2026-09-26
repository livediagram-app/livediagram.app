import { describe, expect, it } from 'vitest';
import { bearerTokenOf, isLoopbackHostname } from './request-auth';

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
