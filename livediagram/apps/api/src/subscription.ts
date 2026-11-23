// liveworkspace's subscription service as this api asks it (liveworkspace/docs/specs/019-subscription/subscription.md
// "The subscription Worker"; docs/specs/021-event-storming/note-reader.md "AI credits (Pro)"). One cache of
// entitlements for the isolate. With Pro off the client asks nothing.
import {
  subscriptionClientOf,
  type EntitlementCache,
  type SubscriptionClient,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';

const cache: EntitlementCache = new Map();

export function subscriptionOf(env: SubscriptionEnv): SubscriptionClient {
  // The clock read at each call, so a test's clock moves it.
  return subscriptionClientOf(env, 'livediagram.app', { cache, now: () => Date.now() });
}
