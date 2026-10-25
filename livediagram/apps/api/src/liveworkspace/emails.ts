// Where this app's notification emails go, and its one-time milestones (docs/specs/014-identity/
// transactional-email.md). An app keeps no addresses of its own: liveworkspace answers an account's
// verified address, and keeps which milestone emails this app has already sent
// (liveworkspace/docs/accounts.md "Sign-ups and milestones per app"). Guests have neither.

import {
  accountEmails,
  claimMilestone as claimAccountMilestone,
  type Milestone,
} from '@liveworkspace/auth-client';
import { isAccountIdShape } from '@livediagram/api-schema';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';

// The verified addresses of these accounts, in one accounts call per 100. Guests and accounts without
// a verified address are left out. Never throws: unreachable, nobody is written to.
export async function getOwnerEmails(
  env: Env,
  ownerIds: readonly string[],
): Promise<Record<string, string>> {
  const credentials = accountCredentials(env);
  const ids = ownerIds.filter(isAccountIdShape);
  if (!credentials || ids.length === 0) return {};
  try {
    return await accountEmails(credentials, ids);
  } catch (err) {
    console.warn('[emails] lookup_failed', { ids: ids.length, error: String(err) });
    return {};
  }
}

// Claims a one-time milestone email before it is sent: true for the first claim only, so a burst of
// saves at the milestone sends one. False on any failure, so a doubt never sends twice.
export async function claimMilestone(
  env: Env,
  ownerId: string,
  milestone: Milestone,
): Promise<boolean> {
  const credentials = accountCredentials(env);
  if (!credentials || !isAccountIdShape(ownerId)) return false;
  try {
    return await claimAccountMilestone(credentials, { userId: ownerId, milestone });
  } catch (err) {
    console.warn('[emails] milestone_claim_failed', { milestone, error: String(err) });
    return false;
  }
}
