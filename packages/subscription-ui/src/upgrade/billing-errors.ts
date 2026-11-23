// What to say when the subscription service refuses a checkout or the billing portal (the contract's
// SUBSCRIPTION_ERRORS), or cannot be reached.
import { SubscriptionRequestError } from '@liveworkspace/subscription';

const REFUSALS: Record<string, string> = {
  unauthorised: 'You’re signed out. Sign in and try again.',
  not_team_admin: 'Only a team admin can subscribe this team or manage its billing.',
  already_subscribed: 'This is already subscribed. Use Manage Billing to change it.',
  not_subscribed: 'There is no subscription here to manage yet.',
  billing_unavailable: 'Subscriptions can’t be bought or changed here yet. Nothing was charged.',
  accounts_unavailable:
    'Couldn’t confirm you’re an admin of this team just now. Try again in a moment.',
  invalid_state:
    'That can’t be done to this subscription as it is now. Reload the page to see where it stands.',
  rate_limited: 'Too many tries in a row. Wait a minute and try again.',
};

export function billingErrorMessage(error: unknown): string {
  const code = error instanceof SubscriptionRequestError ? error.code : '';
  return REFUSALS[code] ?? 'Couldn’t reach billing. Check your connection and try again.';
}
