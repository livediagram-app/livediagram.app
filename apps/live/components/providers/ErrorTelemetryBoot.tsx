'use client';

import { useEffect } from 'react';
import { installClientErrorTracking } from '@livediagram/telemetry-client';
import { setApiErrorReporter } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Error telemetry boot (spec/22 'Error' category): mounts once from the
// root layout and wires the two editor-side error sources into track():
//
//   - window-level uncaught exceptions / unhandled rejections, via the
//     shared installClientErrorTracking (capped per kind per page load);
//   - the api-client's ApiError choke point, via setApiErrorReporter
//     (core.ts can't import lib/telemetry itself — import cycle — so
//     the wiring happens here, mirroring setTokenProvider).
//
// Only generic tokens ever leave: 'Uncaught' / 'UnhandledRejection' and
// 'Http<status>.<Action>'. Never a message, stack, URL, or user content. The
// reporter deliberately stays registered for the page's lifetime (no
// cleanup): the layout never unmounts, and an unload race that dropped
// the reporter would silently lose tail-of-session errors.

// The api-client's own intent string ('save tab') as a telemetry token
// ('SaveTab'), so a status spike says which request is failing. Safe by
// construction: these strings are written in lib/api, never derived from
// anything a user typed, and the filter below keeps only letters and digits
// so a future one can't smuggle in a path, id, or share code.
//
// TELEMETRY_TYPE_PATTERN allows [A-Za-z0-9 ._-] up to 40 chars — hence the
// dot separator (a colon would be rejected and the event silently dropped)
// and the cap, which today's longest action clears with room to spare.
function apiErrorType(status: number, action: string): string {
  const suffix = action
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  return `Http${status}${suffix ? `.${suffix}` : ''}`.slice(0, 40);
}

export function ErrorTelemetryBoot() {
  useEffect(() => {
    installClientErrorTracking(track);
    setApiErrorReporter((status, action) => track('Error', 'Api', apiErrorType(status, action)));
  }, []);
  return null;
}

export const __testing = { apiErrorType };
