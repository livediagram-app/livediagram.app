// What the liveworkspace accounts Worker keeps of a signed-in person for livedesign
// (liveworkspace/docs/specs/003-accounts/accounts.md "Sign-ups and milestones per app" and "Onboarding emails"): whether
// livedesign has seen the account before (its sign-ups), the one-time milestone emails it has claimed,
// and where its notification emails go. When the person last saved something they own is reported with each
// design's summary push (design-room/design-outbox.ts, @liveworkspace/index-app reportOwnerActivity).
//
// All of these are account-only: a guest has no address, no sign-up and no milestones.

import {
  accountEmails,
  claimMilestone,
  recordSighting,
  type Milestone,
} from '@liveworkspace/auth-client';
import type { Env } from '../types';
import { accountsClient, isAccountOwner } from './client';

// Records that livedesign has seen this account. True only the first time, which counts as a sign-up.
// Null when there is no accounts Worker, or it couldn't be reached (logged): the caller counts nothing.
export async function recordAccountSighting(env: Env, userId: string): Promise<boolean | null> {
  const client = accountsClient(env);
  if (!client || !isAccountOwner(userId)) return null;
  try {
    return await recordSighting(client, userId);
  } catch (err) {
    console.warn('[accounts] sighting_failed', err instanceof Error ? err.message : 'unknown');
    return null;
  }
}

// Claims a one-time milestone email before it is sent: true for the first claim only, so a burst of saves
// at the milestone sends one. False when already claimed, for a guest, or when it can't be claimed now.
export async function claimAccountMilestone(
  env: Env,
  userId: string,
  milestone: Milestone,
): Promise<boolean> {
  const client = accountsClient(env);
  if (!client || !isAccountOwner(userId)) return false;
  try {
    return await claimMilestone(client, { userId, milestone });
  } catch (err) {
    console.warn('[accounts] milestone_claim_failed', {
      milestone,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return false;
  }
}

// The verified addresses of these people, in one request per 100 accounts. Guests and accounts without a
// verified address are left out, and so is everyone when the accounts Worker can't be reached (logged):
// notification emails are best-effort.
export async function emailsOf(env: Env, ids: Iterable<string>): Promise<Map<string, string>> {
  const client = accountsClient(env);
  const accounts = [...new Set(ids)].filter(isAccountOwner);
  if (!client || accounts.length === 0) return new Map();
  try {
    return new Map(Object.entries(await accountEmails(client, accounts)));
  } catch (err) {
    console.warn('[accounts] emails_failed', err instanceof Error ? err.message : 'unknown');
    return new Map();
  }
}

export async function emailOf(env: Env, id: string): Promise<string | null> {
  return (await emailsOf(env, [id])).get(id) ?? null;
}
