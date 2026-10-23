// Server-side Session·SignedUp / Session·SignedIn (docs/specs/017-telemetry/telemetry.md).
//
// Counted where a sign-in completes: the /api/auth/callback that swaps the
// accounts Worker's code for tokens (routes/auth.ts). That runs exactly once
// per completed sign-in, so token refreshes, reloads and autosaves never count.
//
//   - An account livedesign has never seen is a sign-up: count SignedUp, and
//     NOT SignedIn as well.
//   - Otherwise it is a sign-in of an existing account: count SignedIn.
//
// "Never seen" is per app, and kept by the liveworkspace accounts Worker
// (recordSighting, liveworkspace/docs/accounts.md "Sign-ups and milestones per
// app"): an account made on livediagram that signs in to livedesign for the
// first time counts as a livedesign sign-up. The sighting is recorded whether or
// not telemetry is on, since livedesign's milestone emails can only be claimed
// for an account it has seen.

import type { Env } from '../types';
import { recordAccountSighting } from '../accounts/people';
import { reportServerEvent, telemetryEnabled } from '../server-telemetry';

type AuthSighting = 'SignedUp' | 'SignedIn' | null;

// Records the sighting and reports the event it amounts to. Returns what was
// counted, for tests. Never throws.
export async function reportSignIn(env: Env, userId: string): Promise<AuthSighting> {
  const first = await recordAccountSighting(env, userId);
  if (first === null || !telemetryEnabled(env)) return null;
  const action = first ? 'SignedUp' : 'SignedIn';
  // Swallows its own failure (server-telemetry.ts).
  await reportServerEvent(env, 'Session', action);
  return action;
}
