// Pro at the service (liveworkspace/docs/specs/006-media/media.md "With Pro on"): the limits an upload meets, read from
// the subscription service with this Worker's own key. With PRO_ENABLED off every function here answers "nothing
// changes" without a request: the caller keeps the caps from its [vars].

import { MEDIA_ITEM_OWNER_HEADER, payerLimits, type PayerLimits } from '@liveworkspace/media';
import { subscriptionClientOf, type SubscriptionClient } from '@liveworkspace/subscription';
import type { Env } from './env';

export function subscriptionOf(env: Env): SubscriptionClient {
  return subscriptionClientOf(env, 'liveworkspace.app');
}

/** Whether Pro is on here: off, nothing is asked of the subscription service and no limit is read. */
export function proOn(env: Env): boolean {
  return subscriptionOf(env).enabled;
}

/**
 * The limits `owner`'s upload meets: what they keep by their own tier, and one upload's size or length by the better
 * of their own and the tier of the item's owner the app named in X-Media-Item-Owner. Null with Pro off. Only owners are read from the request, never a tier, and the header is the
 * app's own (its key was checked before this is reached).
 */
export function uploadLimits(
  env: Env,
  request: Request,
  owner: string,
): Promise<PayerLimits | null> {
  return payerLimits(subscriptionOf(env), owner, request.headers.get(MEDIA_ITEM_OWNER_HEADER));
}

/** The limits of `owner`'s own tier alone (their gallery, a copy into it). Null with Pro off. */
export function ownLimits(env: Env, owner: string): Promise<PayerLimits | null> {
  return payerLimits(subscriptionOf(env), owner, null);
}
