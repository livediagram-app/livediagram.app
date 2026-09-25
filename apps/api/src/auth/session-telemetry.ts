// Server-side Session·SignedUp / Session·SignedIn (spec/22).
//
// These used to be emitted by the browser, and only on the email-code paths:
// a Google sign-up or sign-in finishes inside Clerk's OAuth redirect
// (/sso-callback), which had no emit, so most new accounts were never counted.
// Rather than chase every auth UI, the api worker counts from what it can
// verify: the Clerk session token on each request.
//
// The rule, one event per completed authentication, whatever the method:
//   - A session id (`sid`) the worker has never seen means somebody just
//     finished signing in or signing up (Clerk mints a new session for each).
//   - If that session's ACCOUNT has also never been seen, it is a sign-up:
//     count SignedUp, and NOT SignedIn as well.
//   - Otherwise it is a sign-in of an existing account: count SignedIn.
//   - A session already seen counts nothing, so token refreshes, reloads and
//     every autosave are free.
//   - A new-to-us session whose first factor was verified more than
//     FRESH_SIGN_IN_MINUTES ago is not a fresh authentication (a session that
//     predates this counting, or one that outlived the session-row retention),
//     so it is recorded silently. The `fva` claim may be absent; then the
//     session is taken as fresh.

import type { Env } from '../types';
import { recordAccountSighting, recordSessionSighting } from '../db/auth-sightings';
import { reportServerEvent, telemetryEnabled } from '../server-telemetry';
import type { ClerkIdentity } from './clerk';

export const FRESH_SIGN_IN_MINUTES = 60;

export type AuthSighting = 'SignedUp' | 'SignedIn' | null;

// Records the sighting and reports the event it amounts to. Returns what was
// counted, for tests. Never throws.
export async function reportAuthSighting(env: Env, identity: ClerkIdentity): Promise<AuthSighting> {
  if (!telemetryEnabled(env) || !identity.sessionId) return null;
  try {
    // Session first: only the request that creates the session row may count,
    // so concurrent first requests of one session can't double count.
    if (!(await recordSessionSighting(env, identity.sessionId))) return null;
    const newAccount = await recordAccountSighting(env, identity.userId);
    const age = identity.firstFactorAgeMinutes;
    if (age !== null && age > FRESH_SIGN_IN_MINUTES) return null;
    const action = newAccount ? 'SignedUp' : 'SignedIn';
    await reportServerEvent(env, 'Session', action);
    return action;
  } catch {
    return null;
  }
}

// Session ids already handled by this isolate, so a signed-in editor's
// autosaves don't each pay an INSERT OR IGNORE. Bounded: cleared rather than
// grown forever in a long-lived isolate (a cleared id just costs one more
// idempotent write).
const sightedThisIsolate = new Set<string>();
const ISOLATE_MEMO_CAP = 10_000;

// Called once per request from the worker entry with the verified identity.
// Schedules the sighting off the response path; a no-op for guests, for
// sessions this isolate already saw, and when telemetry is off.
export function noteAuthSighting(
  env: Env,
  identity: ClerkIdentity | null,
  waitUntil: ((p: Promise<unknown>) => void) | undefined,
): void {
  if (!identity?.sessionId || !telemetryEnabled(env) || !waitUntil) return;
  if (sightedThisIsolate.has(identity.sessionId)) return;
  if (sightedThisIsolate.size >= ISOLATE_MEMO_CAP) sightedThisIsolate.clear();
  sightedThisIsolate.add(identity.sessionId);
  waitUntil(reportAuthSighting(env, identity));
}
