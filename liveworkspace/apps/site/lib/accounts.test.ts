import { describe, expect, it } from 'vitest';
import { EMAIL_PATTERN, isRegistering, nextUrl, signedOAuthQuery } from './accounts';

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
