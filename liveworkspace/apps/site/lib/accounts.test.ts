import { describe, expect, it } from 'vitest';
import {
  displayName,
  EMAIL_PATTERN,
  isRegistering,
  nextUrl,
  returnPath,
  signedOAuthQuery,
  signInHref,
} from './accounts';

describe('signedOAuthQuery', () => {
  it('keeps the signature, the parameter list and only the parameters it names', () => {
    const search =
      '?client_id=app&scope=openid&ba_param=client_id&ba_param=scope&sig=s1&exp=9&extra=x';
    expect(signedOAuthQuery(search)).toBe(
      'client_id=app&scope=openid&ba_param=client_id&ba_param=scope&sig=s1',
    );
  });

  it('is nothing without a signature or a parameter list', () => {
    expect(signedOAuthQuery('?client_id=app')).toBeUndefined();
    expect(signedOAuthQuery('?sig=s1')).toBeUndefined();
  });
});

describe('the rest', () => {
  it('reads prompt=create among other prompts', () => {
    expect(isRegistering('?prompt=create')).toBe(true);
    expect(isRegistering('?prompt=login%20create')).toBe(true);
    expect(isRegistering('?prompt=login')).toBe(false);
    expect(isRegistering('')).toBe(false);
  });

  it('follows a url only from a successful answer', () => {
    expect(nextUrl({ ok: true, status: 200, data: { url: '/x' } })).toBe('/x');
    expect(nextUrl({ ok: false, status: 400, data: { url: '/x' } })).toBeNull();
    expect(nextUrl({ ok: true, status: 200, data: {} })).toBeNull();
  });

  it('takes an ordinary address and refuses a broken one', () => {
    expect(EMAIL_PATTERN.test('jane@example.com')).toBe(true);
    expect(EMAIL_PATTERN.test('jane@example')).toBe(false);
    expect(EMAIL_PATTERN.test('jane example@x.com')).toBe(false);
  });
});

describe('going back after signing in', () => {
  it('returns only to a path on this site', () => {
    expect(returnPath('?return=%2Ftelemetry%3Fapp%3Dliveplanner.app')).toBe(
      '/telemetry?app=liveplanner.app',
    );
    expect(returnPath('?return=https%3A%2F%2Fevil.example')).toBeNull();
    expect(returnPath('?return=%2F%2Fevil.example')).toBeNull();
    expect(returnPath('?return=%2F%5Cevil.example')).toBeNull();
    expect(returnPath('')).toBeNull();
  });

  it('links to sign-in with the page to come back to', () => {
    expect(signInHref('/')).toBe('/sign-in?return=%2F');
    expect(signInHref('/telemetry?app=liveplanner.app')).toBe(
      '/sign-in?return=%2Ftelemetry%3Fapp%3Dliveplanner.app',
    );
    expect(returnPath(new URL(signInHref('/telemetry'), 'https://x').search)).toBe('/telemetry');
  });

  it('names the account by first name, then full name, then email', () => {
    expect(displayName({ givenName: 'Ada', name: 'Ada Lovelace' })).toBe('Ada');
    expect(displayName({ givenName: '', name: 'Ada Lovelace' })).toBe('Ada Lovelace');
    expect(displayName({ email: 'ada@example.com' })).toBe('ada@example.com');
    expect(displayName({})).toBe('Your account');
  });
});
