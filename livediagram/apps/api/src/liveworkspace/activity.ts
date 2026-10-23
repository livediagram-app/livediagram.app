// Someone saved a document they own (liveworkspace/docs/accounts.md "Onboarding emails",
// "Activity"): liveworkspace's onboarding series reads it to tell whether they have made anything
// yet, and when they were last active, across every app. It replaces the document save times this app
// used to read for its own series.
//
// At most once a minute a document per isolate, as liveworkspace asks: an editor autosaves every
// ~600 ms, and the rest of those saves cost nothing but a map lookup.

import { reportActivity } from '@liveworkspace/auth-client';
import { isAccountIdShape } from '@livediagram/api-schema';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';

export const ACTIVITY_REPORT_INTERVAL_MS = 60_000;
// Documents remembered per isolate; the oldest go first. A forgotten one only reports again sooner.
const REMEMBERED_MAX = 5000;
const lastReported = new Map<string, number>();

// Test seam.
export function __resetActivityReports(): void {
  lastReported.clear();
}

// The promise to hand to waitUntil, or null when there is nothing to send: a guest, a deployment
// without sign-in, or a document reported within the last minute. Never rejects.
export function reportOwnerActivity(
  env: Env,
  ownerId: string,
  documentId: string,
  now = Date.now(),
): Promise<void> | null {
  if (!isAccountIdShape(ownerId)) return null;
  const credentials = accountCredentials(env);
  if (!credentials) return null;
  const last = lastReported.get(documentId);
  if (last !== undefined && now - last < ACTIVITY_REPORT_INTERVAL_MS) return null;
  lastReported.delete(documentId);
  if (lastReported.size >= REMEMBERED_MAX) {
    const oldest = lastReported.keys().next().value;
    if (oldest !== undefined) lastReported.delete(oldest);
  }
  lastReported.set(documentId, now);
  return reportActivity(credentials, { userId: ownerId, at: now }).catch((err: unknown) => {
    // Let the next save try again rather than waiting out the minute.
    lastReported.delete(documentId);
    console.warn('[activity] report_failed', String(err));
  });
}
