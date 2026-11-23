// What the provider's hooks answer (liveworkspace/docs/specs/019-subscription/subscription.md "The subscription
// Worker", "A person's browser"). Each is one of a handful of plain states, so a caller draws every one of them.
import type { MeResponse, OwnerView } from '@liveworkspace/subscription';

/** The signed-in person's subscription, usage and teams as the page has them. `off`: Pro is off in this build, or no
 *  SubscriptionProvider is mounted, and nothing was asked. */
export type SubscriptionLoad =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'ready'; me: MeResponse }
  | { status: 'error' };

/** What this person may know of the owner of the item they have open, and which action they may take. */
export type OwnerViewLoad =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'ready'; view: OwnerView }
  | { status: 'error' };

// One object each, so a hook that answers them never changes identity between renders.
export const SUBSCRIPTION_OFF: SubscriptionLoad = { status: 'off' };
export const SUBSCRIPTION_LOADING: SubscriptionLoad = { status: 'loading' };
export const SUBSCRIPTION_SIGNED_OUT: SubscriptionLoad = { status: 'signed_out' };
export const SUBSCRIPTION_ERROR: SubscriptionLoad = { status: 'error' };

export const OWNER_OFF: OwnerViewLoad = { status: 'off' };
export const OWNER_LOADING: OwnerViewLoad = { status: 'loading' };
export const OWNER_SIGNED_OUT: OwnerViewLoad = { status: 'signed_out' };
export const OWNER_ERROR: OwnerViewLoad = { status: 'error' };

/** An owner view however the caller holds it: the hook's answer, the view itself, or nothing yet. */
export type OwnerViewInput = OwnerViewLoad | OwnerView | null | undefined;

/** The view inside `input`, or null while there is none to act on. */
export function ownerViewOf(input: OwnerViewInput): OwnerView | null {
  if (!input) return null;
  if ('status' in input) return input.status === 'ready' ? input.view : null;
  return input;
}
