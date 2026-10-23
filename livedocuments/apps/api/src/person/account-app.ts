// What the liveworkspace accounts Worker keeps of an account for livedocuments
// (liveworkspace/docs/accounts.md "Sign-ups and milestones per app" and "Onboarding emails"): whether
// livedocuments has seen it (a sign-up), its one-time milestone emails, its verified address, and when
// it last saved something. livedocuments keeps none of these. Each call is for an account only; a
// guest has no address, sign-up or milestone. None of these throw: without the accounts Worker, or
// when it can't be reached, each answers as though there were nothing (and logs).

import {
  accountEmails,
  claimMilestone,
  recordSighting,
  type Milestone,
} from '@liveworkspace/auth-client';
import { reportOwnerActivity as reportActivityOf } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';
import { isAccountOwner } from './owner';

// The verified addresses of these owners, by id: where a notification email goes. Guests and accounts
// with no verified address are left out. One request per 100 accounts, sent together.
export async function ownerEmails(
  env: Env,
  ownerIds: readonly string[],
): Promise<Map<string, string>> {
  const credentials = accountCredentials(env);
  const ids = [...new Set(ownerIds.filter(isAccountOwner))];
  if (!credentials || ids.length === 0) return new Map();
  try {
    return new Map(Object.entries(await accountEmails(credentials, ids)));
  } catch (error) {
    console.warn('[account-app] emails_failed', { count: ids.length, error: String(error) });
    return new Map();
  }
}

export async function ownerEmail(env: Env, ownerId: string): Promise<string | null> {
  return (await ownerEmails(env, [ownerId])).get(ownerId) ?? null;
}

// Claims a one-time milestone email before it is sent: true for the first claim only, so a burst of
// saves at the milestone sends one. False once claimed, for a guest, or when livedocuments has never
// recorded a sighting of the account.
export async function claimOwnerMilestone(
  env: Env,
  ownerId: string,
  milestone: Milestone,
): Promise<boolean> {
  const credentials = accountCredentials(env);
  if (!credentials || !isAccountOwner(ownerId)) return false;
  try {
    return await claimMilestone(credentials, { userId: ownerId, milestone });
  } catch (error) {
    console.warn('[account-app] milestone_claim_failed', { milestone, error: String(error) });
    return false;
  }
}

// Records that livedocuments has seen this account sign in: true only the first time, which counts as a
// livedocuments sign-up. Null when it couldn't be recorded (no accounts Worker, or a failure).
export async function recordOwnerSighting(env: Env, ownerId: string): Promise<boolean | null> {
  const credentials = accountCredentials(env);
  if (!credentials || !isAccountOwner(ownerId)) return null;
  try {
    return await recordSighting(credentials, ownerId);
  } catch (error) {
    console.warn('[account-app] sighting_failed', { error: String(error) });
    return null;
  }
}

// The owner saved something they own at `at`, for liveworkspace's onboarding series: @liveworkspace/index-app's
// reportOwnerActivity, sent with a document's summary push (document-room/document-outbox.ts), so at most once a
// minute a document.
export function reportOwnerActivity(env: Env, ownerId: string, at: number): Promise<void> {
  return reportActivityOf(accountCredentials(env), ownerId, at);
}
