// Someone saved a canvas they own (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails", "Activity"): liveworkspace's
// onboarding series reads it to tell whether they have made anything yet, and when they were last active, across
// every app. @liveworkspace/index-app's reportOwnerActivity, sent with a canvas's summary push
// (document-room/document-outbox.ts), so at most once a minute a canvas, and once when a canvas is made. For an
// account only; never throws.

import { reportOwnerActivity as reportActivityOf } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';

export function reportOwnerActivity(env: Env, ownerId: string, at: number): Promise<void> {
  return reportActivityOf(accountCredentials(env), ownerId, at);
}
