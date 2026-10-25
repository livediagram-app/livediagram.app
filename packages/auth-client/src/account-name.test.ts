import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_COLOUR_MAX_LENGTH,
  accountColourCookieFor,
  accountColourOf,
  accountFullNameOf,
  isSafeColourValue,
  readAccountColour,
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

describe('the colour cookie', () => {
  it("sits beside the name cookie, and is set from the profile's colour with the name", () => {
    expect(accountColourCookieFor('ld_account')).toBe('ld_account_colour');
    const [, , colour] = accountNameCookies('ld_account', { name: 'Ada', color: '#0ea5e9' }, 60);
    expect(colour).toBe('ld_account_colour=%230ea5e9; Path=/; Secure; SameSite=Lax; Max-Age=60');
  });

  it('is cleared with no colour (Automatic), no account, or a colour that is not safe to paint', () => {
    for (const user of [
      { name: 'Ada' },
      { name: 'Ada', color: null },
      null,
      { name: 'Ada', color: 'url(https://evil.example/x)' },
      { name: 'Ada', color: 'red;background:blue' },
      { name: 'Ada', color: `#${'0'.repeat(ACCOUNT_COLOUR_MAX_LENGTH)}` },
    ]) {
      expect(accountNameCookies('ld_account', user, 60)[2]).toMatch(
        /^ld_account_colour=; .*Max-Age=0$/,
      );
    }
  });

  it('reads back a safe colour, and nothing for an unsafe or broken one', () => {
    const [, , written] = accountNameCookies(
      'lp_account',
      { name: 'Ada', color: 'oklch(70% 0.1 200)' },
      60,
    );
    const set = written!.split(';')[0];
    expect(readAccountColour(`lp_signed_in=1; ${set}`, 'lp_account_colour')).toBe(
      'oklch(70% 0.1 200)',
    );
    expect(readAccountColour('lp_account_colour=red%3Bx', 'lp_account_colour')).toBeNull();
    expect(readAccountColour('lp_account_colour=url(x)', 'lp_account_colour')).toBeNull();
    expect(readAccountColour('lp_account_colour=re%0Ad', 'lp_account_colour')).toBeNull();
    expect(readAccountColour('', 'lp_account_colour')).toBeNull();
  });

  it('trims a colour, and passes every colour syntax but nothing that could load or break out', () => {
    expect(accountColourOf({ color: '  #ef4444 ' })).toBe('#ef4444');
    for (const ok of ['#fff', 'rebeccapurple', 'rgb(1 2 3)', 'color-mix(in oklab, red, blue)']) {
      expect(isSafeColourValue(ok)).toBe(true);
    }
    for (const bad of ['', 'a"b', 'image-set(x)', 'paint(x)', 42, null]) {
      expect(isSafeColourValue(bad)).toBe(false);
    }
  });
});
