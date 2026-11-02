import { describe, expect, it } from 'vitest';
import { withNames } from './auth-options.ts';
import { checkProfilePatch } from './profiles.ts';
import { cleanEmail, cleanOrganisation, cleanTeamName } from './teams.ts';
import { cleanTokenName } from './tokens.ts';

const isWellFormed = (s: string) =>
  !/\p{Surrogate}/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''));

describe('typed names, as each door keeps them', () => {
  const overLong = `${'a'.repeat(79)}😀😀`;

  it('a token name keeps no half emoji and no override', () => {
    expect(isWellFormed(cleanTokenName(overLong, 'API token'))).toBe(true);
    expect(cleanTokenName('\u202Etpircs', 'API token')).toBe('tpircs');
    expect(cleanTokenName('\u202E', 'API token')).toBe('API token');
  });

  it('a team name and organisation keep no half emoji and no override', () => {
    expect(isWellFormed(cleanTeamName(overLong)!)).toBe(true);
    expect(isWellFormed(cleanOrganisation(overLong)!)).toBe(true);
    expect(cleanOrganisation('\u202Eevil org')).toBe('evil org');
    expect(cleanTeamName('\u2067\u2069')).toBeNull();
    expect(cleanTeamName('\u200B\u200B')).toBeNull();
    expect(cleanOrganisation('\u2060')).toBeNull();
    expect(cleanTokenName('\u200B', 'API token')).toBe('API token');
  });

  it('an account name keeps no half emoji and no override', () => {
    const user = withNames({ givenName: overLong, familyName: '\u202Eecalevol' });
    expect(isWellFormed(user.givenName!)).toBe(true);
    expect(user.familyName).toBe('ecalevol');
  });

  it('a display name keeps no override', () => {
    expect(checkProfilePatch({ name: '\u202Eada' })).toEqual({ ok: true, patch: { name: 'ada' } });
    expect(checkProfilePatch({ name: '\u200Bada\uFEFF' })).toEqual({
      ok: true,
      patch: { name: 'ada' },
    });
    expect(checkProfilePatch({ name: '\u200B' })).toEqual({ ok: true, patch: { name: null } });
  });
});

describe('cleanEmail', () => {
  it('turns down an address with a control or invisible character', () => {
    expect(cleanEmail('\u202Emoc.elpmaxe@evil.com')).toBeNull();
    expect(cleanEmail('bo\u200Bb@example.com')).toBeNull();
    expect(cleanEmail('dan\u0007@example.com')).toBeNull();
    expect(cleanEmail('ann\u00ADa@example.com')).toBeNull();
  });

  it('still takes an ordinary address', () => {
    expect(cleanEmail(' Bob@Example.com ')).toBe('bob@example.com');
  });
});
