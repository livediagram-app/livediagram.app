import { pageViewApp, pageViewPath, WEB_VITALS } from '@livediagram/api-schema';
import { createWebVitalsReport } from '@liveworkspace/ui/web-vitals';
import { reportTiming } from '@livediagram/telemetry-client';

// Core Web Vitals as timings (docs/specs/017-telemetry/timing-telemetry.md): @liveworkspace/ui's report, bound to
// this product's vitals, the app each page belongs to (named as page views name it) and its reportTiming. Each is
// sent as `Timing·Measured·<Vital>.<App>.<Bucket>`.
export const WEB_VITALS_REPORT = /* @__PURE__ */ createWebVitalsReport({
  vitals: WEB_VITALS,
  appOf: (pathname) => pageViewApp(pageViewPath(pathname) ?? pathname),
  reportTiming,
});

export const { webVitalOf, webVitalApp, reportWebVital } = WEB_VITALS_REPORT;
