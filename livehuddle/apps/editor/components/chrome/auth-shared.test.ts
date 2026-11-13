import { describe, expect, it } from 'vitest';
import { guestReturnHref, POST_AUTH_DEFAULT } from '@/components/chrome/auth-shared';

// The rest of the auth return-path rules are the workbench's (components/chrome/auth-routes, tested there); this
// editor has its own guest way out.
const params = (qs: string) => new URLSearchParams(qs);

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

  // livehuddle has no signed-in-only connect pages (docs/specs/014-identity/auth-and-guest-access.md "The look"):
  // every safe page is one a guest can go back to.
  it('sends a guest back to any safe page', () => {
    expect(guestReturnHref(params('redirect_url=%2Foauthors'))).toBe('/oauthors');
    expect(guestReturnHref(params('redirect_url=%2Fexplorer%2F'))).toBe('/explorer/');
  });
});
