// liveworkspace's subscription service as this api asks it (liveworkspace/docs/specs/019-subscription/subscription.md
// "The subscription Worker"; docs/specs/026-plan/blueprints/automations.md "Tiers (Pro)"). One cache of entitlements
// for the isolate, so the rooms of one owner's plans share a read. With Pro off the client asks nothing.
import {
  subscriptionClientOf,
  type EntitlementCache,
  type SubscriptionClient,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';

const cache: EntitlementCache = new Map();

export function subscriptionOf(env: SubscriptionEnv): SubscriptionClient {
  // The clock read at each call, so a test's clock moves it.
  return subscriptionClientOf(env, 'liveplanner.app', { cache, now: () => Date.now() });
}

/** Tests only: what the isolate remembers of every owner, dropped, so one test's tier never reaches the next. */
export function forgetEntitlementsForTests(): void {
  cache.clear();
}
