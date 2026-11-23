// The service's one budget (wrangler.toml SUBSCRIPTION_RATE_LIMITER), for the routes whose callers are not an app's
// Worker: the mock provider's pages, which anyone holding a link may call, and starting a checkout or opening the
// portal. Counted at Cloudflare's edge, so it holds across isolates. Absent, everything is allowed.

import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import type { Env } from './env';

/** Whether `key` is within its budget. */
export async function withinBudget(env: Env, key: string): Promise<boolean> {
  if (!env.SUBSCRIPTION_RATE_LIMITER) return true;
  return (await env.SUBSCRIPTION_RATE_LIMITER.limit({ key })).success;
}

/** The budget key of an anonymous caller: its network. */
export function networkKey(request: Request): string {
  return `net:${clientRateKey(request)}`;
}
