import { describe, expect, it } from 'vitest';
import {
  authOptions,
  idTokenClaims,
  idTokenPicture,
  NAME_MAX_LENGTH,
  withNames,
} from './auth-options.ts';

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

  it('carries the presence colour with the profile scope, and only when there is one', () => {
    const look = { color: '#0ea5e9', showPicture: true };
    expect(idTokenClaims(user, ['openid', 'profile'], look)).toMatchObject({
      presence_color: '#0ea5e9',
    });
    expect(idTokenClaims(user, ['openid', 'profile'], null)).not.toHaveProperty('presence_color');
    expect(idTokenClaims(user, ['openid', 'email'], look)).not.toHaveProperty('presence_color');
  });

  it("carries the account's own Google picture, and says when others don't see it", () => {
    const picture = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s96-c';
    const withPicture = { ...user, image: picture };
    const shown = idTokenClaims(withPicture, ['openid', 'profile'], {
      color: null,
      showPicture: true,
    });
    expect(shown).toMatchObject({ picture });
    expect(shown).not.toHaveProperty('picture_hidden');
    expect(
      idTokenClaims(withPicture, ['openid', 'profile'], { color: null, showPicture: false }),
    ).toMatchObject({ picture, picture_hidden: true });
    expect(idTokenClaims(withPicture, ['openid', 'email'])).not.toHaveProperty('picture');
    expect(
      idTokenClaims({ ...user, image: 'https://evil.example/a.png' }, ['profile']),
    ).not.toHaveProperty('picture');
  });

  it('leaves out a name the account does not have', () => {
    const claims = idTokenClaims({ ...user, name: '', givenName: null, familyName: undefined }, [
      'profile',
    ]);
    expect(claims).toEqual({ name: undefined, given_name: undefined, family_name: undefined });
  });
});

describe('Google sign-in pictures', () => {
  const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s96-c';
  // An ID token as Google's token endpoint hands it over: only its claims are read.
  const idToken = (claims: Record<string, unknown>) =>
    `e30.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;

  function options(stored: [string, unknown][]) {
    return authOptions(
      {
        baseUrl: 'https://liveworkspace.app',
        secret: 's'.repeat(32),
        resources: [],
        turnstileSecretKey: 't',
        adminToken: 'a',
        google: { clientId: 'g', clientSecret: 'gs' },
        sendCode: async () => {},
        storePicture: async (userId, picture) => {
          stored.push([userId, picture]);
        },
      },
      undefined,
    );
  }

  it("reads the picture claim of Google's ID token", () => {
    expect(idTokenPicture(idToken({ sub: '1', picture: PICTURE }))).toBe(PICTURE);
    expect(idTokenPicture(idToken({ sub: '1' }))).toBeNull();
    expect(idTokenPicture(idToken({ picture: 'https://evil.example/a.png' }))).toBeNull();
    expect(idTokenPicture('not-a-jwt')).toBeNull();
    expect(idTokenPicture('a.%%%.c')).toBeNull();
  });

  it('makes a new Google account with its picture', () => {
    const google = options([]).socialProviders!.google;
    const mapped = google.mapProfileToUser!({
      given_name: 'Ada',
      family_name: 'Lovelace',
      picture: PICTURE,
    } as never) as { image: unknown };
    expect(mapped.image).toBe(PICTURE);
    const other = google.mapProfileToUser!({ picture: 'https://evil.example/a' } as never) as {
      image: unknown;
    };
    expect(other.image).toBeUndefined();
  });

  it('stores the picture at every Google sign-in, and only for Google', async () => {
    const stored: [string, unknown][] = [];
    const hooks = options(stored).databaseHooks.account;
    const signIn = {
      userId: 'user_ada',
      providerId: 'google',
      idToken: idToken({ picture: PICTURE }),
    };
    await hooks.update.after(signIn as never);
    await hooks.create.after(signIn as never);
    await hooks.update.after({ ...signIn, providerId: 'credential' } as never);
    await hooks.update.after({ userId: 'user_ada', providerId: 'google' } as never);
    expect(stored).toEqual([
      ['user_ada', PICTURE],
      ['user_ada', PICTURE],
    ]);
  });
});
