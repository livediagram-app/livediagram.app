import { describe, expect, it } from 'vitest';
import {
  authHrefWithReturn,
  guestReturnHref,
  POST_AUTH_DEFAULT,
  POST_AUTH_SIGNIN_DEFAULT,
  messageOf,
  resolveOAuthCompleteUrl,
  resolvePostAuthDestination,
  ssoCallbackDestination,
  ssoCallbackUrl,
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
    expect(resolvePostAuthDestination(params('redirect_url=/document/abc%3Fs%3Dx%23t%3D1'))).toBe(
      '/document/abc?s=x#t=1',
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
    expect(resolvePostAuthDestination(params('redirect_url=/document/abc'))).toBe('/document/abc');
    expect(resolvePostAuthDestination(params('redirect_url=/explorer/recent'))).toBe(
      '/explorer/recent',
    );
    expect(resolvePostAuthDestination(params('redirect_url=/new?folder=f1'))).toBe(
      '/new?folder=f1',
    );
  });
});

// OAuth-flavoured form: with clean routing there's no basePath to add,
// so it returns the SAME destination as the router.push form.
describe('resolveOAuthCompleteUrl', () => {
  it('mirrors resolvePostAuthDestination (no /live prefix to add)', () => {
    expect(resolveOAuthCompleteUrl(params(''))).toBe(POST_AUTH_DEFAULT);
    expect(resolveOAuthCompleteUrl(params('redirect_url=https://evil.example'))).toBe(
      POST_AUTH_DEFAULT,
    );
    expect(resolveOAuthCompleteUrl(params('redirect_url=/sign-in'))).toBe(POST_AUTH_DEFAULT);
    expect(resolveOAuthCompleteUrl(params('redirect_url=/document/abc'))).toBe('/document/abc');
    expect(resolveOAuthCompleteUrl(params('redirect_url=/explorer/recent'))).toBe(
      '/explorer/recent',
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
    // Query + hash survive so you land on the exact document tab.
    expect(authHrefWithReturn('/get-started/', '/document/abc?x=1#t=t2')).toBe(
      '/get-started/?redirect_url=%2Fdocument%2Fabc%3Fx%3D1%23t%3Dt2',
    );
  });

  it('round-trips through the resolver back to the original path', () => {
    const href = authHrefWithReturn('/sign-in/', '/document/abc?x=1');
    const qs = href.slice(href.indexOf('?') + 1);
    expect(resolvePostAuthDestination(new URLSearchParams(qs), POST_AUTH_SIGNIN_DEFAULT)).toBe(
      '/document/abc?x=1',
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

  it('falls back when Clerk returns an empty errors array, so a failure never shows no message', () => {
    expect(messageOf({ errors: [] }, 'fallback')).toBe('fallback');
  });

  it("prefers Clerk's longMessage, written for people, over its terse message", () => {
    const err = {
      errors: [{ message: 'is invalid', longMessage: 'Enter a valid email address.' }],
    };
    expect(messageOf(err, 'fallback')).toBe('Enter a valid email address.');
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
    expect(resolveOAuthCompleteUrl(params(''), POST_AUTH_SIGNIN_DEFAULT)).toBe('/explorer');
  });

  it('still lets a valid redirect_url win over the sign-in default', () => {
    // A protected-page bounce must return where it came from, not the
    // Explorer, even on the sign-in flow.
    expect(
      resolvePostAuthDestination(params('redirect_url=/document/abc'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/document/abc');
    expect(
      resolveOAuthCompleteUrl(params('redirect_url=/document/abc'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/document/abc');
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
    expect(resolveOAuthCompleteUrl(params(''))).toBe(POST_AUTH_DEFAULT);
  });
});

// The OAuth callback leg (issue #612): a Google round-trip that ends on
// /sso-callback used to land on a default, dropping an MCP consent mid-connect.
// The destination now rides on the callback URL, through the same guard.
describe('ssoCallbackUrl / ssoCallbackDestination', () => {
  const consent = '/oauth/consent/?session=abc123&client=Claude&to=claude.ai';

  it('carries a safe return path onto the callback and reads it back intact', () => {
    const url = ssoCallbackUrl(params(`redirect_url=${encodeURIComponent(consent)}`));
    expect(url).toBe(`/sso-callback?redirect_url=${encodeURIComponent(consent)}`);
    const back = new URL(url, 'https://livedocuments.app').searchParams;
    expect(ssoCallbackDestination(back)).toBe(consent);
  });

  it('is the bare callback, and no destination, when there is nothing safe to carry', () => {
    for (const qs of [
      '',
      'redirect_url=https://evil.example',
      'redirect_url=//evil.example',
      'redirect_url=/sign-in/',
      'redirect_url=/get-started',
    ]) {
      expect(ssoCallbackUrl(params(qs))).toBe('/sso-callback');
      expect(ssoCallbackDestination(params(qs))).toBeUndefined();
    }
  });
});

// The header's guest way out (docs/specs/014-identity/auth-and-guest-access.md "The look: Night Band"): back where
// the visitor came from when that works without an account, else the new-document flow. Wrong here sends a guest
// off-site (open redirect) or into a loop between a connect page and sign-in.
describe('guestReturnHref', () => {
  it('returns to a safe redirect_url', () => {
    expect(guestReturnHref(params('redirect_url=%2Fd%2Fabc%3Fx%3D1%23t%3D2'))).toBe(
      '/d/abc?x=1#t=2',
    );
  });

  it('falls back to the new-document flow without one', () => {
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
