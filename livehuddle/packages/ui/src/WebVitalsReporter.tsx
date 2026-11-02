'use client';

import type { TimingTrack } from '@liveworkspace/telemetry-client';
import { WebVitalsReporter as SharedReporter } from '@liveworkspace/ui/web-vitals-reporter';
import { WEB_VITALS_REPORT } from './web-vitals-report';

// The Web Vitals observer (docs/specs/017-telemetry/timing-telemetry.md), loaded lazily by WebVitalsTracker so the
// library stays off the page's critical path: @liveworkspace/ui's, reporting through this product's binding.
export default function WebVitalsReporter({ track }: { track: TimingTrack }) {
  return <SharedReporter track={track} report={WEB_VITALS_REPORT} />;
}
