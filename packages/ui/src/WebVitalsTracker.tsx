'use client';

import dynamic from 'next/dynamic';
import { siteTrack, type TimingTrack } from '@livediagram/telemetry-client';

// Core Web Vitals telemetry (docs/specs/017-telemetry/timing-telemetry.md) for every frontend. The
// reporter is its own lazily loaded chunk: web-vitals is about 3 KB gzipped and nothing on a page waits
// for it. Mounted once in each root layout, like the page view tracker: the public sites mount
// WebVitalsBoot (wired to the shared siteTrack), the editor mounts WebVitalsTracker with its own track.
const WebVitalsReporter = dynamic(() => import('./WebVitalsReporter'), { ssr: false });

export function WebVitalsTracker({ track }: { track: TimingTrack }) {
  return <WebVitalsReporter track={track} />;
}

export function WebVitalsBoot() {
  return <WebVitalsTracker track={siteTrack} />;
}
