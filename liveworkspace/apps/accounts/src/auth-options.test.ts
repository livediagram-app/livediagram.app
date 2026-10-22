import { describe, expect, it } from 'vitest';
import { idTokenClaims, NAME_MAX_LENGTH, withNames } from './auth-options.ts';

describe('withNames', () => {
  it('trims the names and joins them into name', () => {
    expect(withNames({ name: '', givenName: '  Ada ', familyName: ' Lovelace ' })).toEqual({
      name: 'Ada Lovelace',
      givenName: 'Ada',
      familyName: 'Lovelace',
    });
  });

  it('caps each name', () => {
    const long = 'a'.repeat(NAME_MAX_LENGTH + 20);
    const user = withNames({ givenName: long, familyName: long });
    expect(user.givenName).toHaveLength(NAME_MAX_LENGTH);
    expect(user.familyName).toHaveLength(NAME_MAX_LENGTH);
  });

  it('leaves name alone when an update changes only one half', () => {
    expect(withNames({ givenName: 'Augusta' })).toEqual({ givenName: 'Augusta' });
  });

  it('passes an account without names through, name trimmed', () => {
    const blank = { name: ' ', email: 'a@example.com' };
    expect(withNames(blank)).toEqual({ name: '', email: 'a@example.com' });
    const unnamed = { name: undefined, email: 'a@example.com' };
    expect(withNames(unnamed)).toEqual(unnamed);
  });
});

describe('idTokenClaims', () => {
  const user = {
    name: 'Ada Lovelace',
    givenName: 'Ada',
    familyName: 'Lovelace',
    email: 'ada@example.com',
    emailVerified: true,
  };

  it('carries the names and email the scopes allow', () => {
    expect(idTokenClaims(user, ['openid', 'profile', 'email'])).toEqual({
      name: 'Ada Lovelace',
      given_name: 'Ada',
      family_name: 'Lovelace',
      email: 'ada@example.com',
      email_verified: true,
    });
    expect(idTokenClaims(user, ['openid'])).toEqual({});
  });

  it('leaves out a name the account does not have', () => {
    const claims = idTokenClaims({ ...user, name: '', givenName: null, familyName: undefined }, [
      'profile',
    ]);
    expect(claims).toEqual({ name: undefined, given_name: undefined, family_name: undefined });
  });
});
