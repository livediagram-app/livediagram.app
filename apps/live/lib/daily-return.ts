// Once-per-UTC-day "returning visitor" signal (spec/22).
//
// Emits `Participant`/`Returned` with type `Anonymous` (guest) or
// `Authenticated` (signed in) at most once per browser per UTC day,
// gated by the `livediagram:v2:last-active-day` key. It is the
// counterpart to `Participant`/`Created` (the once-per-browser
// new-visitor signal): together they answer "how many people showed up
// today, and how many of them had been here before". Querying
// `Participant`/`Returned` and ignoring the type sums both cohorts.
//
// Called from every app-open bootstrap (editor `useIdentityBootstrap`,
// `/new`, `/explorer`). The date gate makes calling from several entry
// points safe — the first open of the day wins and the rest no-op, so a
// user who lands on the Explorer and then the editor still counts once.
//
// A browser's FIRST observed day only seeds the key and emits nothing:
// a first-ever visit is a new visitor (`Participant`/`Created`), not a
// return. One consequence worth naming: a pre-existing user's first day
// after this ships looks like a first observed day and is skipped, a
// one-day ramp undercount that clears itself the next day.
//
// No identifier ever leaves the browser — the per-day dedup is entirely
// local, consistent with the anonymous-by-construction telemetry model.

import { getLastActiveDay, setLastActiveDay } from './local-identity';
import { track } from './telemetry';

// UTC day (YYYY-MM-DD) so the gate rolls at 00:00 UTC, matching the
// dashboard's `date(ts/1000,'unixepoch')` day bucketing (spec/22).
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function trackDailyReturn(authenticated: boolean): void {
  if (typeof window === 'undefined') return;
  const today = utcDay();
  const last = getLastActiveDay();
  // Already counted this browser today — nothing to do.
  if (last === today) return;
  setLastActiveDay(today);
  // First day we have ever observed this browser: it is a new visitor,
  // not a return. `Participant`/`Created` already covers that, so don't
  // double-signal here.
  if (last === null) return;
  track('Participant', 'Returned', authenticated ? 'Authenticated' : 'Anonymous');
}
