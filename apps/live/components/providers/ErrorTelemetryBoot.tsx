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
// 'Http<status>'. Never a message, stack, URL, or user content. The
// reporter deliberately stays registered for the page's lifetime (no
// cleanup): the layout never unmounts, and an unload race that dropped
// the reporter would silently lose tail-of-session errors.
export function ErrorTelemetryBoot() {
  useEffect(() => {
    installClientErrorTracking(track);
    setApiErrorReporter((status) => track('Error', 'Api', `Http${status}`));
  }, []);
  return null;
}
