import { describe, expect, it } from 'vitest';
import {
  accountFullNameOf,
  accountNameCookies,
  ACCOUNT_NAME_MAX_LENGTH,
  accountNameCookie,
  accountNameCookieFor,
  accountNameOf,
  readAccountName,
} from './account-name';

describe('accountNameCookieFor', () => {
  it("names each app's cookie after its hint", () => {
    expect(accountNameCookieFor('ld_signed_in')).toBe('ld_account');
    expect(accountNameCookieFor('lp_signed_in')).toBe('lp_account');
    expect(accountNameCookieFor('ldoc_signed_in')).toBe('ldoc_account');
    expect(accountNameCookieFor('ldes_signed_in')).toBe('ldes_account');
  });

  it('refuses a cookie that is not a hint', () => {
    expect(() => accountNameCookieFor('ld_refresh')).toThrow();
  });
});

describe('accountNameOf', () => {
  it('prefers the given name, then the full name, then the email', () => {
    expect(accountNameOf({ givenName: 'Ada', name: 'Ada Lovelace', email: 'a@x.io' })).toBe('Ada');
    expect(accountNameOf({ givenName: ' ', name: 'Ada Lovelace', email: 'a@x.io' })).toBe(
      'Ada Lovelace',
    );
    expect(accountNameOf({ name: null, email: 'a@x.io' })).toBe('a@x.io');
    expect(accountNameOf({})).toBeNull();
    expect(accountNameOf(null)).toBeNull();
  });

  it('keeps at most the limit, counting characters rather than UTF-16 units', () => {
    const long = '😀'.repeat(ACCOUNT_NAME_MAX_LENGTH + 10);
    expect(Array.from(accountNameOf({ name: long }) ?? '')).toHaveLength(ACCOUNT_NAME_MAX_LENGTH);
  });
});

describe('accountNameCookie', () => {
  it('is readable on the whole site, encoded', () => {
    expect(accountNameCookie('ld_account', 'Zoë; x=1', 60)).toBe(
      'ld_account=Zo%C3%AB%3B%20x%3D1; Path=/; Secure; SameSite=Lax; Max-Age=60',
    );
  });

  it('clears with no name', () => {
    expect(accountNameCookie('ld_account', null, 60)).toBe(
      'ld_account=; Path=/; Secure; SameSite=Lax; Max-Age=0',
    );
  });
});

describe('readAccountName', () => {
  it('reads back what was written', () => {
    const set = accountNameCookie('lp_account', 'Zoë; x=1', 60).split(';')[0];
    expect(readAccountName(`a=1; ${set}; lp_signed_in=1`, 'lp_account')).toBe('Zoë; x=1');
  });

  it("is null with none, an empty one, a broken one, or only another app's", () => {
    expect(readAccountName('', 'lp_account')).toBeNull();
    expect(readAccountName('lp_account=', 'lp_account')).toBeNull();
    expect(readAccountName('lp_account=%E0%A4%A', 'lp_account')).toBeNull();
    expect(readAccountName('ld_account=Ada; xlp_account=Bo', 'lp_account')).toBeNull();
  });
});

describe('accountFullNameOf', () => {
  it('gives the full name when the header shows only the given name', () => {
    expect(accountFullNameOf({ givenName: 'Wendy', name: 'Wendy Tran' })).toBe('Wendy Tran');
  });

  it('gives nothing when the header name is already the full name, or there is none', () => {
    expect(accountFullNameOf({ name: 'Wendy Tran' })).toBeNull();
    expect(accountFullNameOf({ givenName: 'Wendy' })).toBeNull();
    expect(accountFullNameOf(null)).toBeNull();
  });
});

describe('accountNameCookies', () => {
  it('sets the name and the full name beside it, and clears both with no account', () => {
    const [name, full] = accountNameCookies(
      'ld_account',
      { givenName: 'Wendy', name: 'Wendy Tran' },
      60,
    );
    expect(name).toMatch(/^ld_account=Wendy;.*Max-Age=60/);
    expect(full).toMatch(/^ld_account_full=Wendy%20Tran;.*Max-Age=60/);
    const cleared = accountNameCookies('ld_account', null, 60);
    expect(cleared.every((c) => c.endsWith('Max-Age=0'))).toBe(true);
  });
});
