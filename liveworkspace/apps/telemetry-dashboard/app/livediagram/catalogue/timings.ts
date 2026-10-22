// Timings (docs/specs/017-telemetry/timing-telemetry.md): one chart per timing metric, counting every
// bucket it was measured in. The Timings tab reads each one as a distribution rather than a count.
// Part of the metric catalogue: import from ../metric-catalogue.

import {
  EDITOR_TIMING_METRICS,
  parseTimingType,
  WEB_VITAL_APPS,
  WEB_VITALS,
  webVitalMetric,
  type EditorTimingMetric,
  type WebVital,
} from '@livediagram/api-schema';
import type { Metric } from '../metric-series';

/**
 * A timing chart: its metric token beside the curated Metric the coverage tests read, and for a Web
 * Vital, which vital of which app.
 */
export type TimingChart = Metric & { timing: string; app?: string; vital?: WebVital };

const timingChart = (timing: string, title: string, blurb: string): TimingChart => ({
  timing,
  category: 'Timing',
  action: 'Measured',
  typeIn: (type) => parseTimingType(type)?.metric === timing,
  title,
  blurb,
  // More timings is more use, neither good nor bad news; the percentiles say how fast.
  rising: 'neutral',
});

const EDITOR_COPY: Record<EditorTimingMetric, [title: string, blurb: string]> = {
  DocumentLoad: [
    'Document Load',
    'Opening a document: from the page being asked for (including downloading the app on a fresh page) to the first frame with the document on screen.',
  ],
  TabLoad: [
    'Tab Switch',
    'Switching to a tab whose content was not loaded yet: from fetching it to the first frame with it on screen.',
  ],
  Save: [
    'Save',
    'An autosave, from Saving to Saved. At most one per page per minute, so a long session does not dominate.',
  ],
  RoomConnect: [
    'Live Connect',
    "Joining a document's live room: from the first connection attempt to other people's presence appearing.",
  ],
  RoomReconnect: [
    'Live Reconnect',
    'A live room that dropped by itself, from the drop to presence coming back: the outage a person felt.',
  ],
};

export const EDITOR_TIMING_CHARTS: readonly TimingChart[] = EDITOR_TIMING_METRICS.map((m) =>
  timingChart(m, ...EDITOR_COPY[m]),
);

const VITAL_COPY: Record<WebVital, [name: string, what: string]> = {
  Lcp: ['LCP', 'Largest Contentful Paint: how long the main content took to show'],
  Inp: ['INP', 'Interaction to Next Paint: how quickly the page answered a click, tap or key'],
  Cls: ['CLS', 'Cumulative Layout Shift: how much the page jumped around while loading'],
};

/** Every app's three Core Web Vitals, app by app; the tab groups them on `app`. */
export const WEB_VITAL_CHARTS: readonly TimingChart[] = WEB_VITAL_APPS.flatMap((app) =>
  WEB_VITALS.map((vital) => {
    const [name, what] = VITAL_COPY[vital];
    return {
      ...timingChart(webVitalMetric(vital, app), `${name} · ${app}`, `${what}, on ${app} pages.`),
      app,
      vital,
    };
  }),
);
