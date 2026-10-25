// Core Web Vitals as timings (docs/specs/017-telemetry/timing-telemetry.md in each product): LCP, INP and CLS as
// the web-vitals library reports them, each sent as `Timing·Measured·<Vital>.<App>.<Bucket>`. The library's other
// metrics (FCP, TTFB, FID) are not reported. Each product binds it once (its web-vitals-report.ts) to its own
// vocabulary: the vitals it reports, the app a page belongs to, and its reportTiming, which buckets the value.

export type TimingTrack = (category: 'Timing', action: 'Measured', type: string) => void;

export type WebVitalsReport<Vital extends string> = {
  /** The library's metric name ('LCP') as a vital ('Lcp'), or null for one we do not report. */
  webVitalOf: (name: string) => Vital | null;
  /** The app whose page this is, named as page views name it. */
  webVitalApp: (pathname: string) => string;
  /** Report one web-vitals metric for a page of `app`. */
  reportWebVital: (
    track: TimingTrack,
    metric: { name: string; value: number },
    app: string,
  ) => void;
};

export function createWebVitalsReport<Vital extends string>({
  vitals,
  appOf,
  reportTiming,
}: {
  // The vitals the product reports, as its api-schema names them ('Lcp', 'Inp', 'Cls').
  vitals: readonly Vital[];
  // The app a pathname is served by, as its page views name it.
  appOf: (pathname: string) => string;
  // The product's reportTiming (its telemetry-client), which buckets `value` under `metric`.
  reportTiming: (track: TimingTrack, metric: string, value: number) => void;
}): WebVitalsReport<Vital> {
  const webVitalOf = (name: string): Vital | null => {
    const vital = name.charAt(0) + name.slice(1).toLowerCase();
    return (vitals as readonly string[]).includes(vital) ? (vital as Vital) : null;
  };
  return {
    webVitalOf,
    webVitalApp: appOf,
    reportWebVital(track, metric, app) {
      const vital = webVitalOf(metric.name);
      if (vital) reportTiming(track, `${vital}.${app}`, metric.value);
    },
  };
}
