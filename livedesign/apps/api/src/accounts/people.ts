// What the liveworkspace accounts Worker keeps of a signed-in person for livedesign
// (liveworkspace/docs/accounts.md "Sign-ups and milestones per app" and "Onboarding emails"): whether
// livedesign has seen the account before (its sign-ups), the one-time milestone emails it has claimed,
// where its notification emails go, and when the person last saved something they own.
//
// All of these are account-only: a guest has no address, no sign-up and no milestones.

import {
  accountEmails,
  claimMilestone,
  recordSighting,
  reportActivity,
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

// How often one item's saves are reported: the accounts Worker asks for at most one a minute an item. A
// person editing autosaves every ~600 ms, so this is what keeps it to one request a minute.
export const ACTIVITY_REPORT_EVERY_MS = 60_000;
// Items remembered per isolate; the oldest go first. Safe range 100..10 000.
export const ACTIVITY_MEMORY_MAX = 2000;
const reportedAt = new Map<string, number>();

// Someone saved a design they own: tells the accounts Worker, which sends the onboarding series and needs
// to know whether they have made anything yet and when they were last active. At most once a minute a
// design per isolate. Best-effort, off the response path.
export async function reportOwnerActivity(
  env: Env,
  userId: string,
  designId: string,
  now = Date.now(),
): Promise<void> {
  const client = accountsClient(env);
  if (!client || !isAccountOwner(userId)) return;
  const key = `${userId} ${designId}`;
  const last = reportedAt.get(key);
  if (last !== undefined && now - last < ACTIVITY_REPORT_EVERY_MS) return;
  reportedAt.delete(key);
  if (reportedAt.size >= ACTIVITY_MEMORY_MAX) {
    const oldest = reportedAt.keys().next().value;
    if (oldest !== undefined) reportedAt.delete(oldest);
  }
  reportedAt.set(key, now);
  try {
    await reportActivity(client, { userId, at: now });
  } catch (err) {
    console.warn('[accounts] activity_failed', err instanceof Error ? err.message : 'unknown');
  }
}

// Test seam: forget which designs' activity was reported.
export function __forgetActivity(): void {
  reportedAt.clear();
}
