'use client';

import { useCallback, useState } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import type { TimingTrack } from '@livediagram/telemetry-client';
import { reportWebVital, webVitalApp } from './web-vitals-report';

// The Web Vitals observer (docs/specs/017-telemetry/timing-telemetry.md), loaded lazily by
// WebVitalsTracker so the library stays off the page's critical path. Its observers are buffered, so
// loading late still sees the paints and shifts before it. The app is read once, at mount: an in-app
// navigation stays inside the app that served the full page load these vitals describe.
export default function WebVitalsReporter({ track }: { track: TimingTrack }) {
  const [app] = useState(() => webVitalApp(window.location.pathname));
  useReportWebVitals(useCallback((metric) => reportWebVital(track, metric, app), [track, app]));
  return null;
}
