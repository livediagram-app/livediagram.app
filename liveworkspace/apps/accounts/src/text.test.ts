import { describe, expect, it } from 'vitest';
import { withNames } from './auth-options.ts';
import { checkProfilePatch } from './profiles.ts';
import { cleanEmail, cleanOrganisation, cleanTeamName } from './teams.ts';
import { cleanText, clipText, withoutBidiControls } from './text.ts';
import { cleanTokenName } from './tokens.ts';

const isWellFormed = (s: string) =>
  !/\p{Surrogate}/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''));

describe('clipText', () => {
  it('never cuts an emoji in half', () => {
    const clipped = clipText(`${'a'.repeat(79)}😀😀`, 80);
    expect(clipped).toBe('a'.repeat(79));
    expect(isWellFormed(clipped)).toBe(true);
  });

  it('keeps a joined emoji whole or leaves it out', () => {
    const family = '🧑‍🤝‍🧑'; // 8 units
    expect(clipText(`abc${family}`, 7)).toBe('abc');
    expect(clipText(`abc${family}`, 11)).toBe(`abc${family}`);
  });

  it('passes short text through untouched', () => {
    expect(clipText('Ops', 80)).toBe('Ops');
  });

  it('clips a long name in linear time', () => {
    const long = '😀'.repeat(200_000);
    const start = process.cpuUsage();
    expect(clipText(long, 80)).toHaveLength(80);
    const { user, system } = process.cpuUsage(start);
    expect((user + system) / 1000).toBeLessThan(500);
  });
});

describe('withoutBidiControls', () => {
  it('takes out every embedding, override and isolate, and keeps right-to-left letters', () => {
    expect(
      withoutBidiControls('\u202Eevil\u202C \u2067org\u2069 \u202A\u202B\u202D\u2066\u2068'),
    ).toBe('evil org ');
    expect(withoutBidiControls('فريق العمليات')).toBe('فريق العمليات');
  });
});

describe('cleanText', () => {
  it('trims, drops bidi controls and clips whole characters', () => {
    expect(cleanText('  \u202Eevil org  ', 80)).toBe('evil org');
    expect(cleanText(`${'a'.repeat(79)}😀`, 80)).toBe('a'.repeat(79));
  });
});

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
  });

  it('an account name keeps no half emoji and no override', () => {
    const user = withNames({ givenName: overLong, familyName: '\u202Eecalevol' });
    expect(isWellFormed(user.givenName!)).toBe(true);
    expect(user.familyName).toBe('ecalevol');
  });

  it('a display name keeps no override', () => {
    expect(checkProfilePatch({ name: '\u202Eada' })).toEqual({ ok: true, patch: { name: 'ada' } });
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
