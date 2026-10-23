// Server-side Session·SignedUp / Session·SignedIn (docs/specs/017-telemetry/telemetry.md).
//
// Counted where a sign-in completes: the /api/auth/callback that swaps the
// accounts Worker's code for tokens (routes/auth.ts). That runs exactly once
// per completed sign-in, so token refreshes, reloads and autosaves never count.
//
//   - An account this worker has never seen is a sign-up: count SignedUp, and
//     NOT SignedIn as well.
//   - Otherwise it is a sign-in of an existing account: count SignedIn.
//
// "Never seen" is per app: an account made on livedocuments that signs in to
// livediagram for the first time counts as a livediagram sign-up.

import type { Env } from '../types';
import { recordAccountSighting } from '../db/auth-sightings';
import { reportServerEvent, telemetryEnabled } from '../server-telemetry';

type AuthSighting = 'SignedUp' | 'SignedIn' | null;

// Records the sighting and reports the event it amounts to. Returns what was
// counted, for tests. Never throws.
export async function reportSignIn(env: Env, userId: string): Promise<AuthSighting> {
  if (!telemetryEnabled(env)) return null;
  try {
    const action = (await recordAccountSighting(env, userId)) ? 'SignedUp' : 'SignedIn';
    await reportServerEvent(env, 'Session', action);
    return action;
  } catch {
    return null;
  }
}
