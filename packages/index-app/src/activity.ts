// The owner's newest save, reported to the liveworkspace accounts Worker for its onboarding series (whether they
// have made anything yet, and when they were last active, in any app): liveworkspace/docs/specs/003-accounts/accounts.md
// "Onboarding emails". Sent with an item's summary push (outbox.ts `onSummary`), so at most once a minute an item.
// For an account only; never throws.

import { isAccountId, reportActivity, type ClientCredentials } from '@liveworkspace/auth-client';

export async function reportOwnerActivity(
  credentials: ClientCredentials | null,
  ownerId: string,
  at: number,
): Promise<void> {
  if (!credentials || !isAccountId(ownerId)) return;
  try {
    await reportActivity(credentials, { userId: ownerId, at });
  } catch (error) {
    console.warn('[account-app] activity_failed', { error: String(error) });
  }
}
