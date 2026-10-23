import { describe, expect, it } from 'vitest';
import {
  accountsSignInUrl,
  authHrefWithReturn,
  guestReturnHref,
  POST_AUTH_DEFAULT,
  POST_AUTH_SIGNIN_DEFAULT,
  messageOf,
  resolvePostAuthDestination,
} from '@/components/chrome/auth-shared';

// resolvePostAuthDestination decides where the sign-in and sign-up
// pages send a verified user. Routes are clean now (no `/live` prefix —
// the router selects the live app by route), so a safe redirect is any
// same-origin PATH; the guard blocks off-origin (open redirect) and the
// auth pages (loop). Wrong here means an open redirect (a security row)
// or a redirect loop back to auth.
//
// Both call sites pass next/navigation's ReadonlyURLSearchParams;
// the function reads only `.get(key)`, so plain URLSearchParams
// stands in fine here.

const params = (qs: string) => new URLSearchParams(qs);

describe('resolvePostAuthDestination', () => {
  it('returns the default when redirect_url is absent', () => {
    expect(resolvePostAuthDestination(params(''))).toBe(POST_AUTH_DEFAULT);
  });

  it('rejects an off-origin / protocol-relative / backslash redirect (open-redirect guard)', () => {
    expect(resolvePostAuthDestination(params('redirect_url=https://evil.example'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolvePostAuthDestination(params('redirect_url=//evil.example'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolvePostAuthDestination(params('redirect_url=/\\evil.example'))).toBe(
      POST_AUTH_DEFAULT,
    );
    // No leading slash at all -> not a same-origin path.
    expect(resolvePostAuthDestination(params('redirect_url=evil.example'))).toBe(POST_AUTH_DEFAULT);
  });

  // Browsers strip tab / newline / CR inside a URL, so these resolve to
  // `//evil.example` once navigated.
  it('rejects control characters that the browser strips into //host', () => {
    for (const qs of [
      'redirect_url=/%09/evil.example',
      'redirect_url=/%0A/evil.example',
      'redirect_url=/%0D/evil.example',
      'redirect_url=/%20/evil.example',
      'redirect_url=/x%5C..%5C/evil.example',
    ]) {
      expect(resolvePostAuthDestination(params(qs)), qs).toBe(POST_AUTH_DEFAULT);
    }
  });

  it('keeps an ordinary in-app path with a query and hash', () => {
    expect(resolvePostAuthDestination(params('redirect_url=/design/abc%3Fs%3Dx%23t%3D1'))).toBe(
      '/design/abc?s=x#t=1',
    );
  });

  it('refuses a redirect back to the auth pages (loop guard, case-insensitive)', () => {
    expect(resolvePostAuthDestination(params('redirect_url=/sign-in'))).toBe(POST_AUTH_DEFAULT);
    expect(resolvePostAuthDestination(params('redirect_url=/sign-in?foo=bar'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolvePostAuthDestination(params('redirect_url=/Get-Started?onboarding=1'))).toBe(
      POST_AUTH_DEFAULT,
    );
  });

  it('returns a safe same-origin path as-is (clean routing, no basePath strip)', () => {
    expect(resolvePostAuthDestination(params('redirect_url=/design/abc'))).toBe('/design/abc');
    expect(resolvePostAuthDestination(params('redirect_url=/explorer/recent'))).toBe(
      '/explorer/recent',
    );
    expect(resolvePostAuthDestination(params('redirect_url=/new?folder=f1'))).toBe(
      '/new?folder=f1',
    );
  });
});

// authHrefWithReturn is the OTHER half of the round-trip: every Sign in
// / Create account trigger builds its href with it, so the user returns
// where they started. It MUST apply the same safety rules the resolver
// consumes with (isSafeInternalPath) — otherwise a trigger could emit a
// redirect_url the page then rejects (silent surprise) or, worse, an
// open redirect. These pin that the builder drops exactly what the
// resolver would refuse, and encodes what it keeps.
describe('authHrefWithReturn', () => {
  it('appends a safe same-origin return path as an encoded ?redirect_url', () => {
    expect(authHrefWithReturn('/sign-in/', '/explorer/recent')).toBe(
      '/sign-in/?redirect_url=%2Fexplorer%2Frecent',
    );
    // Query + hash survive so you land on the exact design tab.
    expect(authHrefWithReturn('/get-started/', '/design/abc?x=1#t=t2')).toBe(
      '/get-started/?redirect_url=%2Fdesign%2Fabc%3Fx%3D1%23t%3Dt2',
    );
  });

  it('round-trips through the resolver back to the original path', () => {
    const href = authHrefWithReturn('/sign-in/', '/design/abc?x=1');
    const qs = href.slice(href.indexOf('?') + 1);
    expect(resolvePostAuthDestination(new URLSearchParams(qs), POST_AUTH_SIGNIN_DEFAULT)).toBe(
      '/design/abc?x=1',
    );
  });

  it('drops an unsafe / off-origin / auth-loop return path (bare auth href, no param)', () => {
    expect(authHrefWithReturn('/sign-in/', 'https://evil.example')).toBe('/sign-in/');
    expect(authHrefWithReturn('/sign-in/', '//evil.example')).toBe('/sign-in/');
    expect(authHrefWithReturn('/sign-in/', '/\\evil.example')).toBe('/sign-in/');
    expect(authHrefWithReturn('/sign-in/', 'evil.example')).toBe('/sign-in/');
    // Loop guard: never point an auth page back at an auth page.
    expect(authHrefWithReturn('/get-started/', '/sign-in?foo=bar')).toBe('/get-started/');
  });

  it('returns the bare auth path for a null / undefined / empty return path', () => {
    expect(authHrefWithReturn('/sign-in/', null)).toBe('/sign-in/');
    expect(authHrefWithReturn('/sign-in/', undefined)).toBe('/sign-in/');
    expect(authHrefWithReturn('/get-started/', '')).toBe('/get-started/');
  });
});

// The account dialogs show an api failure's own message, else a fallback, never nothing.
describe('messageOf', () => {
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
  });

  it('still lets a valid redirect_url win over the sign-in default', () => {
    // A protected-page bounce must return where it came from, not the
    // Explorer, even on the sign-in flow.
    expect(
      resolvePostAuthDestination(params('redirect_url=/design/abc'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/design/abc');
  });

  it('falls back to the Explorer for an unsafe / auth-loop redirect_url', () => {
    expect(
      resolvePostAuthDestination(
        params('redirect_url=https://evil.example'),
        POST_AUTH_SIGNIN_DEFAULT,
      ),
    ).toBe('/explorer');
    expect(
      resolvePostAuthDestination(params('redirect_url=/sign-in'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/explorer');
  });

  it('leaves the sign-up flow (no default arg) on the welcome flow (/new)', () => {
    expect(resolvePostAuthDestination(params(''))).toBe(POST_AUTH_DEFAULT);
  });
});

// The hand-off to the accounts site goes through this app's api, carrying the destination it was given.
describe('accountsSignInUrl', () => {
  it('starts the sign-in at the api with the destination encoded', () => {
    const consent = '/oauth/consent/?session=abc123&client=Claude#t=1';
    expect(accountsSignInUrl(consent)).toBe(
      `/api/auth/sign-in?return_to=${encodeURIComponent(consent)}`,
    );
  });
});

// The header's guest way out (docs/specs/014-identity/auth-and-guest-access.md "The look: Night Band"): back where
// the visitor came from when that works without an account, else the new-design flow. Wrong here sends a guest
// off-site (open redirect) or into a loop between a connect page and sign-in.
describe('guestReturnHref', () => {
  it('returns to a safe redirect_url', () => {
    expect(guestReturnHref(params('redirect_url=%2Fd%2Fabc%3Fx%3D1%23t%3D2'))).toBe(
      '/d/abc?x=1#t=2',
    );
  });

  it('falls back to the new-design flow without one', () => {
    expect(guestReturnHref(params(''))).toBe(POST_AUTH_DEFAULT);
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/',
    '/sign-in/',
    '/get-started',
  ])('refuses an unsafe or auth-page redirect_url (%s)', (redirect) => {
    expect(guestReturnHref(params(`redirect_url=${encodeURIComponent(redirect)}`))).toBe(
      POST_AUTH_DEFAULT,
    );
  });

  it.each([
    '/oauth/consent?session=s',
    '/oauth/device',
    '/workbench/pair?code=c',
    '/OAuth/consent',
  ])('never sends a guest back to a signed-in-only page (%s)', (redirect) => {
    expect(guestReturnHref(params(`redirect_url=${encodeURIComponent(redirect)}`))).toBe(
      POST_AUTH_DEFAULT,
    );
  });

  it('keeps a page that only starts with the same letters', () => {
    expect(guestReturnHref(params('redirect_url=%2Foauthors'))).toBe('/oauthors');
  });
});
