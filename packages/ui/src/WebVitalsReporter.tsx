import { useCallback, useState } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import type { TimingTrack, WebVitalsReport } from './web-vitals';
import { isSilentReturn } from './silent-return';

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
  // The way back from a deferred silent sign-in: its timings start at the bounce, after the visitor had already seen
  // the page, so they describe no wait anyone had.
  const [skip] = useState(isSilentReturn);
  useReportWebVitals(
    useCallback(
      (metric: { name: string; value: number }) => {
        if (!skip) report.reportWebVital(track, metric, app);
      },
      [track, app, report, skip],
    ),
  );
  return null;
}
