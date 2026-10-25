import { useCallback, useState } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import type { TimingTrack, WebVitalsReport } from './web-vitals';

// The Web Vitals observer (docs/specs/017-telemetry/timing-telemetry.md in each product), for a product's lazily
// loaded reporter chunk (its WebVitalsReporter, which WebVitalsTracker loads), so the library stays off the
// page's critical path. Its observers are buffered, so loading late still sees the paints and shifts before it.
// The app is read once, at mount: an in-app navigation stays inside the app that served the full page load these
// vitals describe. `report` is the product's binding of web-vitals.ts, a module constant.
export function WebVitalsReporter({
  track,
  report,
}: {
  track: TimingTrack;
  report: Pick<WebVitalsReport<string>, 'webVitalApp' | 'reportWebVital'>;
}) {
  const [app] = useState(() => report.webVitalApp(window.location.pathname));
  useReportWebVitals(
    useCallback(
      (metric: { name: string; value: number }) => report.reportWebVital(track, metric, app),
      [track, app, report],
    ),
  );
  return null;
}
