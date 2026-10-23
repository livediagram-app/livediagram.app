// What the liveworkspace accounts Worker keeps of an account for liveplanner
// (liveworkspace/docs/accounts.md "Sign-ups and milestones per app" and "Onboarding emails"): whether
// liveplanner has seen it (a sign-up), its verified address, and when it last saved something.
// liveplanner keeps none of these. Each call is for an account only; a guest has no address or
// sign-up. None of these throw: without the accounts Worker, or when it can't be reached, each answers
// as though there were nothing (and logs).

import { accountEmails, recordSighting, reportActivity } from '@liveworkspace/auth-client';
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

// Records that liveplanner has seen this account sign in: true only the first time, which counts as a
// liveplanner sign-up. Null when it couldn't be recorded (no accounts Worker, or a failure).
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

// The owner saved something they own at `at`, for liveworkspace's onboarding series (whether they have
// made anything yet, and when they were last active, in any app). Sent at most once a minute a plan,
// with its summary push (plan-room/plan-outbox.ts).
export async function reportOwnerActivity(env: Env, ownerId: string, at: number): Promise<void> {
  const credentials = accountCredentials(env);
  if (!credentials || !isAccountOwner(ownerId)) return;
  try {
    await reportActivity(credentials, { userId: ownerId, at });
  } catch (error) {
    console.warn('[account-app] activity_failed', { error: String(error) });
  }
}
