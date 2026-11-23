// The mock billing provider's pages (liveworkspace/docs/specs/019-subscription/subscription.md "Billing") talk to
// the subscription service on this origin. A session's id is an unguessable token, as a hosted checkout's link is, so
// these calls carry no account: whoever holds the link is the one paying.
import {
  createSubscriptionBrowserClient,
  SubscriptionRequestError,
} from '@liveworkspace/subscription';

export const mockBilling = createSubscriptionBrowserClient({ getToken: async () => null });

/** The session in the page's address (`?session=`), or null with none. */
export function sessionFrom(search: string): string | null {
  const session = new URLSearchParams(search).get('session');
  return session && session.trim() ? session : null;
}

/** Whether the service said there is no such session (unknown, finished or lapsed). */
export function isGone(error: unknown): boolean {
  return (
    error instanceof SubscriptionRequestError && (error.status === 404 || error.status === 410)
  );
}

/** Leaves for the address the service handed back (the app the person came from). */
export function leaveTo(url: string): void {
  window.location.assign(url);
}
