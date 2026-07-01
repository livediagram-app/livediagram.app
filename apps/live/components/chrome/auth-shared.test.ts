import { describe, expect, it } from 'vitest';
import {
  authHrefWithReturn,
  POST_AUTH_DEFAULT,
  POST_AUTH_SIGNIN_DEFAULT,
  messageOf,
  resolveOAuthCompleteUrl,
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
    expect(resolvePostAuthDestination(params('redirect_url=/diagram/abc'))).toBe('/diagram/abc');
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
    expect(resolveOAuthCompleteUrl(params('redirect_url=/diagram/abc'))).toBe('/diagram/abc');
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
    // Query + hash survive so you land on the exact diagram tab.
    expect(authHrefWithReturn('/get-started/', '/diagram/abc?x=1#t=t2')).toBe(
      '/get-started/?redirect_url=%2Fdiagram%2Fabc%3Fx%3D1%23t%3Dt2',
    );
  });

  it('round-trips through the resolver back to the original path', () => {
    const href = authHrefWithReturn('/sign-in/', '/diagram/abc?x=1');
    const qs = href.slice(href.indexOf('?') + 1);
    expect(resolvePostAuthDestination(new URLSearchParams(qs), POST_AUTH_SIGNIN_DEFAULT)).toBe(
      '/diagram/abc?x=1',
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
    expect(resolvePostAuthDestination(params(''), POST_AUTH_SIGNIN_DEFAULT)).toBe(
      '/explorer/recent',
    );
    expect(resolveOAuthCompleteUrl(params(''), POST_AUTH_SIGNIN_DEFAULT)).toBe('/explorer/recent');
  });

  it('still lets a valid redirect_url win over the sign-in default', () => {
    // A protected-page bounce must return where it came from, not the
    // Explorer, even on the sign-in flow.
    expect(
      resolvePostAuthDestination(params('redirect_url=/diagram/abc'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/diagram/abc');
    expect(
      resolveOAuthCompleteUrl(params('redirect_url=/diagram/abc'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/diagram/abc');
  });

  it('falls back to the Explorer for an unsafe / auth-loop redirect_url', () => {
    expect(
      resolvePostAuthDestination(
        params('redirect_url=https://evil.example'),
        POST_AUTH_SIGNIN_DEFAULT,
      ),
    ).toBe('/explorer/recent');
    expect(
      resolvePostAuthDestination(params('redirect_url=/sign-in'), POST_AUTH_SIGNIN_DEFAULT),
    ).toBe('/explorer/recent');
  });

  it('leaves the sign-up flow (no default arg) on the welcome flow (/new)', () => {
    expect(resolvePostAuthDestination(params(''))).toBe(POST_AUTH_DEFAULT);
    expect(resolveOAuthCompleteUrl(params(''))).toBe(POST_AUTH_DEFAULT);
  });
});
