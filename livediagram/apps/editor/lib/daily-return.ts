// Once-per-UTC-day "returning visitor" signal (docs/specs/017-telemetry/telemetry.md): `Participant`/`Returned`,
// typed `Anonymous` (guest) or `Authenticated` (signed in), the counterpart to `Participant`/`Created` (the
// new-visitor signal). It goes through the shared gate (@liveworkspace/telemetry-client createDailyReturn) on this
// app's `livediagram:v2:last-active-day` key: at most once per browser per UTC day, and nothing on a browser's first
// observed day, which is a new visitor rather than a return.
//
// Called from every app-open bootstrap here (editor `useIdentityBootstrap`, `/new`). The Explorer at /explorer is
// liveworkspace's page served on this address, and runs the same gate on the same key
// (liveworkspace/apps/site/lib/explorer/daily-return.ts), so the first open of the day wins wherever it happens: a
// user who lands on the Explorer and then the editor counts once, and one who only opens the Explorer still counts.

import { createDailyReturn } from '@liveworkspace/telemetry-client';
import { LOCAL_IDENTITY_KEYS } from './local-identity';
import { track } from './telemetry';

export const trackDailyReturn = createDailyReturn({
  storageKey: LOCAL_IDENTITY_KEYS.lastActiveDay,
  report: (authenticated) =>
    track('Participant', 'Returned', authenticated ? 'Authenticated' : 'Anonymous'),
});
