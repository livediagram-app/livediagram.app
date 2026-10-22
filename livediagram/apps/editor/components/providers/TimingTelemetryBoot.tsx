'use client';

import { useEffect } from 'react';
import { WebVitalsTracker } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { setTimingTrack } from '@/lib/timing';

// Timing telemetry boot (docs/specs/017-telemetry/timing-telemetry.md): mounts once from the root
// layout. Registers the editor's policy-wrapped track() for its own timings (lib/timing, which lib/api
// reads without importing lib/telemetry) and mounts the shared Web Vitals reporter with it. Stays
// registered for the page's life, like ErrorTelemetryBoot.
export function TimingTelemetryBoot() {
  useEffect(() => {
    setTimingTrack(track);
  }, []);
  return <WebVitalsTracker track={track} />;
}
