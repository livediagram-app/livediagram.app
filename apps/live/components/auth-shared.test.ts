import { describe, expect, it } from 'vitest';
import {
  POST_AUTH_DEFAULT,
  POST_AUTH_SIGNIN_DEFAULT,
  messageOf,
  resolveOAuthCompleteUrl,
  resolvePostAuthDestination,
} from './auth-shared';

// resolvePostAuthDestination decides where the sign-in and sign-up
// pages send a verified user. Wrong here means either an open
// redirect (worth a security row), a redirect loop back to auth, or
// a doubled /live/live/... basePath. Tests pin every documented
// branch.
//
// Both call sites pass next/navigation's ReadonlyURLSearchParams;
// the function reads only `.get(key)`, so plain URLSearchParams
// stands in fine here.

const params = (qs: string) => new URLSearchParams(qs);

describe('resolvePostAuthDestination', () => {
  it("returns the default '/' when redirect_url is absent", () => {
    expect(resolvePostAuthDestination(params(''))).toBe(POST_AUTH_DEFAULT);
  });

  it('returns the default for a redirect_url that does not start with /live', () => {
    // Open-redirect guard: anything not under /live is rejected so
    // an attacker can't bounce the verified user off-site via the
    // query param.
    expect(resolvePostAuthDestination(params('redirect_url=https://evil.example'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolvePostAuthDestination(params('redirect_url=/marketing'))).toBe(POST_AUTH_DEFAULT);
    expect(resolvePostAuthDestination(params('redirect_url=//evil.example'))).toBe(
      POST_AUTH_DEFAULT,
    );
  });

  it('refuses a redirect back to /live/sign-in (loop guard)', () => {
    expect(resolvePostAuthDestination(params('redirect_url=/live/sign-in'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolvePostAuthDestination(params('redirect_url=/live/sign-in?foo=bar'))).toBe(
      POST_AUTH_DEFAULT,
    );
    // Case-insensitive: the lowercase prefix check stops capitalised
    // bypass attempts.
    expect(resolvePostAuthDestination(params('redirect_url=/LIVE/SIGN-IN'))).toBe(
      POST_AUTH_DEFAULT,
    );
  });

  it('refuses a redirect back to /live/get-started (loop guard)', () => {
    expect(resolvePostAuthDestination(params('redirect_url=/live/get-started'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolvePostAuthDestination(params('redirect_url=/live/Get-Started?onboarding=1'))).toBe(
      POST_AUTH_DEFAULT,
    );
  });

  it('strips the /live prefix from a safe path', () => {
    // router.push already respects the basePath, so passing the
    // raw /live/diagram/abc would yield /live/live/diagram/abc.
    expect(resolvePostAuthDestination(params('redirect_url=/live/diagram/abc'))).toBe(
      '/diagram/abc',
    );
    expect(resolvePostAuthDestination(params('redirect_url=/live/explorer'))).toBe('/explorer');
    expect(resolvePostAuthDestination(params('redirect_url=/live/new?folder=f1'))).toBe(
      '/new?folder=f1',
    );
  });

  it("collapses a bare /live redirect to '/'", () => {
    // Stripping the prefix from exactly "/live" leaves the empty
    // string. We promote that to "/" so router.push has a valid path.
    expect(resolvePostAuthDestination(params('redirect_url=/live'))).toBe('/');
  });
});

// OAuth-flavoured form: same validation, returns the path with the
// /live prefix kept on (Clerk's authenticateWithRedirect navigates
// the browser directly, so basePath isn't applied). Mirrors the
// resolvePostAuthDestination branches.

describe('resolveOAuthCompleteUrl', () => {
  it("returns the OAuth default '/live/' when redirect_url is absent", () => {
    expect(resolveOAuthCompleteUrl(params(''))).toBe('/live/');
  });

  it('returns the OAuth default for an off-origin or unsafe redirect_url', () => {
    expect(resolveOAuthCompleteUrl(params('redirect_url=https://evil.example'))).toBe('/live/');
    expect(resolveOAuthCompleteUrl(params('redirect_url=/marketing'))).toBe('/live/');
  });

  it('returns the OAuth default for a redirect back to the auth routes (loop guard)', () => {
    expect(resolveOAuthCompleteUrl(params('redirect_url=/live/sign-in'))).toBe('/live/');
    expect(resolveOAuthCompleteUrl(params('redirect_url=/LIVE/SIGN-IN'))).toBe('/live/');
    expect(resolveOAuthCompleteUrl(params('redirect_url=/live/get-started?onboarding=1'))).toBe(
      '/live/',
    );
  });

  it('keeps the /live prefix on safe destinations (no basePath stripping)', () => {
    expect(resolveOAuthCompleteUrl(params('redirect_url=/live/diagram/abc'))).toBe(
      '/live/diagram/abc',
    );
    expect(resolveOAuthCompleteUrl(params('redirect_url=/live/explorer'))).toBe('/live/explorer');
    expect(resolveOAuthCompleteUrl(params('redirect_url=/live/new?folder=f1'))).toBe(
      '/live/new?folder=f1',
    );
  });

  it("re-adds /live to a bare /live redirect, landing on '/live/'", () => {
    // The router.push form collapses bare /live to '/'. The OAuth
    // form has to put the prefix back so Clerk's full-path
    // redirectUrlComplete lands on /live/, not the marketing root.
    expect(resolveOAuthCompleteUrl(params('redirect_url=/live'))).toBe('/live/');
  });

  it('keeps the POST_AUTH_DEFAULT constant in sync with the OAuth default', () => {
    // Sanity: the router.push default is '/' and the OAuth default
    // is '/live/'. The OAuth helper composes on top of the
    // router.push one, so if POST_AUTH_DEFAULT changes the OAuth
    // default has to move in lockstep.
    expect(POST_AUTH_DEFAULT).toBe('/');
    expect(resolveOAuthCompleteUrl(params(''))).toBe('/live/');
  });
});

// messageOf is the user-visible failure path for sign-in and
// sign-up: every Clerk error in the two pages funnels through it
// before reaching the inline `<p>` that explains why the form
// didn't work. The three branches (Clerk array shape, native
// Error, fallback string) each map to a different surface, and a
// regression that drops to the fallback for a real Clerk error
// would hide a useful "wrong code" / "rate limit" / "already
// signed up" message behind a generic catch-all.
describe('messageOf', () => {
  it('joins a Clerk-shape errors array with ", " separators', () => {
    const err = {
      errors: [{ message: 'Email address is required' }, { message: 'Password is too short' }],
    };
    expect(messageOf(err, 'fallback')).toBe('Email address is required, Password is too short');
  });

  it('returns a single Clerk message unchanged (no leading separator)', () => {
    const err = { errors: [{ message: 'Incorrect verification code' }] };
    expect(messageOf(err, 'fallback')).toBe('Incorrect verification code');
  });

  it('returns the empty string when Clerk returns an empty errors array', () => {
    // Edge: a malformed Clerk response with `errors: []`. The empty
    // join produces "" rather than falling through to the fallback,
    // matching the current implementation (the empty array IS the
    // signal we matched the Clerk shape).
    expect(messageOf({ errors: [] }, 'fallback')).toBe('');
  });

  it('falls through to the next branch when `errors` is not an array', () => {
    // A non-Clerk object with a coincidentally-named `errors` field
    // that isn't an array. Drops to the Error / fallback path
    // instead of treating the bad shape as Clerk's.
    expect(messageOf({ errors: 'oops' }, 'fallback')).toBe('fallback');
    expect(messageOf({ errors: null }, 'fallback')).toBe('fallback');
  });

  it('returns err.message for a native Error', () => {
    expect(messageOf(new Error('network down'), 'fallback')).toBe('network down');
  });

  it('returns err.message for a subclass of Error (TypeError)', () => {
    expect(messageOf(new TypeError('bad arg'), 'fallback')).toBe('bad arg');
  });

  it('returns the fallback for null / undefined / primitives', () => {
    expect(messageOf(null, 'fallback')).toBe('fallback');
    expect(messageOf(undefined, 'fallback')).toBe('fallback');
    expect(messageOf('a string thrown directly', 'fallback')).toBe('fallback');
    expect(messageOf(42, 'fallback')).toBe('fallback');
  });

  it('returns the fallback for a plain object with no recognised shape', () => {
    expect(messageOf({ unrelated: true }, 'fallback')).toBe('fallback');
  });
});

describe('sign-in default (POST_AUTH_SIGNIN_DEFAULT)', () => {
  it('sends a verified sign-in with no redirect_url to the Explorer', () => {
    expect(resolvePostAuthDestination(params(''), POST_AUTH_SIGNIN_DEFAULT)).toBe('/explorer');
    expect(resolveOAuthCompleteUrl(params(''), POST_AUTH_SIGNIN_DEFAULT)).toBe('/live/explorer');
  });

  it('still lets a valid redirect_url win over the sign-in default', () => {
    // A protected-page bounce must return where it came from, not the
    // Explorer, even on the sign-in flow.
    expect(
      resolvePostAuthDestination(
        params('redirect_url=/live/diagram/abc'),
        POST_AUTH_SIGNIN_DEFAULT,
      ),
    ).toBe('/diagram/abc');
    expect(
      resolveOAuthCompleteUrl(params('redirect_url=/live/diagram/abc'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/live/diagram/abc');
  });

  it('falls back to the Explorer for an unsafe / auth-loop redirect_url', () => {
    expect(
      resolvePostAuthDestination(
        params('redirect_url=https://evil.example'),
        POST_AUTH_SIGNIN_DEFAULT,
      ),
    ).toBe('/explorer');
    expect(
      resolvePostAuthDestination(params('redirect_url=/live/sign-in'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/explorer');
  });

  it('leaves the sign-up flow (no default arg) on the welcome flow', () => {
    expect(resolvePostAuthDestination(params(''))).toBe(POST_AUTH_DEFAULT);
    expect(resolveOAuthCompleteUrl(params(''))).toBe('/live/');
  });
});
