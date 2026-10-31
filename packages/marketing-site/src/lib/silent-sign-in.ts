import { silentCookiesForHint, silentSignInBootScript } from '@liveworkspace/auth-client/silent';

// Signing in without a click on a marketing page (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in
// without a click"): someone signed in to liveworkspace who opens a product's landing page, or any page of its
// marketing site, is signed in there too, as its editor already does. The same shared script and guards as the
// editor's (once per tab, never for a crawler, an audit or an automated browser, never in a frame, never with a
// session here or after signing out of this app alone), with one difference: it waits until the page has painted,
// loaded and gone idle, and only bounces while the visitor hasn't started using the page. A guest's first look at
// the product paints at full speed, and the bounce stays out of its Largest Contentful Paint.
//
// Inlined in each marketing app's root layout, right after Trusted Types; `hint` is the product's
// `<prefix>signed_in` cookie. The API is on the page's own site behind the product's router, as in production.
export function marketingSilentSignInScript(hint: string): string {
  return silentSignInBootScript({
    apiBase: '/api',
    cookies: silentCookiesForHint(hint),
    skipPaths: [],
    afterPaint: true,
  });
}
