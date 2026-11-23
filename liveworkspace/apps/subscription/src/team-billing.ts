// Who may change a team's billing (subscription.md "Billing"): its admins, as accounts has them at this moment.

import { parseOwnerScope, type OwnerScope } from '@liveworkspace/subscription';
import type { Env } from './env';
import { refusal } from './http';
import { teamAdminNow } from './seats';

/**
 * Why `userId` may not change a team's billing now, or null when they may (and for a person's own). The token's
 * claim is up to fifteen minutes old, so accounts is asked: someone no longer an admin is refused, and when accounts
 * cannot say the request is refused to be tried again, never let through on the claim.
 */
export async function teamBillingRefusal(
  env: Env,
  owner: OwnerScope,
  userId: string,
  now: number,
): Promise<Response | null> {
  const parsed = parseOwnerScope(owner);
  if (parsed?.kind !== 'team') return null;
  const standing = await teamAdminNow(env, parsed.id, userId, now);
  if (standing === 'admin') return null;
  return standing === 'not_admin'
    ? refusal('not_team_admin')
    : refusal('accounts_unavailable', { 'Retry-After': '5' });
}
