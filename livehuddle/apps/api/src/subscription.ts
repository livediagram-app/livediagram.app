// liveworkspace's subscription service as this api asks it (liveworkspace/docs/specs/019-subscription/subscription.md
// "The subscription Worker"; docs/specs/012-collaboration/call-minutes.md). One cache of entitlements for the isolate,
// so the rooms of one owner's Spaces share a read. With Pro off the client asks nothing.
import {
  subscriptionClientOf,
  type EntitlementCache,
  type SubscriptionClient,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';

const cache: EntitlementCache = new Map();

export function subscriptionOf(env: SubscriptionEnv): SubscriptionClient {
  // The clock read at each call, so a test's clock moves it.
  return subscriptionClientOf(env, 'livehuddle.app', { cache, now: () => Date.now() });
}

/** Tests only: what the isolate remembers of every owner, dropped, so one test's tier never reaches the next. */
export function forgetEntitlementsForTests(): void {
  cache.clear();
}
