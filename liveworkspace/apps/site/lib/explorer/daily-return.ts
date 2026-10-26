'use client';

// The app's returning visitor (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app"), counted by the
// Explorer on the app's own address the way the app's editor and `/new` count it: `Participant·Returned`, typed
// `Anonymous` (a guest) or `Authenticated`, at most once per browser per UTC day, through the shared gate on the
// app's own `<app>:v2:last-active-day` key (each app's lib/local-identity.ts), so the first open of the day wins
// wherever it happens. On liveworkspace.app, in no app's name, nothing is counted.

import { createDailyReturn } from '@liveworkspace/telemetry-client';
import type { AppName } from '@liveworkspace/sites';
import { pageApp } from './page-app';
import { trackAppEvent as track } from './telemetry';

const gates = new Map<AppName, (authenticated: boolean) => void>();

/** Once the person is known: whether they are signed in. */
export function trackExplorerDailyReturn(authenticated: boolean) {
  const app = pageApp();
  if (!app) return;
  let gate = gates.get(app);
  if (!gate) {
    gate = createDailyReturn({
      storageKey: `${app}:v2:last-active-day`,
      report: (signedIn) =>
        track('Participant', 'Returned', signedIn ? 'Authenticated' : 'Anonymous'),
    });
    gates.set(app, gate);
  }
  gate(authenticated);
}
