import { pageViewApp, pageViewPath, WEB_VITALS, type WebVital } from '@livediagram/api-schema';
import { reportTiming, type TimingTrack } from '@livediagram/telemetry-client';

// Core Web Vitals as timings (docs/specs/017-telemetry/timing-telemetry.md): LCP, INP and CLS as the
// web-vitals library reports them, each sent as `Timing·Measured·<Vital>.<App>.<Bucket>`. The library's
// other metrics (FCP, TTFB, FID) are not reported.

/** The library's metric name ('LCP') as a vital ('Lcp'), or null for one we do not report. */
export function webVitalOf(name: string): WebVital | null {
  const vital = name.charAt(0) + name.slice(1).toLowerCase();
  return (WEB_VITALS as readonly string[]).includes(vital) ? (vital as WebVital) : null;
}

/** The app whose page this is, named as page views name it. */
export function webVitalApp(pathname: string): string {
  return pageViewApp(pageViewPath(pathname) ?? pathname);
}

/** Report one web-vitals metric for the page at `pathname`. */
export function reportWebVital(
  track: TimingTrack,
  metric: { name: string; value: number },
  app: string,
): void {
  const vital = webVitalOf(metric.name);
  if (vital) reportTiming(track, `${vital}.${app}`, metric.value);
}
