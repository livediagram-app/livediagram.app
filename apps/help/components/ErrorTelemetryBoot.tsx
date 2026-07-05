'use client';

import { useEffect } from 'react';
import { installClientErrorTracking } from '@livediagram/telemetry-client';
import { track } from '@/lib/telemetry';

// Error telemetry boot (spec/22 'Error' category): wires window-level
// uncaught exceptions / unhandled rejections into the help centre's
// policy-wrapped track(), via the shared installClientErrorTracking
// (generic kind tokens only, capped per kind per page load). Mounted
// once from the root layout; renders nothing.
export function ErrorTelemetryBoot() {
  useEffect(() => {
    installClientErrorTracking(track);
  }, []);
  return null;
}
