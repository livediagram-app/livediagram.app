import { describe, expect, it } from 'vitest';
import {
  POST_AUTH_DEFAULT,
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
