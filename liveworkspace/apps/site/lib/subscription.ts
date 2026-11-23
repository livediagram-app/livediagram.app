// How this site's pages reach liveworkspace's subscription service (liveworkspace/docs/specs/019-subscription/
// subscription.md "A person's browser"): the account's access token, and the service's origin, which is this page's
// own on liveworkspace.app and liveworkspace.app's from the Explorer on an app's address.

import type { SubscriptionAccess } from '@liveworkspace/settings-ui';
import { signInHref } from './accounts';
import { pageApp, workspaceOrigin } from './explorer/page-app';

/** The signed-in account's token, or null for a guest. Asked for when a request goes out, and its code fetched then
 *  too: the header is on every page, and the token's module stays out of it. */
export async function subscriptionToken(): Promise<string | null> {
  const { workspaceIdentity } = await import('./explorer/token');
  const identity = await workspaceIdentity();
  return identity?.kind === 'account' ? identity.token : null;
}

/** Where the service is, from this page: nothing to add on liveworkspace.app itself. */
export function subscriptionOrigin(): string {
  return pageApp() ? workspaceOrigin() : '';
}

/** Signing in from an upgrade, back to where the person was. */
export function subscriptionSignInHref(returnTo: string): string {
  const url = new URL(returnTo, window.location.href);
  return signInHref(url.pathname + url.search);
}

/** The Settings panel's Subscription category, over this site's account. */
export const SITE_SUBSCRIPTION: SubscriptionAccess = {
  getToken: subscriptionToken,
  origin: subscriptionOrigin,
  signInHref: subscriptionSignInHref,
};

/**
 * Looking at another currency while developing (subscription.md "Price": the service takes `?currency=` in
 * development and staging, and ignores it in production). A page opened as `/pricing?currency=USD` hands the same
 * word on with every request it makes of the service, so each currency's prices can be seen without changing
 * country. A production build has none of this: it is `undefined` there, and the provider uses the browser's own
 * fetch.
 */
export const subscriptionFetch: typeof fetch | undefined =
  process.env.NODE_ENV === 'production'
    ? undefined
    : (input, init) => {
        const asked = new URLSearchParams(window.location.search).get('currency');
        if (!asked || typeof input !== 'string') return fetch(input, init);
        const url = new URL(input, window.location.href);
        url.searchParams.set('currency', asked);
        return fetch(url.href, init);
      };
