// The mock billing portal's words (liveworkspace/docs/specs/019-subscription/subscription.md "States").
import {
  formatPrice,
  SubscriptionRequestError,
  TIER_NAMES,
  type MockPortal,
  type MockPortalAction,
  type SubscriptionState,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';
import { formatDay } from '@liveworkspace/subscription-ui';

export const STATE_LABEL: Record<SubscriptionState, string> = {
  active: 'Active',
  cancelling: 'Cancelling',
  past_due: 'Payment Failed',
  ended: 'Ended',
};

/** What the state means for this subscription, in one sentence. */
export function stateSentence(summary: SubscriptionSummary): string {
  const tier = TIER_NAMES[summary.tier];
  const ends = summary.periodEnd !== null ? formatDay(summary.periodEnd) : null;
  switch (summary.state) {
    case 'active':
      return ends ? `Paid and renewing. The next payment is on ${ends}.` : 'Paid and renewing.';
    case 'cancelling':
      return ends
        ? `Cancelled. Its limits stay until ${ends}, and it won’t renew.`
        : 'Cancelled. It won’t renew.';
    case 'past_due':
      return summary.graceEnds !== null
        ? `The last renewal failed. ${tier} stays on until ${formatDay(summary.graceEnds)}.`
        : 'The last renewal failed.';
    default:
      return 'This subscription has ended, and its owner is on Free. Subscribe again from Settings, under Subscription.';
  }
}

/** What a subscription costs a month in all: "£36 a month". Null once it has ended. */
export function monthly(summary: SubscriptionSummary): string | null {
  if (summary.amount === null || summary.currency === null) return null;
  return `${formatPrice(summary.amount, summary.currency)} a month`;
}

/** One seat's price, from the month's total. */
export function seatPrice(summary: SubscriptionSummary): string | null {
  if (summary.amount === null || summary.currency === null || summary.seats <= 0) return null;
  return formatPrice(summary.amount / summary.seats, summary.currency);
}

/** Why an action did not happen: the service's own refusal in plain words, else the connection. */
const REFUSED: Record<string, string> = {
  invalid_state:
    'That can’t be done to this subscription as it is now. A renewal, for one, is only taken within a few days of the period’s end.',
  not_subscribed: 'There is no subscription here to change.',
  not_team_admin: 'Only an admin of this team can change its billing, and you are no longer one.',
  accounts_unavailable:
    'Couldn’t confirm you’re an admin of this team just now. Try again in a moment.',
  bad_request: 'That change wasn’t understood. Seats are a whole number from 3 to 200.',
  rate_limited: 'Too many changes in a row. Wait a minute and try again.',
};

export function actionRefused(error: unknown): string {
  const code = error instanceof SubscriptionRequestError ? error.code : '';
  return REFUSED[code] ?? 'That didn’t go through. Check your connection and try again.';
}

/** Under the subscription, beside Cancel or Resume: what pressing it means from the state it is in. */
export function cancelNote(summary: SubscriptionSummary): string {
  if (summary.state === 'cancelling') return 'Changed your mind? Resume, and it renews as before.';
  if (summary.state === 'past_due' && summary.graceEnds !== null)
    return `Cancelling keeps everything on until ${formatDay(summary.graceEnds)}, and nothing more is charged. Nothing is deleted.`;
  return 'Cancelling keeps everything on until the end of the month paid for. Nothing is deleted.';
}

export type ActionSaid = { tone: 'success' | 'info' | 'warning'; text: string };

/**
 * What an action did, for the page's status line: the one thing that changed, in the tone of where it left the
 * subscription (a failed renewal is a warning, never a success). The card under it says where the subscription
 * stands now, so the line never repeats that.
 */
export function actionDone(action: MockPortalAction, portal: MockPortal): ActionSaid {
  const { subscription } = portal;
  const tier = TIER_NAMES[subscription.tier];
  const ended = subscription.state === 'ended' || subscription.state === null;
  switch (action) {
    case 'cancel':
      return { tone: 'info', text: 'Cancelled. Nothing more will be charged.' };
    case 'resume':
      return subscription.state === 'past_due'
        ? { tone: 'warning', text: 'Resumed. The failed payment still needs to go through.' }
        : { tone: 'success', text: `Resumed. ${tier} renews as before.` };
    case 'fail_payment':
      return { tone: 'warning', text: 'A renewal failed, and grace has begun.' };
    case 'recover_payment':
      return { tone: 'success', text: `The payment went through. ${tier} is paid and renewing.` };
    case 'end_grace':
      return { tone: 'info', text: 'Grace ran out without a payment.' };
    case 'end_period':
      return ended
        ? { tone: 'info', text: 'The period ended, and nothing renewed it.' }
        : { tone: 'info', text: 'The period ended. The renewal is being settled.' };
    case 'renew':
      return { tone: 'success', text: 'Renewed for another month.' };
    default:
      return {
        tone: 'success',
        text: `Seats changed to ${subscription.seats}.`,
      };
  }
}
